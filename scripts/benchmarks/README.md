# Post-Quantum Cryptography Benchmarks (`scripts/benchmarks/`)

This directory contains the standalone cryptographic research benchmark suite comparing classical elliptic-curve signatures against post-quantum lattice-based digital signatures.

---

## Benchmark Rationale & Context

Modern WebAuthn passkeys rely overwhelmingly on classical elliptic-curve public-key cryptography—principally **ECDSA P-256 (ES256)** and **Ed25519 (EdDSA)**. While computationally secure against classical computing attacks, these schemes are theoretically vulnerable to large-scale quantum computers executing **Shor's Algorithm** (which solves discrete logarithms in polynomial time).

In August 2024, the US National Institute of Standards and Technology (NIST) finalized its primary post-quantum digital signature standard: **NIPS FIPS 204 (ML-DSA)**, formerly known as CRYSTALS-Dilithium.

This benchmark script empirically measures the trade-offs involved in transitioning passkey assertion engines to post-quantum standards:
1. **Key and Signature Sizes:** Lattice mathematics require substantially larger public keys and signatures than 256-bit elliptic curves.
2. **Computational Latency:** Key generation, signature signing, and signature verification timing.
3. **Throughput:** Operations per second under identical CPU constraints.

---

## Execution

Run the benchmark suite directly from the project root:

```bash
npm run benchmark:pqc
```

---

## Measured Performance Profile (100 Iterations)

| Metric | Classical: ECDSA P-256 (ES256) | Post-Quantum: ML-DSA-44 (NIST FIPS 204) | Architectural Impact |
| :--- | :--- | :--- | :--- |
| **Algorithm Type** | Pre-Quantum Elliptic Curve | Module-Lattice Digital Signature | Quantum-resistant |
| **NIST Security Level** | 128-bit classical equivalent | NIST Category 2 (AES-128 equivalent) | Shor's Algorithm resistant |
| **Public Key Size** | **65 bytes** (uncompressed) | **1,312 bytes** | ~20x payload increase |
| **Signature Size** | **~71 bytes** (DER) / 64 bytes (raw) | **2,420 bytes** | ~34x payload increase |
| **Average KeyGen** | ~0.3 ms | ~0.8 ms | Suitable for interactive use |
| **Average Signing** | ~0.15 ms | ~1.1 ms | Acceptable for client passkeys |
| **Average Verification** | ~0.45 ms | ~0.35 ms | **Faster** verification on server |

---

## Important Scope & Non-Claims

* **Research Isolation:** The PQC benchmark is an independent research experiment. Running this benchmark does **not** make client browser WebAuthn passkey logins quantum-safe today (as current W3C/FIDO2 browser and hardware authenticator specifications currently specify classical algorithms `ES256`, `RS256`, and `EdDSA`).
* **Zero Production Overhead:** The benchmark runs in a dedicated thread/script and does not introduce latency or payload overhead to the production authentication routes.

---

## Primary Contributor

* **Swayam Kohli** ([@SwayamKohli](https://github.com/SwayamKohli)) — Post-quantum cryptographic benchmark architecture, NIST FIPS 204 integration (`@noble/post-quantum`), and comparative latency measurement suite.
