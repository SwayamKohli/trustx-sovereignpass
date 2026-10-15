// Shared-Device Ephemeral Kiosk Session Routes
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { db } from '../db/index';
import { rpID, origin } from '../webauthn/config';
import { getEffectiveRpID, getEffectiveOrigin } from './auth.routes';
import type { User, Credential, KioskAuthorization } from '../db/schema';

const router = Router();

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * POST /api/kiosk/qr-challenge
 * Public workstation generates an unguessable polling secret and short confirmation code.
 * Displays dynamic QR and 2-digit confirmation code on screen.
 */
router.post('/qr-challenge', (req: Request, res: Response) => {
  try {
    const kioskSessionId = `kiosk_sess_${crypto.randomBytes(8).toString('hex')}`;
    const kioskClientSecret = `sec_kiosk_poll_private_${crypto.randomBytes(16).toString('hex')}`;
    const token = `tok_single_use_${crypto.randomBytes(16).toString('hex')}`;
    const displayCode = crypto.randomInt(10, 100);
    const publicKey = req.body.dpopPublicKey;
    let deviceKey: string | null = null;
    if (publicKey) {
      if (publicKey.kty !== 'EC' || publicKey.crv !== 'P-256' || publicKey.d) return res.status(400).json({ error: 'Invalid public device key' });
      crypto.createPublicKey({ key: publicKey, format: 'jwk' });
      deviceKey = JSON.stringify(publicKey);
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 minutes validity
    const nowIso = new Date().toISOString();

    const tokenHash = hashSecret(token);
    const secretHash = hashSecret(kioskClientSecret);
    const effectiveOrigin = getEffectiveOrigin(req);
    const qrData = `${effectiveOrigin}/kiosk-auth?sid=${kioskSessionId}&token=${token}`;

    db.prepare(`
      INSERT INTO kiosk_authorizations (
        kiosk_session_id, token_hash, kiosk_client_secret_hash, display_code,
        user_id, challenge, status, expires_at, created_at, dpop_public_key
      ) VALUES (?, ?, ?, ?, NULL, NULL, 'PENDING', ?, ?, ?)
    `).run(
      kioskSessionId,
      tokenHash,
      secretHash,
      displayCode,
      expiresAt,
      nowIso,
      deviceKey
    );

    return res.json({
      kioskSessionId,
      kioskClientSecret,
      qrData,
      displayCode,
      expiresAt,
    });
  } catch (err: any) {
    console.error('[Kiosk] qr-challenge error:', err);
    return res.status(500).json({ error: 'Failed to generate kiosk challenge' });
  }
});

/**
 * POST /api/kiosk/qr-auth-challenge (Phone Passkey Options Request)
 * Citizen phone scans QR and requests WebAuthn authentication options bound to this kiosk session.
 */
router.post('/qr-auth-challenge', async (req: Request, res: Response) => {
  try {
    const { kioskSessionId, token, username } = req.body;
    if (!kioskSessionId || !token || !username) {
      return res.status(400).json({ error: 'Missing kioskSessionId, token, or username' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const tokenHash = hashSecret(token);
    const nowEpoch = Math.floor(Date.now() / 1000);

    const kiosk = db.prepare(`
      SELECT * FROM kiosk_authorizations
      WHERE kiosk_session_id = ? AND token_hash = ? AND status = 'PENDING' AND expires_at > ?
    `).get(kioskSessionId, tokenHash, nowEpoch) as KioskAuthorization | undefined;

    if (!kiosk) {
      return res.status(400).json({ error: 'Invalid or expired kiosk QR session' });
    }

    // Verify citizen username exists and owns active credentials
    const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(cleanUsername) as User | undefined;
    if (!user) {
      return res.status(400).json({ error: 'User not found or has no active passkeys' });
    }

    const credentials = db.prepare(`
      SELECT id, transports FROM credentials
      WHERE user_id = ? AND status = 'ACTIVE'
    `).all(user.id) as Credential[];

    if (credentials.length === 0) {
      return res.status(400).json({ error: 'User has no active passkeys registered' });
    }

    const allowCredentials = credentials.map((cred) => ({
      id: cred.id,
      type: 'public-key' as const,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    }));

    const effectiveRpID = getEffectiveRpID(req);
    const options = await generateAuthenticationOptions({
      rpID: effectiveRpID,
      allowCredentials,
      timeout: 60000,
    });

    // Bind challenge and user to kiosk record
    db.prepare(`
      UPDATE kiosk_authorizations
      SET user_id = ?, challenge = ?
      WHERE kiosk_session_id = ?
    `).run(user.id, options.challenge, kioskSessionId);

    return res.json({
      challenge: options.challenge,
      allowCredentials: options.allowCredentials,
      timeout: 60000,
      displayCode: kiosk.display_code,
    });
  } catch (err: any) {
    console.error('[Kiosk] qr-auth-challenge error:', err);
    return res.status(500).json({ error: 'Failed to generate kiosk auth challenge' });
  }
});

/**
 * POST /api/kiosk/qr-authorize (Phone Passkey Approval)
 * Smartphone verifies passkey assertion and matches confirmation code, advancing state to AUTHORIZED.
 */
router.post('/qr-authorize', async (req: Request, res: Response) => {
  try {
    const { kioskSessionId, token, confirmationCode, confirmedCode, assertionResponse } = req.body;
    const finalCode = confirmationCode !== undefined ? confirmationCode : confirmedCode;
    if (!kioskSessionId || !token || finalCode === undefined || !assertionResponse) {
      return res.status(400).json({ error: 'Missing kioskSessionId, token, confirmationCode, or assertionResponse' });
    }

    const tokenHash = hashSecret(token);
    const nowEpoch = Math.floor(Date.now() / 1000);

    const kiosk = db.prepare(`
      SELECT * FROM kiosk_authorizations
      WHERE kiosk_session_id = ? AND token_hash = ? AND status = 'PENDING' AND expires_at > ?
    `).get(kioskSessionId, tokenHash, nowEpoch) as KioskAuthorization | undefined;

    if (!kiosk || !kiosk.challenge || !kiosk.user_id) {
      return res.status(400).json({ error: 'Kiosk session not ready for authorization or expired' });
    }

    if (kiosk.display_code !== Number(finalCode)) {
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'KIOSK_CONFIRMATION_MISMATCH', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        kiosk.user_id,
        JSON.stringify({ expected: kiosk.display_code, received: finalCode }),
        new Date().toISOString()
      );
      return res.status(400).json({ error: 'Invalid confirmation code' });
    }

    // Retrieve active credential used for assertion
    const credId = assertionResponse.id;
    const cred = db.prepare(`
      SELECT id, user_id, public_key, counter, transports, status
      FROM credentials
      WHERE id = ? AND user_id = ? AND status = 'ACTIVE'
    `).get(credId, kiosk.user_id) as Credential | undefined;

    if (!cred) {
      return res.status(401).json({ error: 'Credential not found or revoked' });
    }

    const effectiveOrigin = getEffectiveOrigin(req);
    const effectiveRpID = getEffectiveRpID(req);

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse as AuthenticationResponseJSON,
      expectedChallenge: kiosk.challenge,
      expectedOrigin: effectiveOrigin,
      expectedRPID: effectiveRpID,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(cred.public_key),
        counter: cred.counter,
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      },
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return res.status(401).json({ error: 'Biometric authorization failed' });
    }

    const { newCounter } = verification.authenticationInfo;
    const nowIso = new Date().toISOString();

    // Update credential counter and advance kiosk status to AUTHORIZED atomically
    const authorizeTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE credentials
        SET counter = ?, last_used_at = ?
        WHERE id = ?
      `).run(newCounter, nowIso, cred.id);

      db.prepare(`
        UPDATE kiosk_authorizations
        SET status = 'AUTHORIZED'
        WHERE kiosk_session_id = ? AND status = 'PENDING'
      `).run(kioskSessionId);

      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'KIOSK_SESSION_AUTHORIZED', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        kiosk.user_id,
        JSON.stringify({ kioskSessionId }),
        nowIso
      );
    });

    authorizeTransaction();

    return res.json({
      success: true,
      message: 'Kiosk terminal authorized successfully',
    });
  } catch (err: any) {
    console.error('[Kiosk] qr-authorize error:', err);
    return res.status(400).json({ error: err.message || 'Authorization failed' });
  }
});

/**
 * POST /api/kiosk/qr-poll (Public Terminal Polling)
 * Kiosk workstation polls presenting its client secret in the JSON request body.
 * Grants a strictly server-enforced 15-minute ephemeral session with zero resident passkey residue.
 */
router.post('/qr-poll', (req: Request, res: Response) => {
  try {
    const { kioskSessionId, kioskClientSecret } = req.body;
    if (!kioskSessionId || !kioskClientSecret) {
      return res.status(400).json({ error: 'Missing kioskSessionId or kioskClientSecret' });
    }

    const secretHash = hashSecret(kioskClientSecret);
    const nowEpoch = Math.floor(Date.now() / 1000);

    const kiosk = db.prepare(`
      SELECT * FROM kiosk_authorizations
      WHERE kiosk_session_id = ?
    `).get(kioskSessionId) as KioskAuthorization | undefined;

    if (!kiosk || kiosk.kiosk_client_secret_hash !== secretHash) {
      return res.status(403).json({ error: 'Invalid kiosk client secret' });
    }

    if (kiosk.expires_at <= nowEpoch) {
      return res.json({ status: 'EXPIRED' });
    }

    if (kiosk.status === 'PENDING') {
      return res.json({ status: 'PENDING' });
    }

    if (kiosk.status === 'AUTHORIZED') {
      const nowMs = Date.now();
      const nowIso = new Date().toISOString();
      const ephemeralExpiryMs = nowMs + 15 * 60 * 1000; // Strictly 15 minutes
      const sessionId = `sess_kiosk_${crypto.randomBytes(24).toString('hex')}`;
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Kiosk Terminal';

      // Atomic claim & session issuance
      const claimTransaction = db.transaction(() => {
        const updateResult = db.prepare(`
          UPDATE kiosk_authorizations
          SET status = 'CLAIMED'
          WHERE kiosk_session_id = ? AND status = 'AUTHORIZED'
        `).run(kioskSessionId);

        if (updateResult.changes !== 1) {
          throw new Error('Kiosk authorization ticket already claimed');
        }

        // Issue 15-minute ephemeral session with is_kiosk = 1
        db.prepare(`
          INSERT INTO sessions (id, user_id, credential_id, created_at, expires_at, is_kiosk, ip_address, user_agent, last_active_at, dpop_public_key)
          VALUES (?, ?, NULL, ?, ?, 1, ?, ?, ?, ?)
        `).run(
          sessionId,
          kiosk.user_id,
          nowIso,
          ephemeralExpiryMs,
          ipAddress,
          userAgent,
          nowMs,
          kiosk.dpop_public_key ?? null
        );

        db.prepare(`
          INSERT INTO audit_events (id, type, user_id, detail, timestamp)
          VALUES (?, 'KIOSK_SESSION_CLAIMED_EPHEMERAL', ?, ?, ?)
        `).run(
          `aud_${crypto.randomBytes(8).toString('hex')}`,
          kiosk.user_id,
          JSON.stringify({ kioskSessionId, sessionId, durationMinutes: 15 }),
          nowIso
        );
      });

      claimTransaction();

      // Set 15-minute ephemeral session cookie
      res.cookie('session_id', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });

      const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(kiosk.user_id) as User;

      return res.json({
        status: 'AUTHORIZED',
        user: {
          id: user.id,
          username: user.username,
          role: user.role || 'USER',
        },
        isKiosk: true,
        isDeviceBound: !!kiosk.dpop_public_key,
        expiresAt: ephemeralExpiryMs,
      });
    }

    if (kiosk.status === 'CLAIMED') {
      return res.json({ status: 'CLAIMED' });
    }

    return res.json({ status: kiosk.status });
  } catch (err: any) {
    console.error('[Kiosk] qr-poll error:', err);
    return res.status(500).json({ error: err.message || 'Polling error' });
  }
});

export default router;
