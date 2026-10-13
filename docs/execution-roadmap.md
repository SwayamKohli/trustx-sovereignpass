# TrustX SovereignPass — Master Execution Steps & Roadmap

**Hackathon Problem Statement:** CyberCup 6.0 | CC6-IC04 (Theme 1: IoT & Cyber Security)  
**Timeline:** Day 2 (Preparation & Verification) and 24-Hour Campus Hackathon Sprint  

---

## 1. Day 2: Preparation, Scaffolding & Environment Verification

The goal of Day 2 is to eliminate technical uncertainty on the presentation machine before the hackathon begins. By the end of Day 2, core WebAuthn registration and login must work over local HTTPS, the database schema must be locked, and team API contracts must be finalized.

```
+----------------------------------------------------------------------------------------+
|                              DAY 2 MILESTONE TIMELINE                                  |
+----------------------------------------------------------------------------------------+
| PHASE 1 (Morning): Local HTTPS, Exact Origin Ports & Network Route Verification        |
| PHASE 2 (Midday): Monorepo Scaffolding & Database Schema Freeze                        |
| PHASE 3 (Afternoon): Core WebAuthn Proof-of-Concept & Two-Layer Origin Test            |
| PHASE 4 (Evening): Team Subsystem Stubs, API Contracts & Pre-Hackathon Freeze          |
+----------------------------------------------------------------------------------------+
```

### Phase 1: Local HTTPS & Exact Origin Configuration (Hours 0 - 2)

WebAuthn strictly requires a Secure Context (`HTTPS`), with `localhost` as an exception. Testing genuine versus look-alike origin defenses requires real local domains (`bank.local` and `b4nk-secure.local`).

1. **Install `mkcert` (Local Certificate Authority):**
   ```bash
   brew install mkcert   # macOS
   mkcert -install
   ```
2. **Generate Trusted Certificates:**
   ```bash
   mkdir -p certs
   mkcert -cert-file certs/cert.pem -key-file certs/key.pem bank.local b4nk-secure.local localhost 127.0.0.1
   ```
3. **Configure `/etc/hosts` on Presentation Machine:**
   ```text
   127.0.0.1 bank.local b4nk-secure.local
   ```
4. **Origin & Port Configuration Rule:**
   * Browser origins strictly include the port when non-default.
   * `https://bank.local:3000` is cryptographically distinct from `https://bank.local`.
   * Configure backend `expectedOrigin` to match the exact protocol, hostname, and port:
     ```typescript
     export const RP_ID = "bank.local";
     export const RP_NAME = "TrustX SovereignPass Bank";
     export const EXPECTED_ORIGIN = process.env.APP_ORIGIN || "https://bank.local:3000";
     ```
5. **Cross-Device Mobile Resolution Strategy (QR Login):**
   * A mobile phone cannot resolve `bank.local` if added only to the laptop's `/etc/hosts`.
   * Two viable architectural approaches:
     * **Approach A (Native FIDO2 Hybrid / caBLE — Recommended):** Use standard WebAuthn hybrid transport. The browser renders a native FIDO QR code; the phone communicates over Bluetooth/cloud relay without needing direct HTTP access to `bank.local`.
     * **Approach B (Custom Web Kiosk QR via Secure Tunnel):** Expose the local server through a secure tunnel:
       ```bash
       cloudflared tunnel --url https://localhost:3000
       ```
       The resulting public HTTPS URL is scanned by the smartphone for direct passkey confirmation.
6. **Milestone Verification:** Open `https://bank.local:3000` in your presentation browser (Chrome/Safari) and verify that the padlock appears with zero SSL warnings.

---

### Phase 2: Monorepo Scaffolding & Database Schema Freeze (Hours 2 - 4)

Set up a clean TypeScript monorepo in the project root:

1. **Repository Structure:**
   ```text
   TrustX/
   ├── certs/                      # mkcert local SSL certificates (git-ignored)
   ├── docs/                       # Specifications and roadmaps
   ├── packages/
   │   ├── backend/                # Node.js + Express + TypeScript
   │   │   ├── src/
   │   │   │   ├── config/         # RP ID, Origins, Port configs
   │   │   │   ├── db/             # SQLite (better-sqlite3) & migrations
   │   │   │   ├── routes/         # auth, recovery, devices, agent, admin
   │   │   │   ├── services/       # webauthn, recovery, risk, delegation
   │   │   │   └── server.ts
   │   └── frontend/               # React 18 + Vite + Tailwind CSS
   │       ├── src/
   │       │   ├── components/     # PasskeyPrompt, QRModal, DeviceTable
   │       │   ├── pages/          # Login, Register, Recovery, Dashboard, Lab
   │       │   └── App.tsx
   └── package.json
   ```
2. **Database Schema Freeze (`sqlite3` / `better-sqlite3`):**
   * **`users` Table:** `id` (UUID), `username` (text, unique), `created_at` (timestamp).
   * **`credentials` Table:** `id` (base64url credentialID), `user_id` (foreign key), `public_key` (blob), `counter` (integer), `transports` (json), `device_name` (text), `is_master` (boolean), `status` (text: 'ACTIVE' | 'REVOKED'), `created_at` (timestamp), `last_used_at` (timestamp).
   * **`recovery_codes` Table:** `id` (UUID), `user_id` (foreign key), `code_hash` (text - Argon2id hash), `consumed` (boolean), `consumed_at` (timestamp).
   * **`sessions` Table:** `id` (UUID), `user_id` (foreign key), `credential_id` (foreign key), `expires_at` (timestamp), `is_kiosk` (boolean), `ip_address` (text).
   * **`audit_events` Table:** `id` (UUID), `user_id` (text), `event_type` (text), `details` (json), `ip_address` (text), `timestamp` (ISO 8601 UTC).

---

### Phase 3: Core WebAuthn Proof-of-Concept & Origin Test (Hours 4 - 7)

1. **Backend Route Implementations:**
   * `POST /api/auth/register-challenge` -> Calls `generateRegistrationOptions` with `rpName: RP_NAME`, `rpID: RP_ID`.
   * `POST /api/auth/register-verify` -> Calls `verifyRegistrationResponse`, stores public key, generates 8 single-use recovery codes, and stores their Argon2id hashes.
   * `POST /api/auth/login-challenge` -> Calls `generateAuthenticationOptions` with `rpID: RP_ID`.
   * `POST /api/auth/login-verify` -> Calls `verifyAuthenticationResponse`, validates `expectedOrigin: EXPECTED_ORIGIN`, tracks counter, and sets an HttpOnly session cookie.
2. **Presentation Machine Verification:**
   * Open `https://bank.local:3000`. Register username -> Touch ID / Windows Hello prompt creates keypair.
   * Verify credential record created in SQLite.
   * Log out -> Click Sign In -> Authenticator verifies biometric assertion and establishes session.
3. **The Two-Layer Phishing Defense Test:**
   * *Layer 1 (Browser/Client RP ID Isolation):* Open `https://b4nk-secure.local:3001`. Attempt to sign in -> Authenticator discovers zero matching credentials for RP ID `b4nk-secure.local`, refusing to offer or sign with the genuine passkey.
   * *Layer 2 (Server-Side Verification):* Run test script submitting an assertion with origin `https://b4nk-secure.local:3001` to `https://bank.local:3000`. Relying party rejects assertion with `OriginMismatchError` and records an audit log.

---

### Phase 4: Subsystem Stubs, API Contracts & Pre-Hackathon Freeze (Hours 7 - 9)

1. **Agreed REST API Endpoints:**
   * `POST /api/recovery/verify-code` `{ username, recovery_code }`
   * `GET /api/devices/list` (Requires active session)
   * `POST /api/devices/revoke` `{ credential_id }` (Revokes credential and terminates session server-side)
   * `POST /api/agent/delegate-challenge` `{ action, recipient, max_amount }`
   * `POST /api/agent/execute-payment` `{ capability_token, payment_payload }`
   * `GET /api/admin/audit-logs`
2. **Day 2 Close Milestone:** Entire monorepo runs via a single command: `npm run dev`. Both frontend and backend start cleanly.

---

## 2. 24-Hour Campus Hackathon Sprint Schedule

