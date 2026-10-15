// Safe Two-Phase Account Recovery Routes
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import argon2 from 'argon2';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { db } from '../db/index';
import { rpName, rpID, origin } from '../webauthn/config';
import type { User, RecoveryCode, PendingRecovery } from '../db/schema';

const router = Router();

// In-memory rate limiting for recovery attempts: key -> { count, lockedUntil }
const recoveryRateLimits = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = recoveryRateLimits.get(key);
  if (!entry) {
    return { allowed: true };
  }
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry.lockedUntil <= now && entry.count >= 5) {
    // Reset after lock expired
    recoveryRateLimits.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = recoveryRateLimits.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000; // 15-minute progressive lockout
  }
  recoveryRateLimits.set(key, entry);
}

function clearRateLimit(key: string) {
  recoveryRateLimits.delete(key);
}

/**
 * POST /api/recovery/verify-code (Phase 1: Verification & Intent Freeze)
 * Validates recovery code against Argon2id hash.
 * Generates replacement passkey registrationOptions and stages intent in pending_recoveries.
 * NOTE: The recovery code is NOT burned in Phase 1 (protects citizen from lockout).
 */
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { username, recoveryCode } = req.body;
    if (!username || !recoveryCode || typeof username !== 'string' || typeof recoveryCode !== 'string') {
      return res.status(400).json({ error: 'Username and recoveryCode are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanCode = recoveryCode.trim().toUpperCase();
    const rateLimitKey = `${req.ip || '127.0.0.1'}:${cleanUsername}`;

    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many failed recovery attempts. Please try again in 15 minutes.`,
      });
    }

    const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(cleanUsername) as User | undefined;
    if (!user) {
      recordFailedAttempt(rateLimitKey);
      return res.status(400).json({ error: 'Invalid or already consumed recovery code' });
    }

    // Retrieve unconsumed recovery codes for this user
    const unusedCodes = db.prepare(`
      SELECT id, code_hash, used FROM recovery_codes
      WHERE user_id = ? AND used = 0
    `).all(user.id) as RecoveryCode[];

    if (unusedCodes.length === 0) {
      recordFailedAttempt(rateLimitKey);
      return res.status(400).json({ error: 'Invalid or already consumed recovery code' });
    }

    let matchingCodeId: string | null = null;
    for (const codeRecord of unusedCodes) {
      try {
        const isMatch = await argon2.verify(codeRecord.code_hash, cleanCode);
        if (isMatch) {
          matchingCodeId = codeRecord.id;
          break;
        }
      } catch {
        // Continue checking next hash
      }
    }

    if (!matchingCodeId) {
      recordFailedAttempt(rateLimitKey);
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'RECOVERY_CODE_FAILED_ATTEMPT', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        user.id,
        JSON.stringify({ ip: req.ip || '127.0.0.1' }),
        new Date().toISOString()
      );
      return res.status(400).json({ error: 'Invalid or already consumed recovery code' });
    }

    clearRateLimit(rateLimitKey);

    // Generate replacement passkey registration options
    const ticketId = `rec_ticket_${crypto.randomBytes(12).toString('hex')}`;
    const userBuffer = Buffer.from(user.id);
    const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5-minute validity window

    const registrationOptions = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(userBuffer),
      userName: cleanUsername,
      userDisplayName: cleanUsername,
      attestationType: 'none',
      timeout: 60000,
    });

    // Stage pending recovery record (recovery code is NOT burned yet)
    db.prepare(`
      INSERT INTO pending_recoveries (ticket_id, user_id, verified_recovery_code_id, replacement_registration_challenge, expires_at, used)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(
      ticketId,
      user.id,
      matchingCodeId,
      registrationOptions.challenge,
      expiresAt
    );

    db.prepare(`
      INSERT INTO audit_events (id, type, user_id, detail, timestamp)
      VALUES (?, 'RECOVERY_PHASE1_STAGED', ?, ?, ?)
    `).run(
      `aud_${crypto.randomBytes(8).toString('hex')}`,
      user.id,
      JSON.stringify({ ticketId, codeId: matchingCodeId }),
      new Date().toISOString()
    );

    return res.json({
      success: true,
      recoveryTicket: ticketId,
      registrationOptions,
      expiresAt,
      message: 'Recovery code verified. Complete biometric enrollment with the provided registrationOptions to finalize.',
    });
  } catch (err: any) {
    console.error('[Recovery] verify-code error:', err);
    return res.status(500).json({ error: 'Failed to process recovery verification' });
  }
});

