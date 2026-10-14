// TrustX SovereignPass — NIST FIPS 204 (ML-DSA) Post-Quantum Benchmark
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import crypto from 'crypto';
import { performance } from 'perf_hooks';

interface BenchmarkMetrics {
  algorithm: string;
  type: 'Classical (Pre-Quantum)' | 'Post-Quantum (NIST FIPS 204)';
  nistSecurityCategory: string;
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

async function runBenchmark(): Promise<void> {
  console.log('='.repeat(80));
  console.log(' TRUSTX SOVEREIGNPASS: CRYPTOGRAPHIC BENCHMARK SUITE');
  console.log(' Comparing Classical ECDSA P-256 (WebAuthn ES256) vs NIST FIPS 204 ML-DSA-44');
  console.log('='.repeat(80));
  console.log('\nRunning cryptographic trials (Warmup: 10, Measured: 100 iterations)...\n');

  const ITERATIONS = 100;
  const sampleChallenge = Buffer.from('TrustX-WebAuthn-Auth-Assertion-Challenge-2026-NIST-PQC-Evaluation');

  // ==========================================
  // 1. Classical ECDSA P-256 (prime256v1)
  // ==========================================
  let ecdsaKeyGenTotal = 0;
  let ecdsaSignTotal = 0;
  let ecdsaVerifyTotal = 0;

  let ecdsaPubKeySize = 0;
  let ecdsaPrivKeySize = 0;
  let ecdsaSigSize = 0;

  // Warmup
  for (let i = 0; i < 10; i++) {
    const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const sig = crypto.sign('sha256', sampleChallenge, pair.privateKey);
    crypto.verify('sha256', sampleChallenge, pair.publicKey, sig);
  }

  // Measurement
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

  const ecdsaMetrics: BenchmarkMetrics = {
    algorithm: 'ECDSA P-256 (FIPS 186-5)',
    type: 'Classical (Pre-Quantum)',
    nistSecurityCategory: 'Level 1 (128-bit classical)',
    quantumResistant: false,
    shorAlgorithmVulnerable: true,
    publicKeyBytes: ecdsaPubKeySize,
    privateKeyBytes: ecdsaPrivKeySize,
    signatureBytes: ecdsaSigSize,
    avgKeyGenMs: ecdsaKeyGenTotal / ITERATIONS,
    avgSignMs: ecdsaSignTotal / ITERATIONS,
    avgVerifyMs: ecdsaVerifyTotal / ITERATIONS,
    throughputSignOpsSec: Math.round(1000 / (ecdsaSignTotal / ITERATIONS)),
    throughputVerifyOpsSec: Math.round(1000 / (ecdsaVerifyTotal / ITERATIONS)),
  };

  // ==========================================
  // 2. Post-Quantum NIST ML-DSA-44 (Dilithium2)
  // ==========================================
  // Dynamically load noble post-quantum module
  const { ml_dsa44 } = await import('@noble/post-quantum/ml-dsa.js');

  let mlDsaKeyGenTotal = 0;
  let mlDsaSignTotal = 0;
  let mlDsaVerifyTotal = 0;

  // Warmup
  for (let i = 0; i < 10; i++) {
    const keys = ml_dsa44.keygen();
    const sig = ml_dsa44.sign(sampleChallenge, keys.secretKey);
    ml_dsa44.verify(sig, sampleChallenge, keys.publicKey);
  }

  // Measurement
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    const keys = ml_dsa44.keygen();
    const t1 = performance.now();
    mlDsaKeyGenTotal += t1 - t0;

    const t2 = performance.now();
    const signature = ml_dsa44.sign(sampleChallenge, keys.secretKey);
    const t3 = performance.now();
    mlDsaSignTotal += t3 - t2;

    const t4 = performance.now();
    const valid = ml_dsa44.verify(signature, sampleChallenge, keys.publicKey);
    const t5 = performance.now();
    mlDsaVerifyTotal += t5 - t4;

    if (!valid) throw new Error('ML-DSA-44 verification failed');
  }

