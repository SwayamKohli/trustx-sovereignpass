// Post-Quantum Cryptography & FIDO2 Hardware Key Verification Endpoints
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { performance } from 'perf_hooks';

const router = Router();

export interface BenchmarkResult {
  algorithm: string;
  type: 'Classical (Pre-Quantum)' | 'Post-Quantum (NIST FIPS 204)';
  nistStandard: string;
  quantumResistant: boolean;
  shorAlgorithmVulnerable: boolean;
  publicKeyBytes: number;
  privateKeyBytes: number;
  signatureBytes: number;
  avgKeyGenMs: number;
  avgSignMs: number;
  avgVerifyMs: number;
  throughputSignOpsSec: number;
  throughputVerifyOpsSec: number;
}

/**
 * GET /api/crypto/pqc-benchmark
 * Executes real live cryptographic trials comparing Classical ECDSA P-256 vs NIST FIPS 204 ML-DSA-44.
 */
router.get('/pqc-benchmark', async (req: Request, res: Response) => {
  try {
    const ITERATIONS = 20;
    const sampleChallenge = Buffer.from('TrustX-WebAuthn-Auth-Assertion-Challenge-2026-NIST-PQC-Evaluation');

    // 1. Classical ECDSA P-256 (prime256v1)
    let ecdsaKeyGenTotal = 0;
    let ecdsaSignTotal = 0;
    let ecdsaVerifyTotal = 0;
    let ecdsaPubKeySize = 0;
    let ecdsaPrivKeySize = 0;
    let ecdsaSigSize = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const t0 = performance.now();
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const t1 = performance.now();
      ecdsaKeyGenTotal += t1 - t0;

      const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
      const pubDer = publicKey.export({ type: 'spki', format: 'der' });
      ecdsaPubKeySize = pubDer.length;
      ecdsaPrivKeySize = privDer.length;

      const t2 = performance.now();
      const signature = crypto.sign('sha256', sampleChallenge, privateKey);
      const t3 = performance.now();
      ecdsaSignTotal += t3 - t2;
      ecdsaSigSize = signature.length;

      const t4 = performance.now();
      const valid = crypto.verify('sha256', sampleChallenge, publicKey, signature);
      const t5 = performance.now();
      ecdsaVerifyTotal += t5 - t4;

      if (!valid) throw new Error('Classical ECDSA verification failed');
    }

    const classical: BenchmarkResult = {
      algorithm: 'ECDSA P-256 (WebAuthn ES256)',
      type: 'Classical (Pre-Quantum)',
      nistStandard: 'FIPS 186-5 (Elliptic Curve)',
      quantumResistant: false,
      shorAlgorithmVulnerable: true,
      publicKeyBytes: ecdsaPubKeySize,
      privateKeyBytes: ecdsaPrivKeySize,
      signatureBytes: ecdsaSigSize,
      avgKeyGenMs: Number((ecdsaKeyGenTotal / ITERATIONS).toFixed(3)),
      avgSignMs: Number((ecdsaSignTotal / ITERATIONS).toFixed(3)),
      avgVerifyMs: Number((ecdsaVerifyTotal / ITERATIONS).toFixed(3)),
      throughputSignOpsSec: Math.round(1000 / (ecdsaSignTotal / ITERATIONS)),
      throughputVerifyOpsSec: Math.round(1000 / (ecdsaVerifyTotal / ITERATIONS)),
    };

    // 2. Post-Quantum ML-DSA-44 (Dilithium2)
    let postQuantum: BenchmarkResult;
    try {
      const { ml_dsa44 } = await import('@noble/post-quantum/ml-dsa.js');

      let mlDsaKeyGenTotal = 0;
      let mlDsaSignTotal = 0;
      let mlDsaVerifyTotal = 0;
      let publicKeyBytes = 0, privateKeyBytes = 0, signatureBytes = 0;

      for (let i = 0; i < ITERATIONS; i++) {
        const t0 = performance.now();
        const keys = ml_dsa44.keygen();
        const t1 = performance.now();
        mlDsaKeyGenTotal += t1 - t0;

        const t2 = performance.now();
        const signature = ml_dsa44.sign(sampleChallenge, keys.secretKey);
        const t3 = performance.now();
        mlDsaSignTotal += t3 - t2;
        publicKeyBytes = keys.publicKey.length; privateKeyBytes = keys.secretKey.length; signatureBytes = signature.length;

        const t4 = performance.now();
        const valid = ml_dsa44.verify(signature, sampleChallenge, keys.publicKey);
        const t5 = performance.now();
        mlDsaVerifyTotal += t5 - t4;

        if (!valid) throw new Error('ML-DSA-44 verification failed');
      }

      postQuantum = {
        algorithm: 'ML-DSA-44 (Dilithium2)',
        type: 'Post-Quantum (NIST FIPS 204)',
        nistStandard: 'FIPS 204 (Module-Lattice)',
        quantumResistant: true,
        shorAlgorithmVulnerable: false,
        publicKeyBytes,
        privateKeyBytes,
        signatureBytes,
        avgKeyGenMs: Number((mlDsaKeyGenTotal / ITERATIONS).toFixed(3)),
        avgSignMs: Number((mlDsaSignTotal / ITERATIONS).toFixed(3)),
        avgVerifyMs: Number((mlDsaVerifyTotal / ITERATIONS).toFixed(3)),
        throughputSignOpsSec: Math.round(1000 / (mlDsaSignTotal / ITERATIONS)),
        throughputVerifyOpsSec: Math.round(1000 / (mlDsaVerifyTotal / ITERATIONS)),
      };
    } catch {
      throw new Error('ML-DSA benchmark unavailable; no substitute measurements were generated');
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      iterations: ITERATIONS,
      classical,
      postQuantum,
      analysis: {
        publicKeyRatio: Number((postQuantum.publicKeyBytes / classical.publicKeyBytes).toFixed(1)),
        signatureRatio: Number((postQuantum.signatureBytes / classical.signatureBytes).toFixed(1)),
        keyGenSpeedup: classical.avgKeyGenMs > 0 ? Number((classical.avgKeyGenMs / postQuantum.avgKeyGenMs).toFixed(1)) : 1,
        signLatencyDelta: Number((postQuantum.avgSignMs - classical.avgSignMs).toFixed(3)),
        verdict: `Observed ML-DSA-44 signature payload is ${(postQuantum.signatureBytes / classical.signatureBytes).toFixed(1)}x the ECDSA DER signature payload. Standalone migration benchmark; not post-quantum WebAuthn login.`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'PQC_BENCHMARK_FAILED', message: err.message });
  }
});

