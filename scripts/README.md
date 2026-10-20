# Automation & Benchmark Scripts (`scripts/`)

This directory contains runtime orchestration utilities, cross-device launcher scripts, and cryptographic benchmark suites for TrustX SovereignPass.

---

## Directory Overview

```text
scripts/
├── start-dev.cjs          # Smart stack launcher & port occupancy supervisor
├── start-dev.test.cjs     # Unit tests for launcher state machine
├── benchmarks/            # Cryptographic benchmark suites
│   ├── README.md          # Benchmark guide & performance characteristics
│   └── pqc_benchmark.ts   # NIST FIPS 204 (ML-DSA-44) vs ECDSA P-256 evaluation
└── README.md              # Directory documentation
```

---

## Script Breakdown

### 1. `start-dev.cjs` (Unified Stack Supervisor)
* **Command:** `npm run dev` or `npm run dev:phone`
* **Purpose:** Single-entrypoint orchestration that launches:
  * Bank Backend (`:3000`)
  * Internal Vite Frontend (`:5173`)
  * Controlled Attacker Lab (`:3001`)
* **Key Features:**
  * **Port Conflict & Health Detection:** Inspects listening sockets before spawning processes. If an existing complete stack is already running healthy, it safely detects and reuses it without killing background processes.
  * **Phone / LAN Support (`--phone`):** Loads `.env.phone` configuration with explicit LAN IP and enforces HTTPS certificate presence for live iPhone/Android passkey pairing.
  * **Zero-Config HTTP Fallback:** Dynamically toggles between trusted HTTPS (`bank.local:3000`) and loopback HTTP (`localhost:3000`) depending on certificate presence and environment flags.

### 2. `start-dev.test.cjs` (Launcher Test Harness)
* **Command:** `node --test scripts/start-dev.test.cjs`
* **Purpose:** Built-in Node.js test runner suite verifying the port conflict decision state machine and socket listener occupancy detection.

### 3. `benchmarks/pqc_benchmark.ts` (Post-Quantum Cryptography Benchmark)
* **Command:** `npm run benchmark:pqc`
* **Purpose:** Standalone research benchmark measuring key generation latency, signature sizes, and verification throughput comparing classical ECDSA P-256 vs NIST Post-Quantum standard ML-DSA-44 (Dilithium).

---

## Primary Contributors

* **Swayam Kohli** ([@SwayamKohli](https://github.com/SwayamKohli)) — Stack supervisor architecture, socket health state machine, post-quantum benchmark suite (`pqc_benchmark.ts`), and mobile rehearsal tooling.