/**
 * POST /api/recovery/complete (Phase 2: Concurrency-Safe Finalization & Atomic Burn)
 * Atomically consumes recovery ticket & code, revokes lost credentials, enrolls replacement passkey, and purges previous sessions.
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { username, recoveryTicket, attestationResponse, deviceName, dpopPublicKey } = req.body;
    if (!username || !recoveryTicket || !attestationResponse) {
      return res.status(400).json({ error: 'Missing username, recoveryTicket, or attestationResponse' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = db.prepare('SELECT id, username, role FROM users WHERE username = ?').get(cleanUsername) as User | undefined;
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    const pending = db.prepare(`
      SELECT * FROM pending_recoveries
      WHERE ticket_id = ? AND user_id = ? AND used = 0 AND expires_at > ?
    `).get(recoveryTicket, user.id, nowEpoch) as PendingRecovery | undefined;

    if (!pending) {
      return res.status(400).json({ error: 'Invalid or expired recovery ticket' });
    }

    // Verify attestation against the replacement challenge staged in Phase 1
    const verification = await verifyRegistrationResponse({
      response: attestationResponse as RegistrationResponseJSON,
      expectedChallenge: pending.replacement_registration_challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Replacement passkey registration verification failed' });
    }

    const { credential } = verification.registrationInfo;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const sessionId = `sess_${crypto.randomBytes(24).toString('hex')}`;
    const sessionExpiresAt = nowMs + 24 * 60 * 60 * 1000;
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Atomic transaction execution for concurrency safety
    const completeTransaction = db.transaction(() => {
      // 1. Recheck ticket validity and conditionally burn (must affect exactly 1 row)
      const ticketUpdate = db.prepare(`
        UPDATE pending_recoveries
        SET used = 1
        WHERE ticket_id = ? AND used = 0
      `).run(pending.ticket_id);

      if (ticketUpdate.changes !== 1) {
        throw new Error('CONCURRENCY_ABORT: Recovery ticket was already consumed by a concurrent request');
      }

      // 2. Recheck recovery code and conditionally burn (must affect exactly 1 row)
      const codeUpdate = db.prepare(`
        UPDATE recovery_codes
        SET used = 1, consumed_at = ?
        WHERE id = ? AND used = 0
      `).run(nowIso, pending.verified_recovery_code_id);

      if (codeUpdate.changes !== 1) {
        throw new Error('CONCURRENCY_ABORT: Recovery code was already consumed by a concurrent request');
      }

      // 3. Revoke all previous active credentials for this citizen
      db.prepare(`
        UPDATE credentials
        SET status = 'REVOKED'
        WHERE user_id = ? AND status = 'ACTIVE'
      `).run(user.id);

      // 4. Enroll replacement credential as ACTIVE
      db.prepare(`
        INSERT INTO credentials (id, user_id, public_key, counter, transports, device_name, status, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        credential.id,
        user.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credential.transports ? JSON.stringify(credential.transports) : null,
        deviceName || 'Replacement Authenticator (Post-Recovery)',
        nowIso,
        nowIso
      );

      // 5. Purge all prior sessions (terminates sessions on stolen devices immediately)
      db.prepare(`
        DELETE FROM sessions
        WHERE user_id = ?
      `).run(user.id);

      // 6. Issue fresh session for the newly enrolled replacement authenticator
      const dpopKeyStr = dpopPublicKey
        ? typeof dpopPublicKey === 'string'
          ? dpopPublicKey
          : JSON.stringify(dpopPublicKey)
        : null;

      db.prepare(`
        INSERT INTO sessions (id, user_id, credential_id, created_at, expires_at, is_kiosk, ip_address, user_agent, last_active_at, dpop_public_key)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      `).run(
        sessionId,
        user.id,
        credential.id,
        nowIso,
        sessionExpiresAt,
        ipAddress,
        userAgent,
        nowMs,
        dpopKeyStr
      );

      // 7. Audit Logging
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'ACCOUNT_RECOVERY_COMPLETED', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        user.id,
        JSON.stringify({
          ticketId: pending.ticket_id,
          codeId: pending.verified_recovery_code_id,
          newCredentialId: credential.id,
        }),
        nowIso
      );
    });

    completeTransaction();

    // Set fresh session cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: 'Account recovery complete. Replacement passkey enrolled and prior sessions terminated.',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      isKiosk: false,
      expiresAt: sessionExpiresAt,
    });
  } catch (err: any) {
    console.error('[Recovery] complete error:', err);
    return res.status(400).json({ error: err.message || 'Recovery finalization failed' });
  }
});

export default router;
