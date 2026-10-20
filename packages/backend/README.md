# TrustX SovereignPass — Backend (`@trustx/backend`)

The Core Backend provides phishing-resistant WebAuthn passwordless authentication, an embedded SQLite state engine with Argon2id cryptographic hashing, DPoP device-bound session enforcement, the PersistenceGuard credential firewall, the IntentLock action authorization gateway, and CERT-In-aligned audit logging.

---

## Technical Stack & Architecture

* **Runtime:** Node.js (v20+ recommended) with TypeScript and ESM resolution
* **HTTP Framework:** Express with native HTTPS SSL termination (`server.ts`)
* **Reverse Proxy:** `http-proxy-middleware` forwarding client traffic to internal Vite dev server (`:5173`)
* **WebAuthn Relying Party:** `@simplewebauthn/server` (FIDO2 / W3C WebAuthn Level 3)
* **Embedded Database:** `better-sqlite3` with strict foreign keys (`PRAGMA foreign_keys = ON;`)
* **Password Hashing & Recovery:** Argon2id salted bearer code hashing
* **Autonomous AI Red-Teamer:** Local Ollama integration (`qwen3:1.7b` / `llama3.2:1b`) with JSON structured attack planning

---

## Directory Structure

```text
packages/backend/
├── src/
│   ├── config/
│   │   ├── auth.config.ts             # WebAuthn RP ID, expected origin & timeout settings
│   │   └── server.config.ts           # Port assignments, certificates, and environment flags
│   ├── db/
│   │   ├── index.ts                   # Database connection singleton & schema migration runner
│   │   ├── schema.ts                  # 9 relational tables, indices, and type definitions
│   │   └── database.ts                # Database helper utilities
│   ├── middleware/
│   │   ├── auth.middleware.ts         # User session & role verification (USER vs ADMIN)
│   │   ├── dpop.middleware.ts         # Device-bound session proof-of-possession verification
│   │   ├── persistence.middleware.ts  # PersistenceGuard: credential persistence firewall
│   │   ├── risk.middleware.ts         # Contextual IP / browser novelty risk scoring
│   │   ├── session.middleware.ts      # HttpOnly SameSite cookie validation & absolute expiry
│   │   └── stepup.middleware.ts       # Single-use request-bound biometric step-up enforcement
│   ├── routes/
│   │   ├── admin.routes.ts            # SOC credentials, sessions, and audit log endpoints
│   │   ├── agent.routes.ts            # IntentLock AI capability minting & execution gateway
│   │   ├── auth.routes.ts             # Registration, login, step-up & persona switching
│   │   ├── crypto.routes.ts           # Cryptographic benchmarks & algorithm comparisons
│   │   ├── demo.routes.ts             # Multi-window live attack/defense demo controls
│   │   ├── devices.routes.ts          # Passkey device listing & immediate revocation
│   │   ├── kiosk.routes.ts            # Shared-terminal ephemeral sessions & QR pairing
│   │   ├── persistence.routes.ts      # PersistenceGuard live challenges & Ollama red-team jobs
│   │   └── recovery.routes.ts         # Two-phase lockout-safe emergency recovery
│   ├── services/
│   │   ├── agent.service.ts           # Capability token minting, intent hashing & validation
│   │   ├── audit-integrity.ts         # SHA-256 hash chaining & tamper-evident audit verification
│   │   ├── audit.service.ts           # Audit event ingestion & logging service
│   │   ├── live-probes.ts             # In-memory test runner for 10 canonical security probes
│   │   ├── login-risk.service.ts      # Anomaly scoring on changed browser/IP context
│   │   ├── persistence-agent.ts       # Ollama integration for autonomous red-team attacker
│   │   ├── persistence-challenge.ts   # Live challenge harness (baseline vs TrustX protected)
│   │   ├── recovery.service.ts        # Recovery code generation & Argon2id hash verification
│   │   ├── risk.service.ts            # Contextual risk engine logic
│   │   └── webauthn.service.ts        # Relying Party challenge generation & assertion verifiers
│   ├── scripts/
│   │   ├── export-audit-log.ts        # CERT-In compliant JSON/CSV audit log exporter
│   │   ├── grant-admin.ts             # CLI command to promote an existing user to ADMIN
│   │   └── test-challenges.ts         # WebAuthn challenge verification test
│   ├── server.ts                      # Main Express HTTPS server & reverse-proxy router (:3000)
│   └── phishing-server.ts             # Dedicated adversary lab HTTP server (:3001)
├── test/                              # Automated integration test suites
│   ├── intentlock.test.ts             # Action capability token isolation & replay tests
│   ├── kiosk.test.ts                  # Ephemeral session expiration & QR race condition tests
│   ├── live-demo.test.ts              # Live multi-window router probe tests
│   ├── login-risk.test.ts             # Browser novelty & step-up trigger tests
│   ├── payments.test.ts               # Ledger balance and step-up payment tests
│   ├── persistence.test.ts            # PersistenceGuard HTTP challenge & lockout tests
│   └── services.test.ts               # DPoP proof verification & prompt-injection tests
├── package.json
└── README.md
```

---

## Relational Database Schema (`src/db/schema.ts`)

The backend initializes an embedded SQLite database (`trustx.db` or `:memory:`) containing 9 normalized tables:

1. `users`: User identity, username, role (`USER` or `ADMIN`), and account creation timestamp.
2. `credentials`: Stored WebAuthn public keys, credential IDs, signature counters, device names, and status (`ACTIVE` or `REVOKED`).
3. `sessions`: Active user sessions, user foreign key, credential tracking, creation timestamp, and idle/absolute expiry.
4. `recovery_codes`: 8 emergency single-use bearer recovery codes stored exclusively as salted Argon2id hashes, tracking `consumed` state and timestamp.
5. `pending_recoveries`: Concurrency-safe two-phase recovery tickets (`ticket_id`, `verified_recovery_code_id`, replacement challenge, 5-minute expiry).
6. `kiosk_authorizations`: Ephemeral shared-terminal pairing state (`kiosk_session_id`, `token_hash`, private client secret hash, display confirmation code, 60s challenge expiry).
7. `step_up_authorizations`: Single-use action authorizations bound to `{ token, user_id, session_id, http_method, route, intent_hash, expires_at: 2m, consumed: 0/1 }`.
8. `delegation_intents`: Challenge-bound AI agent transaction capabilities (recipient, amount ceiling, single-use nonce, signature).
9. `audit_events`: Tamper-evident append-only security log with ISO 8601 UTC timestamps, event types, IP addresses, user IDs, and SHA-256 integrity hash chaining.

---

## Core Security Innovations Implemented

### 1. PersistenceGuard (Credential Persistence Firewall)
* Located in `middleware/persistence.middleware.ts` & `routes/persistence.routes.ts`.
* Strips all credential-altering permissions from standard sessions. Even if an attacker steals an active session cookie (via Infostealer malware), they **cannot** enroll a new passkey, revoke existing passkeys, or rotate recovery keys without a fresh, physical biometric passkey verification (`requireBiometricElevation`).
* Includes an automated red-team harness (`services/persistence-challenge.ts`) that executes live attacks from a local Ollama LLM (`persistence-agent.ts`) comparing a weak baseline against TrustX.

### 2. IntentLock / AgentShield (Action Authorization Firewall)
* Located in `services/agent.service.ts` & `routes/agent.routes.ts`.
* Eliminates the risk of hijacked sessions or compromised LLM assistants executing unauthorized payments.
* Requires a cryptographic single-use capability token bound to the exact recipient, amount ceiling, and single-use nonce. Any parameter modification (e.g. changing recipient or inflating amount) is strictly rejected with `HTTP 403 Forbidden`.

### 3. Device-Bound Sessions (DPoP — RFC 9449 Inspired)
* Located in `middleware/dpop.middleware.ts` & `services/dpop.service.ts`.
* Cryptographically binds the HTTP session cookie to an asymmetric keypair held in client browser IndexedDB (`CryptoKey`).
* Every protected request carries an ephemeral signed proof (`X-DPoP` header). A stolen cookie replayed from an attacker laptop lacking the private key is immediately rejected (`HTTP 401 DPOP_PROOF_REQUIRED`).

### 4. Safe Two-Phase Account Recovery
* Located in `routes/recovery.routes.ts` & `services/recovery.service.ts`.
* **Zero SMS Fallback:** Completely eliminates insecure SMS/voice OTPs.
* **Lockout Prevention:** Phase 1 validates the Argon2id recovery code hash and issues a replacement passkey registration challenge, but **does not burn the recovery code yet**. Phase 2 atomically verifies the new passkey, revokes the old credential, and burns the recovery code in a single atomic database transaction. If the user cancels halfway, their existing credentials remain completely safe.

### 5. Shared-Device Kiosk Ephemeral Engine
* Located in `routes/kiosk.routes.ts`.
* Generates dynamic cross-device QR challenges with an in-memory client secret.
* Citizen scans QR code with smartphone, authenticates biometrically, and authorizes a 15-minute ephemeral session on the kiosk terminal. Zero passkey residue or persistent credentials remain on the public computer.

---

## Backend Scripts & Commands

From the monorepo root or within `packages/backend`:

```bash
# Start backend in watch mode (Express HTTPS on port 3000)
npm run dev --workspace=@trustx/backend

# Start standalone attacker phishing server (Express on port 3001)
npm run dev:phishing --workspace=@trustx/backend

# Run all backend integration tests
npm test --workspace=@trustx/backend

# Run automated attack verification probes
npm run test:attacks --workspace=@trustx/backend

# Promote a registered user to Administrator
npm run admin:grant --workspace=@trustx/backend -- <username>

# Export CERT-In audit logs
npm run audit:export --workspace=@trustx/backend
```

---

## Primary Contributors

* **Sanchit Mishra** ([@san-10-max](https://github.com/san-10-max)) — Core backend routes (`auth.routes.ts`, `recovery.routes.ts`, `devices.routes.ts`, `kiosk.routes.ts`), WebAuthn ceremony integration (`webauthn.service.ts`), SQLite schema architecture (`schema.ts`), and session middleware.
* **Swayam Kohli** ([@SwayamKohli](https://github.com/SwayamKohli)) — Express HTTPS server (`server.ts`), DPoP device-bound session engine (`dpop.middleware.ts`), IntentLock capability gateway (`agent.service.ts`), dynamic risk scoring (`risk.middleware.ts`), and demographic personas.
* **Syed Adnan Ahmed Hanfi** ([@Theshyguy01](https://github.com/Theshyguy01)) — Attack probe integration (`live-probes.ts`), adversary phishing server (`phishing-server.ts`), and audit log export tool.
