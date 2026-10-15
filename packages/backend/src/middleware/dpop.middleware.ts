// Device-Bound Proof-of-Possession (DPoP) Session Middleware
// Owner: Swayam (Role 4 — Systems Integration, DPoP & Risk Engine Lead)
// Reference: RFC 9449 & W3C WebCrypto Device Binding Specification

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db/index';
import type { Session } from '../db/schema';

// Extend Express Request to hold session and userId
declare global {
  namespace Express {
    interface Request {
      session?: Session;
      userId?: string;
    }
  }
}

export function serializeDevicePublicKey(value: unknown): string {
  const key = typeof value === 'string' ? JSON.parse(value) : value;
  if (!key || key.kty !== 'EC' || key.crv !== 'P-256' || key.d || typeof key.x !== 'string' || typeof key.y !== 'string' || Buffer.from(key.x, 'base64url').length !== 32 || Buffer.from(key.y, 'base64url').length !== 32) throw new Error('VALID_PUBLIC_DEVICE_KEY_REQUIRED');
  crypto.createPublicKey({ key, format: 'jwk' });
  return JSON.stringify({ kty: key.kty, crv: key.crv, x: key.x, y: key.y });
}

export interface DPoPVerificationResult {
  valid: boolean;
  error?: string;
  jti?: string;
}

/**
 * Signature validator with persistent one-time proof tracking.
 * Validates JWT header, payload (htm, htu, iat, jti), freshness window, replay cache,
 * and ECDSA P-256 (ES256) signature against the device public key registered with the session.
 */
export function verifyDPoPProof(
  proofJwt: string,
  dpopPublicKeyJwkStr: string,
  expectedMethod: string,
  expectedPath: string,
  maxAgeMs: number = 60000
): DPoPVerificationResult {
  try {
    const parts = proofJwt.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed DPoP proof: must have 3 segments' };
    }

    const [headerB64, payloadB64, sigB64] = parts;

    // 1. Decode and validate header
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    if (header.typ !== 'dpop+jwt' && header.typ !== 'dpop') {
      return { valid: false, error: `Invalid DPoP header typ: ${header.typ}` };
    }
    if (header.alg !== 'ES256') {
      return { valid: false, error: `Unsupported DPoP algorithm: ${header.alg} (ES256 required)` };
    }

    // 2. Decode and validate payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.jti || typeof payload.jti !== 'string' || payload.jti.length > 200) {
      return { valid: false, error: 'Missing or invalid jti in DPoP payload' };
    }
    if (!payload.htm || typeof payload.htm !== 'string') {
      return { valid: false, error: 'Missing or invalid htm in DPoP payload' };
    }
    if (!payload.htu || typeof payload.htu !== 'string') {
      return { valid: false, error: 'Missing or invalid htu in DPoP payload' };
    }
    if (!payload.iat || typeof payload.iat !== 'number') {
      return { valid: false, error: 'Missing or invalid iat in DPoP payload' };
    }

    // 3. Method & URI binding enforcement
    if (payload.htm.toUpperCase() !== expectedMethod.toUpperCase()) {
      return {
        valid: false,
        error: `DPoP HTTP method mismatch: expected ${expectedMethod.toUpperCase()}, got ${payload.htm.toUpperCase()}`,
      };
    }

    // Compare path (normalize trailing slashes and query strings)
    const normalizedExpected = expectedPath.split('?')[0].replace(/\/+$/, '');
    const normalizedActual = payload.htu.split('?')[0].replace(/\/+$/, '');
    if (normalizedActual !== normalizedExpected) {
      return {
        valid: false,
        error: `DPoP URI path mismatch: expected ${normalizedExpected}, got ${normalizedActual}`,
      };
    }

    // 4. Freshness window check
    const now = Date.now();
    const proofTime = payload.iat * 1000;
    if (Math.abs(now - proofTime) > maxAgeMs) {
      return { valid: false, error: 'DPoP proof has expired or clock skew is too large' };
    }

    // 5. Replay prevention check
    const proofId = crypto.createHash('sha256').update(`${dpopPublicKeyJwkStr}:${payload.jti}`).digest('hex');
    db.prepare('DELETE FROM used_device_proofs WHERE expires_at < ?').run(now);
    if (db.prepare('SELECT id FROM used_device_proofs WHERE id = ?').get(proofId)) {
      return { valid: false, error: 'DPoP proof jti replay detected' };
    }

    // 6. Signature verification against registered session device key
    const jwk = typeof dpopPublicKeyJwkStr === 'string' ? JSON.parse(dpopPublicKeyJwkStr) : dpopPublicKeyJwkStr;
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

    // WebCrypto ES256 signatures are raw (R || S) 64 bytes IEEE P1363 format
    // Node.js crypto.verify supports both DER and IEEE P1363 (via dsaEncoding: 'ieee-p1363')
    const signatureBuffer = Buffer.from(sigB64, 'base64url');
    const dataToVerify = Buffer.from(`${headerB64}.${payloadB64}`);

    const isVerified = crypto.verify(
      'SHA256',
      dataToVerify,
      {
        key: publicKey,
        dsaEncoding: signatureBuffer.length === 64 ? 'ieee-p1363' : 'der',
      },
      signatureBuffer
    );

    if (!isVerified) {
      return { valid: false, error: 'DPoP cryptographic signature verification failed' };
    }

    // The uniqueness constraint arbitrates concurrent workers and survives a process restart.
    const recorded = db.prepare('INSERT OR IGNORE INTO used_device_proofs (id,expires_at) VALUES (?,?)').run(proofId, proofTime + maxAgeMs);
    if (recorded.changes !== 1) return { valid: false, error: 'DPoP proof jti replay detected' };

    return { valid: true, jti: payload.jti };
  } catch (err: any) {
    return { valid: false, error: err.message || 'DPoP verification error' };
  }
}

