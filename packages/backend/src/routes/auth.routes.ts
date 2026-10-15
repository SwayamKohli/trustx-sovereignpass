// WebAuthn Authentication & Registration Routes
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import argon2 from 'argon2';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { db } from '../db/index';
import { rpName, rpID, origin } from '../webauthn/config';
import type { User, Credential } from '../db/schema';

const router = Router();

// In-memory challenge store: username -> { challenge, userId, type, expiresAt }
interface ChallengeRecord {
  challenge: string;
  userId: string;
  type: 'registration' | 'authentication';
  expiresAt: number;
}
const challengeStore = new Map<string, ChallengeRecord>();

// Clean up expired challenges periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of challengeStore.entries()) {
    if (value.expiresAt < now) {
      challengeStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function generateRecoveryCodes(count: number = 8): string[] {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(12);
    let code = '';
    for (let j = 0; j < 12; j++) {
      if (j > 0 && j % 4 === 0) code += '-';
      code += chars[bytes[j] % chars.length];
    }
    codes.push(code);
  }
  return codes;
}

/**
 * POST /api/auth/register-challenge
 * Initiates registration by returning WebAuthn PublicKeyCredentialCreationOptions
 */
router.post('/register-challenge', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'Valid username is required' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername) as User | undefined;
    if (existingUser) {
      return res.status(400).json({ error: 'Username already registered' });
    }

    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const userBuffer = Buffer.from(userId);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(userBuffer),
      userName: cleanUsername,
      userDisplayName: cleanUsername,
      attestationType: 'none',
      timeout: 60000,
    });

    challengeStore.set(cleanUsername, {
      challenge: options.challenge,
      userId,
      type: 'registration',
      expiresAt: Date.now() + 60000,
    });

    return res.json(options);
  } catch (err: any) {
    console.error('[WebAuthn] register-challenge error:', err);
    return res.status(500).json({ error: 'Failed to generate registration challenge' });
  }
});

/**
 * POST /api/auth/register-verify
 * Verifies attestation, provisions the user (role = 'USER'), stores credential & 8 recovery codes
 */