> **Operational Guideline:** Sprint timings are target pacing guidelines, not fixed guarantees. The priority rule is strict: protect the core working authentication lifecycle and its verification tests first. Only claim "6/6 attacks defended" after all six automated tests pass live.

```
+----------------------------------------------------------------------------------------+
|                        24-HOUR TARGET SPRINT SCHEDULE (PACING)                         |
+----------------------------------------------------------------------------------------+
| HOURS 00:00 – 04:00 (SPRINT 1): Core Polish, Recovery Engine & Session Invalidation    |
| HOURS 04:00 – 08:00 (SPRINT 2): Device Management, Kiosk Mode & Phishing Lab Demo     |
| HOURS 08:00 – 12:00 (SPRINT 3): AI-Agent Capability Gateway & Prompt Injection Test    |
| HOURS 12:00 – 16:00 (SPRINT 4): Admin Dashboard, Risk Checks & CERT-In Log Model       |
| HOURS 16:00 – 20:00 (SPRINT 5): Automated Attack & Defense Lab + PQC Benchmark Script  |
| HOURS 20:00 – 24:00 (SPRINT 6): End-to-End Rehearsal, STRIDE Threat Model & Pitch     |
+----------------------------------------------------------------------------------------+
```

### Hours 00:00 - 04:00 | Core Polish & Account Recovery Engine (Sprint 1)
* **Lead:** Role 3 (Backend) & Role 2 (Frontend)
* **Milestones:**
  1. Frontend: High-contrast, clean UI screens for Login, Registration, and Recovery.
  2. Implement Recovery Code Generation:
     * Generate 8 single-use high-entropy codes (e.g., `A9F2-K891-M42L`). Display in modal with "Download Codes" option.
     * Store codes strictly as **Argon2id hashes** with salt.
     * Document that recovery codes are sensitive bearer secrets (must be kept offline; protected server-side by atomic consumption and rate-limiting).
  3. Build `POST /api/recovery/verify-code`: Validates code against Argon2id hash, marks `consumed = true` atomically, triggers replacement passkey enrollment, and marks lost device `status = 'REVOKED'`.
  4. Test Case: Attempting to reuse an already-consumed recovery code fails immediately (`400 Bad Request`).

---

### Hours 04:00 - 08:00 | Multi-Device Management, Kiosk Mode & Phishing Lab (Sprint 2)
* **Lead:** Role 1 (Security Lead) & Role 3 (Backend)
* **Milestones:**
  1. Multi-Device Enrollment: "Register New Device" button in dashboard requiring step-up authentication using active credential.
  2. Server-Side Session Invalidation:
     * When user clicks "Revoke Device" or "Log Out", server deletes session record from `sessions` table.
     * Protected API middleware checks session active status; invalidated sessions return `401 Unauthorized`.
  3. Shared-Device Kiosk Mode:
     * Public PC screen displays dynamic QR challenge (`/api/kiosk/qr-challenge`).
     * Smartphone scans QR, user approves with biometrics.
     * Public PC receives a 15-minute ephemeral server session. Server invalidates session after 15 minutes or upon logout.
  4. Phishing Demonstration Setup:
     * Finalize `https://b4nk-secure.local:3001` look-alike page.
     * Prepare side-by-side demonstration showing password interception on legacy site vs passkey origin isolation on genuine site.

---

### Hours 08:00 - 12:00 | AI-Agent Capability Delegation Gateway (Sprint 3 — Optional Extension)
* **Lead:** Role 4 (AI/Systems Lead)
* **Milestones:**
  1. Server Challenge Binding:
     * Passkey does not directly sign raw transaction data; it authorizes a server-bound challenge.
     * Backend constructs authentication challenge embedding transaction parameters:
       $$\text{challenge} = \text{SHA-256}(\text{user\_id} + \text{"POST /api/v1/payments"} + \text{"TataPower"} + 1800 + \text{nonce})$$
     * User authorizes challenge via biometric prompt in a standard WebAuthn ceremony.
  2. Capability Token Minting:
     * Server verifies assertion against challenge and issues signed HMAC-SHA256 capability token:
       `{ action, recipient, max_amount: 2000, expires_at, nonce }`
  3. Gateway Middleware:
     * Validates token signature, checks `amount <= max_amount`, confirms `recipient === approved_recipient`, checks unspent nonce.
  4. Adversarial Attack Demo:
     * Script prompt-injection attack attempting to alter recipient to `Attacker_Wallet` or amount to INR 50,000.
     * Gateway rejects with `403 Forbidden (Capability Constraint Violation)`.