/**
 * Express middleware for device-bound session enforcement.
 * Inspects session cookie and enforces valid DPoP proof if session has a bound device key.
 */
export function requireDeviceBoundSession(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.session_id || (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].substring(7) : null);

  if (!sessionId) {
    return res.status(401).json({ error: 'Session required: missing authentication cookie' });
  }

  const session = db.prepare(`
    SELECT id, user_id, credential_id, created_at, expires_at, is_kiosk, ip_address, user_agent, last_active_at, dpop_public_key
    FROM sessions
    WHERE id = ?
  `).get(sessionId) as Session | undefined;

  if (!session) {
    return res.status(401).json({ error: 'Session invalid or terminated' });
  }
  if (!session.dpop_public_key) return res.status(401).json({ error: 'Browser-key binding required; sign in again', code: 'DEVICE_BINDING_REQUIRED' });

  const now = Date.now();
  if (session.expires_at < now) {
    return res.status(401).json({ error: 'Session expired' });
  }

  // If session is device-bound, enforce DPoP proof
  if (session.dpop_public_key) {
    const dpopHeader = req.headers['dpop'] as string | undefined;

    if (!dpopHeader) {
      // CRITICAL SECURITY EVENT: Stolen cookie replayed without device-bound private key
      try {
        db.prepare(`
          INSERT INTO audit_events (id, type, user_id, detail, timestamp)
          VALUES (?, 'SESSION_HIJACK_ATTEMPT_BLOCKED', ?, ?, ?)
        `).run(
          `aud_hijack_${crypto.randomBytes(8).toString('hex')}`,
          session.user_id,
          JSON.stringify({
            reason: 'DPoP proof missing on device-bound session',
            sessionId: session.id,
            ip: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'unknown',
            path: req.originalUrl || req.path,
          }),
          new Date().toISOString()
        );
      } catch {
        // ignore log error
      }

      return res.status(401).json({
        error: 'DPoP proof required for device-bound session. Stolen bearer cookie detected.',
        code: 'DPOP_PROOF_REQUIRED',
      });
    }

    const verification = verifyDPoPProof(
      dpopHeader,
      session.dpop_public_key,
      req.method,
      req.originalUrl || req.path
    );

    if (!verification.valid) {
      try {
        db.prepare(`
          INSERT INTO audit_events (id, type, user_id, detail, timestamp)
          VALUES (?, 'INVALID_DPOP_PROOF_REJECTED', ?, ?, ?)
        `).run(
          `aud_dpop_${crypto.randomBytes(8).toString('hex')}`,
          session.user_id,
          JSON.stringify({
            reason: verification.error,
            sessionId: session.id,
            ip: req.ip || '127.0.0.1',
          }),
          new Date().toISOString()
        );
      } catch {
        // ignore log error
      }

      return res.status(401).json({
        error: `Invalid DPoP proof: ${verification.error}`,
        code: 'DPOP_VERIFICATION_FAILED',
      });
    }
  }

  // Update last active
  db.prepare(`UPDATE sessions SET last_active_at = ? WHERE id = ?`).run(now, session.id);

  req.session = session;
  req.userId = session.user_id;

  next();
}