  const mlDsaMetrics: BenchmarkMetrics = {
    algorithm: 'ML-DSA-44 (NIST FIPS 204)',
    type: 'Post-Quantum (NIST FIPS 204)',
    nistSecurityCategory: 'Level 2 (SHA-256 equivalent)',
    quantumResistant: true,
    shorAlgorithmVulnerable: false,
    publicKeyBytes: ml_dsa44.lengths.publicKey ?? 1312,
    privateKeyBytes: ml_dsa44.lengths.secretKey ?? 2560,
    signatureBytes: ml_dsa44.lengths.signature ?? 2420,
    avgKeyGenMs: mlDsaKeyGenTotal / ITERATIONS,
    avgSignMs: mlDsaSignTotal / ITERATIONS,
    avgVerifyMs: mlDsaVerifyTotal / ITERATIONS,
    throughputSignOpsSec: Math.round(1000 / (mlDsaSignTotal / ITERATIONS)),
    throughputVerifyOpsSec: Math.round(1000 / (mlDsaVerifyTotal / ITERATIONS)),
  };

  // ==========================================
  // Print Detailed Benchmark Summary
  // ==========================================
  console.log('| Metric | Classical ECDSA P-256 | Post-Quantum ML-DSA-44 | Delta / Tradeoff |');
  console.log('| :--- | :--- | :--- | :--- |');
  console.log(`| **NIST Specification** | FIPS 186-5 (Elliptic Curve) | FIPS 204 (Module-Lattice) | NIST PQC Standardized (2024) |`);
  console.log(`| **Quantum Resistance** | ❌ Broken by Shor's Algo | ✅ Quantum-Resistant | Level 2 Security |`);
  console.log(`| **Public Key Size** | ${ecdsaMetrics.publicKeyBytes} bytes | ${mlDsaMetrics.publicKeyBytes} bytes | ${(mlDsaMetrics.publicKeyBytes / ecdsaMetrics.publicKeyBytes).toFixed(1)}x larger |`);
  console.log(`| **Private Key Size** | ${ecdsaMetrics.privateKeyBytes} bytes | ${mlDsaMetrics.privateKeyBytes} bytes | ${(mlDsaMetrics.privateKeyBytes / ecdsaMetrics.privateKeyBytes).toFixed(1)}x larger |`);
  console.log(`| **Signature Size** | ${ecdsaMetrics.signatureBytes} bytes | ${mlDsaMetrics.signatureBytes} bytes | ${(mlDsaMetrics.signatureBytes / ecdsaMetrics.signatureBytes).toFixed(1)}x larger |`);
  console.log(`| **Avg KeyGen Latency** | ${ecdsaMetrics.avgKeyGenMs.toFixed(3)} ms | ${mlDsaMetrics.avgKeyGenMs.toFixed(3)} ms | ${mlDsaMetrics.avgKeyGenMs < ecdsaMetrics.avgKeyGenMs ? 'Faster' : 'Slower'} |`);
  console.log(`| **Avg Sign Latency** | ${ecdsaMetrics.avgSignMs.toFixed(3)} ms | ${mlDsaMetrics.avgSignMs.toFixed(3)} ms | ${mlDsaMetrics.avgSignMs < ecdsaMetrics.avgSignMs ? 'Faster' : 'Slower'} |`);
  console.log(`| **Avg Verify Latency** | ${ecdsaMetrics.avgVerifyMs.toFixed(3)} ms | ${mlDsaMetrics.avgVerifyMs.toFixed(3)} ms | ${mlDsaMetrics.avgVerifyMs < ecdsaMetrics.avgVerifyMs ? 'Faster' : 'Slower'} |`);
  console.log(`| **Sign Throughput** | ${ecdsaMetrics.throughputSignOpsSec.toLocaleString()} ops/sec | ${mlDsaMetrics.throughputSignOpsSec.toLocaleString()} ops/sec | Real CPU throughput |`);
  console.log(`| **Verify Throughput** | ${ecdsaMetrics.throughputVerifyOpsSec.toLocaleString()} ops/sec | ${mlDsaMetrics.throughputVerifyOpsSec.toLocaleString()} ops/sec | Real CPU throughput |`);

  console.log('\n' + '='.repeat(80));
  console.log(' ARCHITECTURAL SYNTHESIS FOR JUDGES:');
  console.log(' - WebAuthn currently standardizes ES256 (ECDSA P-256) and Ed25519 in authenticators.');
  console.log(' - ML-DSA-44 provides mathematical quantum-immunity, but signature payloads (2,420 bytes)');
  console.log('   are ~34x larger than ECDSA (71 bytes), creating NFC/BLE transmission overhead on tokens.');
  console.log(' - TrustX SovereignPass is designed crypto-agile: ready to adopt hybrid post-quantum');
  console.log('   FIDO2 credentials as soon as W3C/FIDO Alliance finalizes FIPS 204 authenticator extensions.');
  console.log('='.repeat(80) + '\n');
}

runBenchmark().catch(err => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
