// Authenticator Device Management & Instant Revocation Routes
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { db } from '../db/index';
import { requireSession } from '../middleware/session.middleware';
import { requireStepUpAuthorization, consumeStepUpAuthorization } from '../middleware/stepup.middleware';
import { rpName } from '../webauthn/config';
import { getEffectiveRpID, getEffectiveOrigin } from './auth.routes';
import type { Credential } from '../db/schema';

const router = Router();

// In-memory challenge store for secondary device enrollments: userId -> { challenge, expiresAt }
const deviceChallenges = new Map<string, { challenge: string; expiresAt: number }>();

/**
 * GET /api/devices/list
 * Returns all enrolled authenticators for the currently authenticated citizen.
 * Strictly uses session context (does not accept untrusted client-supplied user IDs).
 */
router.get('/list', requireSession, (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const devices = db.prepare(`
      SELECT id, device_name as name, status, last_used_at as lastUsed, created_at as createdAt
      FROM credentials
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as Array<{ id: string; name: string; status: string; lastUsed: string | null; createdAt: string }>;

    return res.json({ devices });
  } catch (err: any) {
    console.error('[Devices] list error:', err);
    return res.status(500).json({ error: 'Failed to retrieve device list' });
  }
});

/**
 * POST /api/devices/register-challenge (Secondary Device Enrollment)
 * Initiates registration ceremony to enroll an additional authenticator for the active user.
 */
router.post('/register-challenge', requireSession, requireStepUpAuthorization({ alwaysEnforce: true }), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (req.session!.is_kiosk) return res.status(403).json({ error: 'KIOSK_ENROLLMENT_FORBIDDEN' });
    const userBuffer = Buffer.from(user.id);

    // Retrieve existing credentials to prevent enrolling duplicate keys
    const existingCreds = db.prepare(`
      SELECT id, transports FROM credentials
      WHERE user_id = ? AND status = 'ACTIVE'
    `).all(user.id) as Credential[];

    const excludeCredentials = existingCreds.map((c) => ({
      id: c.id,
      type: 'public-key' as const,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    }));

    const effectiveRpID = getEffectiveRpID(req);
    const options = await generateRegistrationOptions({
      rpName,
      rpID: effectiveRpID,
      userID: new Uint8Array(userBuffer),
      userName: user.username,
      userDisplayName: user.username,
      attestationType: 'none',
      preferredAuthenticatorType: req.body.authenticator === 'security-key' ? 'securityKey' : undefined,
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required', authenticatorAttachment: req.body.authenticator === 'security-key' ? 'cross-platform' : undefined },
      excludeCredentials,
      timeout: 60000,
    });

    consumeStepUpAuthorization(req);
    deviceChallenges.set(req.session!.id, {
      challenge: options.challenge,
      expiresAt: Date.now() + 60000,
    });

    return res.json(options);
  } catch (err: any) {
    console.error('[Devices] register-challenge error:', err);
    return res.status(500).json({ error: 'Failed to generate device registration challenge' });
  }
});

/**
 * POST /api/devices/register-verify
 * Verifies attestation for secondary device and stores new ACTIVE credential in SQLite.
 */
router.post('/register-verify', requireSession, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (req.session!.is_kiosk) return res.status(403).json({ error: 'KIOSK_ENROLLMENT_FORBIDDEN' });
    const { attestationResponse, deviceName } = req.body;

    if (!attestationResponse) {
      return res.status(400).json({ error: 'Missing attestationResponse' });
    }

    const stored = deviceChallenges.get(req.session!.id);
    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Device registration challenge expired or not found' });
    }

    deviceChallenges.delete(req.session!.id);

    const effectiveOrigin = getEffectiveOrigin(req);
    const effectiveRpID = getEffectiveRpID(req);

    const verification = await verifyRegistrationResponse({
      response: attestationResponse as RegistrationResponseJSON,
      expectedChallenge: stored.challenge,
      expectedOrigin: effectiveOrigin,
      expectedRPID: effectiveRpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Device verification failed' });
    }

    const { credential } = verification.registrationInfo;
    const nowIso = new Date().toISOString();

    db.transaction(() => {
      if (stored.expiresAt <= Date.now() || !db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?').get(req.session!.id, user.id, Date.now())) throw new Error('Enrollment session ended or expired');
      db.prepare(`
        INSERT INTO credentials (id, user_id, public_key, counter, transports, device_name, status, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        credential.id,
        user.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credential.transports ? JSON.stringify(credential.transports) : null,
        deviceName || 'Secondary Authenticator',
        nowIso,
        nowIso
      );

      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'SECONDARY_DEVICE_ENROLLED', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        user.id,
        JSON.stringify({ deviceId: credential.id, deviceName }),
        nowIso
      );

    }).immediate();

    return res.json({
      success: true,
      deviceId: credential.id,
    });
  } catch (err: any) {
    console.error('[Devices] register-verify error:', err);
    return res.status(400).json({ error: err.message || 'Device registration verification failed' });
  }
});

/**
 * POST /api/devices/revoke
 * Instantly revokes target authenticator.
 * Strictly verifies ownership to prevent BOLA/IDOR attacks.
 * Immediately terminates all active SQLite sessions tied to that revoked credential.
 */
router.post('/revoke', requireSession, requireStepUpAuthorization({ alwaysEnforce: true }), (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { credentialId } = req.body;

    if (!credentialId || typeof credentialId !== 'string') {
      return res.status(400).json({ error: 'credentialId is required' });
    }

    // Verify credential existence and strict user ownership
    const targetCred = db.prepare(`
      SELECT id, user_id, status FROM credentials WHERE id = ?
    `).get(credentialId) as Credential | undefined;

    if (!targetCred) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    if (targetCred.user_id !== user.id) {
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'UNAUTHORIZED_REVOCATION_ATTEMPT', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        user.id,
        JSON.stringify({ attemptedCredentialId: credentialId, callerUserId: user.id }),
        new Date().toISOString()
      );
      return res.status(403).json({ error: 'Forbidden: credential does not belong to authenticated user' });
    }

    const nowIso = new Date().toISOString();

    // Atomic transaction: mark REVOKED and purge all sessions associated with this credential
    const revokeTransaction = db.transaction(() => {
      consumeStepUpAuthorization(req);
      db.prepare(`
        UPDATE credentials
        SET status = 'REVOKED'
        WHERE id = ? AND user_id = ?
      `).run(credentialId, user.id);

      // Purge all sessions established via this credential
      db.prepare(`
        DELETE FROM sessions
        WHERE credential_id = ?
      `).run(credentialId);

      // Record audit log
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'CREDENTIAL_REVOKED', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        user.id,
        JSON.stringify({ revokedCredentialId: credentialId }),
        nowIso
      );
    });

    revokeTransaction();

    return res.json({
      success: true,
      revokedCredentialId: credentialId,
    });
  } catch (err: any) {
    console.error('[Devices] revoke error:', err);
    return res.status(500).json({ error: 'Failed to revoke device' });
  }
});

export default router;