---

### Hours 12:00 - 16:00 | Admin Dashboard, Risk Engine & Audit Trail (Sprint 4)
* **Lead:** Role 2 (Frontend) & Role 3 (Backend)
* **Milestones:**
  1. Admin SOC Dashboard:
     * Table of registered credentials, device models, and active sessions.
     * Live event feed displaying: `USER_LOGIN_SUCCESS`, `PHISHING_ORIGIN_REJECTED`, `RECOVERY_CODE_CONSUMED`, `DEVICE_REVOKED`, `AGENT_ACTION_BLOCKED`.
  2. Risk-Based Step-Up Checks:
     * If simulated login occurs from a new IP or client, flag `risk_score = HIGH` and demand explicit biometric re-authentication.
  3. Audit Logging Architecture:
     * Append-only database records with ISO 8601 UTC timestamps, designed with reference to CERT-In Rule 2(v) logging principles.

---

### Hours 16:00 - 20:00 | Automated Attack & Defense Lab + PQC Benchmark (Sprint 5)
* **Lead:** Role 1 (Security Lead) & Role 4 (Crypto Lead)
* **Milestones:**
  1. Attack & Defense Test Runner (`test_attacks.ts`):
     * Executes concrete attack probes:
       1. Origin Mismatch Probe (Assertion claiming wrong origin -> BLOCKED).
       2. Replayed Authentication Challenge (-> BLOCKED).
       3. Reused Recovery Code (-> BLOCKED).
       4. Revoked Credential Assertion (-> BLOCKED).
       5. Terminated Session Cookie Access (-> BLOCKED).
       6. AI Agent Prompt Injection Tampering (-> BLOCKED if Sprint 3 completed).
     * Displays test results live on dashboard (Report passing count honestly: e.g., 6/6 Defended).
  2. NIST FIPS 204 (ML-DSA) Post-Quantum Benchmark Script (Optional Research Stretch):
     * Standalone script comparing ECDSA (P-256) vs ML-DSA-44 keygen time, signature size (64B vs ~2,420B), and verification latency across 100 trials.
     * Generates comparison table for presentation slides as a migration readiness study.

---

### Hours 20:00 - 24:00 | Rehearsal, Threat Model & Pitch Polish (Sprint 6)
* **Lead:** Entire Team
* **Milestones:**
  1. Finalize STRIDE Threat Model Document (`THREAT_MODEL.md`) detailing covered mitigations and honest residual risks.
  2. Freeze code 2 hours before the deadline. Do not push last-minute untested changes.
  3. Rehearse 3-minute pitch 5 times:
     * Minute 1: The Problem (Fragility of passwords and SMS OTPs).
     * Minute 2: Live Demo (Genuine login -> Look-alike phishing deflection -> Recovery code use -> AI prompt-injection block).
     * Minute 3: Standards Alignment & Impact (Admin SOC view, PQC benchmark, and statutory principles).

---

## 3. Team Responsibilities & Ownership Matrix

| Role | Member | Title | Primary Focus | Key Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **Role 1** | **Adnan** | Security Lead & Attack/Defense Engineer | Threat modeling & attack automation | Controlled phishing proxy setup, `test_attacks.ts` suite, STRIDE threat model, judge Q&A defense. |
| **Role 2** | **Ananya** | Product, UI/UX & Admin SOC Lead | Frontend presentation & operational view | React UI, accessible prompts, QR modal, Admin SOC event log, presentation deck. |
| **Role 3** | **Sanchit** | Core Backend & Identity Lifecycle Lead | WebAuthn engine & state management | `@simplewebauthn` integration, Argon2id recovery codes, server-side session invalidation, SQLite schema. |
| **Role 4** | **Swayam** | Systems Integration & AI/Crypto Lead | Capability gateway & benchmarks | Challenge-bound AI delegation tokens, prompt-injection attack script, PQC benchmark script, end-to-end integration. |