router.post('/register-verify', async (req: Request, res: Response) => {
  try {
    const { username, attestationResponse } = req.body;
    if (!username || !attestationResponse) {
      return res.status(400).json({ error: 'Missing username or attestationResponse' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const stored = challengeStore.get(cleanUsername);

    if (!stored || stored.type !== 'registration' || stored.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Registration challenge expired or not found' });
    }

    challengeStore.delete(cleanUsername);

    const verification = await verifyRegistrationResponse({
      response: attestationResponse as RegistrationResponseJSON,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Registration verification failed' });
    }

    const { credential } = verification.registrationInfo;
    const nowIso = new Date().toISOString();

    // Generate 8 high-entropy recovery codes
    const plainCodes = generateRecoveryCodes(8);
    const hashedCodes = await Promise.all(plainCodes.map((code) => argon2.hash(code)));

    // Execute atomic provisioning transaction
    const insertTransaction = db.transaction(() => {
      // 1. Provision user (Strictly role = 'USER' to prevent privilege escalation)
      db.prepare(`
        INSERT INTO users (id, username, role, created_at)
        VALUES (?, ?, 'USER', ?)
      `).run(stored.userId, cleanUsername, nowIso);

      // 2. Provision credential
      db.prepare(`
        INSERT INTO credentials (id, user_id, public_key, counter, transports, device_name, status, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        credential.id,
        stored.userId,
        Buffer.from(credential.publicKey),
        credential.counter,
        credential.transports ? JSON.stringify(credential.transports) : null,
        attestationResponse.response?.authenticatorAttachment === 'platform' ? 'Platform Authenticator' : 'Security Key',
        nowIso,
        nowIso
      );

      // 3. Store Argon2-hashed recovery codes
      const insertCodeStmt = db.prepare(`
        INSERT INTO recovery_codes (id, user_id, code_hash, used, created_at)
        VALUES (?, ?, ?, 0, ?)
      `);

      for (const hash of hashedCodes) {
        insertCodeStmt.run(`rec_${crypto.randomBytes(8).toString('hex')}`, stored.userId, hash, nowIso);
      }

      // 4. Audit Log
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'USER_REGISTERED', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        stored.userId,
        JSON.stringify({ credentialId: credential.id }),
        nowIso
      );
    });

    insertTransaction();

    return res.json({
      success: true,
      recoveryCodes: plainCodes,
    });
  } catch (err: any) {
    console.error('[WebAuthn] register-verify error:', err);
    return res.status(400).json({ error: err.message || 'Registration verification failed' });
  }
});

/**
 * POST /api/auth/login-challenge
 * Returns authentication options with allowCredentials for registered authenticators
 */
router.post('/login-challenge', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Valid username is required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(cleanUsername) as User | undefined;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const credentials = db.prepare(`
      SELECT id, transports, counter, status FROM credentials
      WHERE user_id = ? AND status = 'ACTIVE'
    `).all(user.id) as Credential[];

    if (credentials.length === 0) {
      return res.status(400).json({ error: 'No active credentials found for user' });
    }

    const allowCredentials = credentials.map((cred) => ({
      id: cred.id,
      type: 'public-key' as const,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      timeout: 60000,
    });

    challengeStore.set(cleanUsername, {
      challenge: options.challenge,
      userId: user.id,
      type: 'authentication',
      expiresAt: Date.now() + 60000,
    });

    return res.json(options);
  } catch (err: any) {
    console.error('[WebAuthn] login-challenge error:', err);
    return res.status(500).json({ error: 'Failed to generate authentication challenge' });
  }
});

/**
 * POST /api/auth/login-verify
 * Verifies signed assertion, updates counter, creates session, sets HttpOnly cookie
 */
router.post('/login-verify', async (req: Request, res: Response) => {
  try {
    const { username, assertionResponse } = req.body;
    if (!username || !assertionResponse) {
      return res.status(400).json({ error: 'Missing username or assertionResponse' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const stored = challengeStore.get(cleanUsername);

    if (!stored || stored.type !== 'authentication' || stored.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Authentication challenge expired or not found' });
    }

    challengeStore.delete(cleanUsername);

    const credentialId = assertionResponse.id;
    const cred = db.prepare(`
      SELECT id, user_id, public_key, counter, transports, status
      FROM credentials
      WHERE id = ? AND user_id = ? AND status = 'ACTIVE'
    `).get(credentialId, stored.userId) as Credential | undefined;

    if (!cred) {
      return res.status(401).json({ error: 'Authentication failed: credential not found or revoked' });
    }

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse as AuthenticationResponseJSON,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(cred.public_key),
        counter: cred.counter,
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      },
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return res.status(401).json({ error: 'Authentication failed: invalid assertion or origin mismatch' });
    }

    const { newCounter } = verification.authenticationInfo;
    const now = Date.now();
    const nowIso = new Date().toISOString();

    // Replay attack check: if newCounter > 0 and newCounter <= lastCounter, potential clone
    if (newCounter > 0 && cred.counter > 0 && newCounter <= cred.counter) {
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, 'SUSPECTED_REPLAY_ATTACK', ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        stored.userId,
        JSON.stringify({ credentialId: cred.id, lastCounter: cred.counter, newCounter }),
        nowIso
      );
      return res.status(401).json({ error: 'Authenticator counter anomaly detected' });
    }

    // Update credential counter & last_used_at
    db.prepare(`
      UPDATE credentials
      SET counter = ?, last_used_at = ?
      WHERE id = ?
    `).run(newCounter, nowIso, cred.id);

    // Create session in sessions table (24-hour lifetime)
    const sessionId = `sess_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    db.prepare(`
      INSERT INTO sessions (id, user_id, credential_id, created_at, expires_at, is_kiosk, ip_address, user_agent, last_active_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(sessionId, stored.userId, cred.id, nowIso, expiresAt, ipAddress, userAgent, now);

    // Audit Log
    db.prepare(`
      INSERT INTO audit_events (id, type, user_id, detail, timestamp)
      VALUES (?, 'AUTH_LOGIN_SUCCESS', ?, ?, ?)
    `).run(
      `aud_${crypto.randomBytes(8).toString('hex')}`,
      stored.userId,
      JSON.stringify({ credentialId: cred.id }),
      nowIso
    );

    // Set HttpOnly, SameSite=Strict, Secure session cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(stored.userId) as User;

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('[WebAuthn] login-verify error:', err);
    return res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

export default router;
