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
import { RiskService } from '../services/risk.service';
import type { User, Credential, Session } from '../db/schema';
import { requireSession } from '../middleware/session.middleware';

const router = Router();

// In-memory challenge store: username -> { challenge, userId, type, expiresAt }
interface ChallengeRecord {
  challenge: string;
  userId: string;
  type: 'registration' | 'authentication';
  expiresAt: number;
  intentId?: string;
  action?: { httpMethod: string; route: string; intentHash: string };
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

export function getEffectiveRpID(req: Request): string {
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    return req.hostname;
  }
  return rpID;
}

export function getEffectiveOrigin(req: Request): string {
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host') || `${req.hostname}:3000`;
    return `${protocol}://${host}`;
  }
  return origin;
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

    const effectiveRpID = getEffectiveRpID(req);
    const options = await generateRegistrationOptions({
      rpName,
      rpID: effectiveRpID,
      userID: new Uint8Array(userBuffer),
      userName: cleanUsername,
      userDisplayName: cleanUsername,
      attestationType: 'none',
      timeout: 60000,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
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

    const effectiveOrigin = getEffectiveOrigin(req);
    const effectiveRpID = getEffectiveRpID(req);

    const verification = await verifyRegistrationResponse({
      response: attestationResponse as RegistrationResponseJSON,
      expectedChallenge: stored.challenge,
      expectedOrigin: effectiveOrigin,
      expectedRPID: effectiveRpID,
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

    const effectiveRpID = getEffectiveRpID(req);
    const options = await generateAuthenticationOptions({
      rpID: effectiveRpID,
      allowCredentials,
      timeout: 60000,
      userVerification: 'preferred',
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
  let storedUserId: string | null = null;
  try {
    const { username, assertionResponse, dpopPublicKey } = req.body;
    if (!username || !assertionResponse) {
      return res.status(400).json({ error: 'Missing username or assertionResponse' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const stored = challengeStore.get(cleanUsername);

    if (!stored || stored.type !== 'authentication' || stored.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Authentication challenge expired or not found' });
    }

    storedUserId = stored.userId;
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

    const effectiveOrigin = getEffectiveOrigin(req);
    const effectiveRpID = getEffectiveRpID(req);

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse as AuthenticationResponseJSON,
      expectedChallenge: stored.challenge,
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

    const dpopKeyStr = dpopPublicKey
      ? typeof dpopPublicKey === 'string'
        ? dpopPublicKey
        : JSON.stringify(dpopPublicKey)
      : null;

    db.prepare(`
      INSERT INTO sessions (id, user_id, credential_id, created_at, expires_at, is_kiosk, ip_address, user_agent, last_active_at, dpop_public_key)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(sessionId, stored.userId, cred.id, nowIso, expiresAt, ipAddress, userAgent, now, dpopKeyStr);

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
      isKiosk: false,
      expiresAt,
    });
  } catch (err: any) {
    console.error('[WebAuthn] login-verify error:', err);
    const isOriginMismatch = err.message && (err.message.includes('origin') || err.message.includes('Origin'));
    try {
      db.prepare(`
        INSERT INTO audit_events (id, type, user_id, detail, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        `aud_${crypto.randomBytes(8).toString('hex')}`,
        isOriginMismatch ? 'PHISHING_ORIGIN_REJECTED' : 'AUTH_VERIFY_FAILED',
        storedUserId,
        JSON.stringify({ error: err.message, ip: req.ip || '127.0.0.1' }),
        new Date().toISOString()
      );
    } catch {
      // Ignore database logging errors in catch block
    }
    return res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

/**
 * POST /api/auth/step-up-challenge
 * Issues a biometric authentication challenge bound to a specific high-risk action intent
 */
router.post('/step-up-challenge', requireSession, async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.session_id;
    if (!sessionId) {
      return res.status(401).json({ error: 'Active session required for step-up challenge' });
    }

    const session = db.prepare('SELECT id, user_id FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, Date.now()) as Session | undefined;
    if (!session) {
      return res.status(401).json({ error: 'Valid session required' });
    }

    const httpMethod = req.body.httpMethod || req.body.method;
    const { route, body } = req.body;
    if (typeof httpMethod !== 'string' || typeof route !== 'string' || !/^\/api\/[a-z0-9/-]+$/i.test(route)) {
      return res.status(400).json({ error: 'Missing httpMethod or route' });
    }

    const intentHash = RiskService.computeIntentHash(httpMethod, route, body || {});
    const credentials = db.prepare("SELECT id, transports FROM credentials WHERE user_id = ? AND status = 'ACTIVE'").all(session.user_id) as Credential[];

    if (credentials.length === 0) {
      return res.status(400).json({ error: 'No active authenticators enrolled for step-up' });
    }

    const effectiveRpID = getEffectiveRpID(req);
    const options = await generateAuthenticationOptions({
      rpID: effectiveRpID,
      allowCredentials: credentials.map((c) => ({
        id: c.id,
        type: 'public-key' as const,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
      timeout: 60000,
      userVerification: 'preferred',
    });

    const intentId = crypto.randomUUID();
    challengeStore.set(`stepup_${session.id}`, {
      challenge: options.challenge,
      userId: session.user_id,
      type: 'authentication',
      expiresAt: Date.now() + 60000,
      intentId,
      action: { httpMethod: httpMethod.toUpperCase(), route, intentHash },
    });

    return res.json({ intentId, stepUpOptions: options, options, intentHash });
  } catch (err: any) {
    console.error('[WebAuthn] step-up-challenge error:', err);
    return res.status(500).json({ error: 'Failed to generate step-up challenge' });
  }
});

/**
 * POST /api/auth/step-up-verify
 * Validates biometric assertion for the action-bound challenge and issues a single-use Step-Up Token
 */
router.post('/step-up-verify', requireSession, async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.session_id;
    if (!sessionId) {
      return res.status(401).json({ error: 'Active session required for step-up verification' });
    }

    const session = db.prepare('SELECT id, user_id FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, Date.now()) as Session | undefined;
    if (!session) {
      return res.status(401).json({ error: 'Valid session required' });
    }

    const { assertionResponse, intentId } = req.body;
    if (!assertionResponse || !intentId) {
      return res.status(400).json({ error: 'Missing assertionResponse or intentId' });
    }

    const stored = challengeStore.get(`stepup_${session.id}`);
    if (!stored || stored.expiresAt < Date.now() || stored.intentId !== intentId || !stored.action) {
      return res.status(400).json({ error: 'Step-up challenge expired or not found' });
    }
    challengeStore.delete(`stepup_${session.id}`);

    const cred = db.prepare("SELECT id, public_key, counter, transports FROM credentials WHERE id = ? AND user_id = ? AND status = 'ACTIVE'").get(assertionResponse.id, session.user_id) as Credential | undefined;
    if (!cred) {
      return res.status(401).json({ error: 'Credential not found or revoked' });
    }

    const effectiveOrigin = getEffectiveOrigin(req);
    const effectiveRpID = getEffectiveRpID(req);

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse as AuthenticationResponseJSON,
      expectedChallenge: stored.challenge,
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

    if (!verification.verified) {
      return res.status(401).json({ error: 'Biometric step-up assertion verification failed' });
    }

    const { httpMethod, route, intentHash } = stored.action;
    db.prepare('UPDATE credentials SET counter = ?, last_used_at = ? WHERE id = ?').run(verification.authenticationInfo.newCounter, new Date().toISOString(), cred.id);
    const stepUpToken = `stup_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minute validity window

    db.prepare(`
      INSERT INTO step_up_authorizations (token, user_id, session_id, http_method, route, intent_hash, expires_at, consumed)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(stepUpToken, session.user_id, session.id, httpMethod.toUpperCase(), route, intentHash, expiresAt);

    // Audit log
    db.prepare(`
      INSERT INTO audit_events (id, type, user_id, detail, timestamp)
      VALUES (?, 'STEP_UP_VERIFIED', ?, ?, ?)
    `).run(
      `aud_stup_${crypto.randomBytes(8).toString('hex')}`,
      session.user_id,
      JSON.stringify({ httpMethod, route, intentHash }),
      new Date().toISOString()
    );

    return res.json({
      success: true,
      stepUpToken,
      expiresAt,
    });
  } catch (err: any) {
    console.error('[WebAuthn] step-up-verify error:', err);
    return res.status(401).json({ error: err.message || 'Step-up verification failed' });
  }
});

/**
 * GET /api/auth/session
 * Returns the currently active authenticated session context (protected by requireSession & DPoP)
 */
router.get('/session', requireSession, (req: Request, res: Response) => {
  const session = req.session!;
  const user = req.user!;
  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    isKiosk: Boolean(session.is_kiosk),
    isDeviceBound: !!session.dpop_public_key,
    expiresAt: session.expires_at,
  });
});

/**
 * POST /api/auth/logout
 * Destroys session record in SQLite and clears the session cookie
 */
router.post('/logout', requireSession, (req: Request, res: Response) => {
  const sessionId = req.cookies?.session_id || 
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }
  res.clearCookie('session_id', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
  return res.json({ success: true });
});

export default router;
