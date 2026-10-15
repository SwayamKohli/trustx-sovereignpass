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
import { serializeDevicePublicKey } from '../middleware/dpop.middleware';
import { assessLoginContext, type LoginRisk } from '../services/login-risk.service';

const router = Router();

// In-memory challenge store: username -> { challenge, userId, type, expiresAt }
interface ChallengeRecord {
  challenge: string;
  userId: string;
  type: 'registration' | 'authentication';
  expiresAt: number;
  intentId?: string;
  action?: { httpMethod: string; route: string; intentHash: string };
  loginCheck?: { credentialId: string; deviceKey: string; ip: string; userAgent: string; risk: LoginRisk };
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

export function generateRecoveryCodes(count: number = 8): string[] {
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
    // Do not let a forged Host port select the origin that the verifier trusts.
    const port = req.socket.localPort;
    const defaultPort = req.secure ? 443 : 80;
    return `${protocol}://${req.hostname}${port && port !== defaultPort ? `:${port}` : ''}`;
  }
  return origin;
}

function completeLogin(req: Request, res: Response, credential: Credential, newCounter: number, deviceKey: string, risk: LoginRisk) {
  const now = Date.now(), timestamp = new Date().toISOString();
  const sessionId = `sess_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = now + 24 * 60 * 60 * 1000;
  const ip = req.ip || '127.0.0.1', userAgent = req.headers['user-agent'] || 'unknown';
  const user = db.transaction(() => {
    const updated = db.prepare("UPDATE credentials SET counter = ?, last_used_at = ? WHERE id = ? AND user_id = ? AND status = 'ACTIVE' AND counter = ?").run(newCounter, timestamp, credential.id, credential.user_id, credential.counter);
    if (updated.changes !== 1) throw new Error('AUTHENTICATOR_STATE_CHANGED');
    db.prepare('INSERT INTO sessions (id,user_id,credential_id,created_at,expires_at,is_kiosk,ip_address,user_agent,last_active_at,dpop_public_key,login_risk) VALUES (?,?,?,?,?,0,?,?,?,?,?)').run(sessionId, credential.user_id, credential.id, timestamp, expiresAt, ip, userAgent, now, deviceKey, JSON.stringify(risk));
    db.prepare('INSERT INTO known_login_contexts (user_id,credential_id,ip_address,user_agent,last_seen_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,credential_id) DO UPDATE SET ip_address=excluded.ip_address,user_agent=excluded.user_agent,last_seen_at=excluded.last_seen_at').run(credential.user_id, credential.id, ip, userAgent, timestamp);
    db.prepare('INSERT INTO audit_events (id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), 'AUTH_LOGIN_SUCCESS', credential.user_id, JSON.stringify({ credentialId: credential.id, ipAddress: ip, userAgent, risk }), timestamp);
    return db.prepare('SELECT id,username,role FROM users WHERE id = ?').get(credential.user_id) as User;
  }).immediate();
  res.cookie('session_id', sessionId, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 24 * 60 * 60 * 1000 });
  return res.json({ success: true, user: { id: user.id, username: user.username, role: user.role }, isKiosk: false, expiresAt, loginRisk: risk });
}

/**
 * POST /api/auth/register-challenge
 * Initiates registration by returning WebAuthn PublicKeyCredentialCreationOptions
 */
router.post('/register-challenge', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length === 0 || username.trim().length > 100) {
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
      preferredAuthenticatorType: req.body.authenticator === 'security-key' ? 'securityKey' : undefined,
      timeout: 60000,
      authenticatorSelection: {
        authenticatorAttachment: req.body.authenticator === 'security-key' ? 'cross-platform' : undefined,
        residentKey: 'preferred',
        userVerification: 'required',
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
      requireUserVerification: true,
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
    if (!username || typeof username !== 'string' || !username.trim() || username.trim().length > 100) {
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
      userVerification: 'required',
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
    let dpopKeyStr: string;
    try { dpopKeyStr = serializeDevicePublicKey(dpopPublicKey); } catch { return res.status(400).json({ error: 'VALID_PUBLIC_DEVICE_KEY_REQUIRED' }); }
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
      requireUserVerification: true,
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

    const ip = req.ip || '127.0.0.1', userAgent = req.headers['user-agent'] || 'unknown';
    const risk = assessLoginContext(stored.userId, cred.id, ip, userAgent);
    if (risk.extraCheckRequired) {
      const options = await generateAuthenticationOptions({ rpID: effectiveRpID, allowCredentials: [{ id: cred.id, transports: cred.transports ? JSON.parse(cred.transports) : undefined }], userVerification: 'required', timeout: 60000 });
      const updated = db.prepare("UPDATE credentials SET counter = ? WHERE id = ? AND status = 'ACTIVE' AND counter = ?").run(newCounter, cred.id, cred.counter);
      if (updated.changes !== 1) throw new Error('AUTHENTICATOR_STATE_CHANGED');
      const pendingId = crypto.randomUUID();
      challengeStore.set(`logincheck_${pendingId}`, { challenge: options.challenge, userId: stored.userId, type: 'authentication', expiresAt: Date.now() + 60000, loginCheck: { credentialId: cred.id, deviceKey: dpopKeyStr, ip, userAgent, risk } });
      db.prepare('INSERT INTO audit_events (id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), 'LOGIN_EXTRA_CHECK_REQUIRED', stored.userId, JSON.stringify({ ipAddress: ip, userAgent, risk }), new Date().toISOString());
      return res.status(403).json({ error: 'LOGIN_EXTRA_CHECK_REQUIRED', pendingId, authenticationOptions: options, risk });
    }
    return completeLogin(req, res, cred, newCounter, dpopKeyStr, risk);
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
router.post('/login-extra-verify', async (req: Request, res: Response) => {
  const { pendingId, assertionResponse } = req.body;
  if (typeof pendingId !== 'string' || !assertionResponse) return res.status(400).json({ error: 'LOGIN_CHECK_REQUIRED' });
  const key = `logincheck_${pendingId}`, stored = challengeStore.get(key);
  function reject(status: number, reason: string) {
    if (stored?.loginCheck) db.prepare('INSERT INTO audit_events(id,type,user_id,detail,timestamp) VALUES (?,?,?,?,?)').run(crypto.randomUUID(),'LOGIN_EXTRA_CHECK_REJECTED',stored.userId,JSON.stringify({reason,ipAddress:req.ip || '127.0.0.1',userAgent:req.headers['user-agent'] || 'unknown'}),new Date().toISOString());
    return res.status(status).json({error:reason});
  }
  if (!stored?.loginCheck || stored.expiresAt <= Date.now()) { challengeStore.delete(key); return reject(401,'LOGIN_CHECK_EXPIRED'); }
  challengeStore.delete(key);
  const context = stored.loginCheck;
  if ((req.ip || '127.0.0.1') !== context.ip || (req.headers['user-agent'] || 'unknown') !== context.userAgent) return reject(403,'LOGIN_CONTEXT_CHANGED');
  const cred = db.prepare("SELECT * FROM credentials WHERE id = ? AND user_id = ? AND status = 'ACTIVE'").get(context.credentialId, stored.userId) as Credential | undefined;
  if (!cred || assertionResponse.id !== cred.id) return reject(401,'INVALID_CREDENTIAL');
  try {
    const verification = await verifyAuthenticationResponse({ response: assertionResponse, expectedChallenge: stored.challenge, expectedOrigin: getEffectiveOrigin(req), expectedRPID: getEffectiveRpID(req), credential: { id: cred.id, publicKey: new Uint8Array(cred.public_key), counter: cred.counter, transports: cred.transports ? JSON.parse(cred.transports) : undefined }, requireUserVerification: true });
    if (!verification.verified || stored.expiresAt <= Date.now()) return reject(401,'LOGIN_CHECK_NOT_VERIFIED');
    return completeLogin(req, res, cred, verification.authenticationInfo.newCounter, context.deviceKey, { ...context.risk, extraCheckCompleted: true });
  } catch { return reject(401,'LOGIN_CHECK_NOT_VERIFIED'); }
});

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
      userVerification: 'required',
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
      requireUserVerification: true,
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
  const currentIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
  const currentUserAgent = req.headers['user-agent'] || 'unknown';

  const risk = RiskService.evaluateRisk({
    currentIp,
    sessionIp: session.ip_address,
    currentUserAgent,
    sessionUserAgent: session.user_agent,
    method: 'GET',
    route: '/api/auth/session',
    isKiosk: Boolean(session.is_kiosk),
  });

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
    loginRisk: session.login_risk ? JSON.parse(session.login_risk) : null,
    risk: {
      score: risk.score,
      level: risk.level,
      reasons: risk.reasons.length ? risk.reasons : ['Normal session baseline', 'Origin & device key matched'],
      ipAddress: currentIp,
      userAgent: currentUserAgent,
    },
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