/**
 * GET /api/crypto/fido2-capabilities
 * Returns hardware authenticators, algorithms, and cryptographic specifications supported by TrustX.
 */
router.get('/fido2-capabilities', (req: Request, res: Response) => {
  res.json({
    status: 'ACTIVE',
    scope: 'Configuration reference only; not detection or attestation of connected hardware.',
    supportedAlgorithms: [
      { id: -7, name: 'ES256', curve: 'P-256', description: 'ECDSA over SHA-256 (Default Apple Touch ID, Face ID, Windows Hello, YubiKey 5)' },
      { id: -8, name: 'Ed25519', curve: 'Ed25519', description: 'EdDSA Edwards-curve (High-performance modern FIDO2 keys)' },
      { id: -257, name: 'RS256', curve: 'RSA-2048', description: 'RSASSA-PKCS1-v1_5 (Legacy enterprise compatibility)' },
    ],
    supportedTransports: ['usb', 'nfc', 'ble', 'internal', 'hybrid'],
    authenticatorAttachmentModes: ['platform', 'cross-platform'],
    residentKeyRequirement: 'preferred',
    userVerificationRequirement: 'required',
    dpopProofSpecification: 'Custom method/path/time/identifier-bound ES256 browser proof; not full RFC 9449 conformance',
    pqcRoadmap: 'Standalone ML-DSA benchmark only; no hybrid FIDO2 integration implemented',
  });
});

export default router;
