# TrustX SovereignPass — Master Execution Steps & Roadmap
**Step-by-Step Blueprint for Day 2 (Preparation & Verification) and the 24-Hour Campus Hackathon Sprint**  
**Hackathon Problem Statement:** CyberCup 6.0 | CC6-IC04 (Theme 1: IoT & Cyber Security)  

---

## 1. Day 2: Preparation, Scaffolding & Environment Verification (Tomorrow)

The goal of Day 2 is to **eliminate all technical uncertainty on your actual presentation laptop**. By the end of Day 2, the core WebAuthn registration and login must work over local HTTPS, the database schema must be locked, and team API contracts must be finalized.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              DAY 2 MILESTONE TIMELINE                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1 (Morning): Local HTTPS, Exact Origin Ports & Network Route Verification        │
│ PHASE 2 (Midday): Monorepo Scaffolding & Database Schema Freeze                        │
│ PHASE 3 (Afternoon): Core WebAuthn Proof-of-Concept & Two-Layer Origin Test            │
│ PHASE 4 (Evening): Team Subsystem Stubs, API Contracts & Pre-Hackathon Freeze          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Local HTTPS & Exact Origin Configuration (Hours 0 – 2)
*WebAuthn strictly requires a Secure Context (`HTTPS`), with `localhost` as an exception. However, demonstrating genuine vs. look-alike origin defenses requires real local domains (`bank.local` and `b4nk-secure.local`).*

1. **Install `mkcert` (Local Certificate Authority):**
   ```bash
   brew install mkcert   # on macOS
   mkcert -install
   ```
2. **Generate Trusted Certificates:**
   ```bash
   mkdir -p certs
   mkcert -cert-file certs/cert.pem -key-file certs/key.pem bank.local b4nk-secure.local localhost 127.0.0.1
   ```
3. **Configure `/etc/hosts` on Presentation Laptop:**
   ```text
   127.0.0.1 bank.local b4nk-secure.local
   ```
4. **Critical WebAuthn Origin & Port Rule:**
   * In WebAuthn and browser origin policy, the origin **strictly includes the port when non-default**.
   * `https://bank.local:3000` is **cryptographically distinct** from `https://bank.local`.
   * Configure backend `expectedOrigin` to match the exact protocol, hostname, and port:
     ```typescript
     // config/auth.config.ts
     export const RP_ID = "bank.local";
     export const RP_NAME = "TrustX SovereignPass Bank";
     export const EXPECTED_ORIGIN = process.env.APP_ORIGIN || "https://bank.local:3000";
     ```
5. **Cross-Device Mobile Resolution Strategy (QR Login):**
   * *The Networking Reality:* A mobile phone **cannot** resolve `bank.local` merely because it was added to the laptop's `/etc/hosts`.
   * Two viable architectural options for Cross-Device / Kiosk Demo:
     * **Approach A (Native FIDO2 Hybrid / caBLE — Recommended):** Use standard WebAuthn hybrid transport. The browser itself renders a native FIDO QR code. The phone scans it via system camera and communicates over Bluetooth/cloud relay without needing HTTP access to `bank.local`.
     * **Approach B (Custom Web Kiosk QR via Tunnel):** If demonstrating a custom web QR approval flow, expose the local server using a quick secure tunnel:
       ```bash
       cloudflared tunnel --url https://localhost:3000
       ```
       The resulting public HTTPS URL (e.g., `https://trustx-demo.trycloudflare.com`) is scanned by the phone, allowing direct HTTPS resolution and passkey confirmation.
6. **Milestone Check:** Open `https://bank.local:3000` in your presentation browser (Chrome/Safari) and verify that the green padlock appears with zero SSL warnings.

---

### Phase 2: Monorepo Scaffolding & Database Schema Freeze (Hours 2 – 4)
Set up a clean, TypeScript monorepo combining frontend and backend in `/Users/swayamkohli/Documents/TrustX`.

1. **Repository Structure:**
   ```text
   TrustX/
   ├── certs/                      # mkcert local SSL certificates
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
   - **`users` Table:** `id` (UUID), `username` (text, unique), `created_at` (timestamp).
   - **`credentials` Table:** `id` (base64url credentialID), `user_id` (foreign key), `public_key` (blob), `counter` (integer), `transports` (json), `device_name` (text), `is_master` (boolean), `status` (text: 'ACTIVE' | 'REVOKED'), `created_at` (timestamp), `last_used_at` (timestamp).
   - **`recovery_codes` Table:** `id` (UUID), `user_id` (foreign key), `code_hash` (text - **Argon2id hash**), `consumed` (boolean), `consumed_at` (timestamp).
   - **`sessions` Table:** `id` (UUID), `user_id` (foreign key), `credential_id` (foreign key), `expires_at` (timestamp), `is_kiosk` (boolean), `ip_address` (text).
   - **`audit_events` Table:** `id` (UUID), `user_id` (text), `event_type` (text), `details` (json), `ip_address` (text), `timestamp` (ISO 8601).

---

### Phase 3: Core WebAuthn Proof-of-Concept & Two-Layer Origin Test (Hours 4 – 7)
*Prove the foundation on your presentation laptop before touching UI styling.*
1. **Backend Route Implementations:**
   - `POST /api/auth/register-challenge` $\to$ Calls `generateRegistrationOptions` with `rpName: RP_NAME`, `rpID: RP_ID`.
   - `POST /api/auth/register-verify` $\to$ Calls `verifyRegistrationResponse`, stores public key, generates 8 high-entropy single-use recovery codes, and stores their **Argon2id hashes**.
   - `POST /api/auth/login-challenge` $\to$ Calls `generateAuthenticationOptions` with `rpID: RP_ID`.
   - `POST /api/auth/login-verify` $\to$ Calls `verifyAuthenticationResponse`, checks `expectedOrigin: EXPECTED_ORIGIN`, tracks counter (treating counter=0 as normal for platform authenticators), and sets an HttpOnly session cookie.
2. **Presentation Laptop Verification:**
   - Open `https://bank.local:3000`. Click Register $\to$ Touch ID / Windows Hello prompt appears.
   - Complete registration $\to$ Verify credential record is created in SQLite.
   - Log out $\to$ Click Sign In $\to$ Biometric prompt verifies and logs in.
3. **The Two-Layer Phishing Defense Test:**
   * *Layer 1 (Browser/Client-Side RP ID Isolation):*
     - Open `https://b4nk-secure.local:3001` (mock phishing site).
     - Attempt to sign in $\to$ The browser/authenticator discovers **zero matching credentials** for RP ID `b4nk-secure.local`. Touch ID / Windows Hello will not even offer the genuine passkey. The private key is never unlocked or exposed.
   * *Layer 2 (Server-Side Origin Mismatch Rejection):*
     - Run a test script (`test_attacks.ts`) that submits an assertion signed with origin `https://b4nk-secure.local:3001` to the genuine backend `https://bank.local:3000`.
     - Backend's `verifyAuthenticationResponse` immediately throws `OriginMismatchError`, blocks the login, and writes a `PHISHING_ATTACK_DEFENDED` record to the audit ledger.

---

### Phase 4: Subsystem Stubs, API Contracts & Team Freeze (Hours 7 – 9)
Lock down all REST API contracts so the four team members can work independently on Hackathon Day without blocking each other.

1. **Agreed API Endpoints:**
   - `POST /api/recovery/verify-code` `{ username, recovery_code }`
   - `GET /api/devices/list` (Requires active session)
   - `POST /api/devices/revoke` `{ credential_id }` (Revokes credential and terminates session server-side)
   - `POST /api/agent/delegate-challenge` `{ action, recipient, max_amount }`
   - `POST /api/agent/execute-payment` `{ capability_token, payment_payload }`
   - `GET /api/admin/audit-logs`
2. **Day 2 Close Milestone:** Entire monorepo runs via a single command: `npm run dev`. Both frontend and backend start up, and the core passkey ceremony is verified.

---

## 2. 24-Hour Campus Hackathon Sprint Schedule

> [!IMPORTANT]
> **Sprint Timings are Target Pacing Guidelines, Not Guarantees.**  
> Hackathons are unpredictable. The priority rule is strict: **protect the core working authentication lifecycle and its verification tests first**. Only expand into stretch features (AI delegation, PQC benchmark) once P0 passkeys, recovery, and revocation are bulletproof. Only claim *"6/6 attacks defended"* after all six automated tests pass live.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        24-HOUR TARGET SPRINT SCHEDULE (PACING)                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ HOURS 00:00 – 04:00 (SPRINT 1): Core Polish, Recovery Engine & Session Invalidation    │
│ HOURS 04:00 – 08:00 (SPRINT 2): Device Management, Kiosk Mode & Phishing Lab Demo     │
│ HOURS 08:00 – 12:00 (SPRINT 3): AI-Agent Capability Gateway & Prompt Injection Test    │
│ HOURS 12:00 – 16:00 (SPRINT 4): Admin Dashboard, Risk Checks & CERT-In Log Model       │
│ HOURS 16:00 – 20:00 (SPRINT 5): Automated Attack & Defense Lab + PQC Benchmark Script  │
│ HOURS 20:00 – 24:00 (SPRINT 6): End-to-End Rehearsal, STRIDE Threat Model & Pitch     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Hours 00:00 – 04:00 | Core Polish & Account Recovery Engine (Sprint 1)
* **Lead:** Member C (Backend) & Member B (Frontend)
* **Milestones:**
  1. Frontend: High-contrast, clean UI screens for Login, Registration, and Recovery.
  2. Implement Recovery Code Generation:
     - Generate 8 single-use high-entropy codes (e.g., `A9F2-K891-M42L`). Display in modal with "Download Codes" button.
     - **Cryptographic Storage:** Hash codes strictly with **Argon2id** and store hashes in `recovery_codes` table.
     - **Security Semantics:** Document that recovery codes are **sensitive bearer secrets** (like backup keys/passwords); they are out-of-band recovery instruments, not origin-bound like passkeys. Rate-limit attempts and consume atomically.
  3. Build `POST /api/recovery/verify-code`: Validates code against Argon2id hash, marks `consumed = true` atomically, triggers replacement passkey enrollment, and marks lost device `status = 'REVOKED'`.
  4. Test Case: Attempting to reuse an already-consumed recovery code fails immediately (`400 Bad Request`).

---

### Hours 04:00 – 08:00 | Multi-Device Management, Kiosk Mode & Phishing Lab (Sprint 2)
* **Lead:** Member A (Security Lead) & Member C (Backend)
* **Milestones:**
  1. Multi-Device Enrollment: Add "Register New Device" button in dashboard requiring step-up authentication using the active credential.
  2. **Server-Side Session Invalidation Reality:**
     - The server cannot force client-side browsers to delete cookies over the air.
     - *Implementation:* When a user clicks "Revoke Device" or "Log Out", the server updates the device `status = 'REVOKED'` and deletes the corresponding session record from the `sessions` table.
     - *Middleware:* Every protected API route validates session existence in the database. When the session record is purged, any subsequent request with that cookie immediately receives `401 Unauthorized`.
  3. Shared-Device Kiosk Mode:
     - Public PC screen displays dynamic QR challenge (`/api/kiosk/qr-challenge`).
     - Phone scans QR (via tunnel or local network route), user approves with biometrics.
     - Public PC receives a 15-minute ephemeral server session. Server invalidates session after 15 minutes or upon explicit logout.
  4. Phishing Demonstration Setup:
     - Finalize `https://b4nk-secure.local:3001` look-alike page.
     - Side-by-side presentation showing:
       - Window 1: Legacy password site happily accepts and steals credentials in RED.
       - Window 2: Passkey site shows authenticator finding 0 credentials on fake domain, plus backend rejecting mismatched origin in GREEN.

---

### Hours 08:00 – 12:00 | AI-Agent Capability Delegation Gateway (Sprint 3 — Optional Extension)
* **Lead:** Member D (Tech Lead / AI Lead)
* **Milestones:**
  1. Server Challenge Binding (The Cryptographic Reality):
     - The user's passkey **does not directly sign raw transaction data**. Rather, the passkey authorizes a **server-bound challenge**.
     - When the user delegates an action, the backend constructs an authentication challenge embedding the transaction parameters:
       $$\text{challenge} = \text{SHA-256}(\text{user\_id} + \text{"POST /api/v1/payments"} + \text{"TataPower"} + 1800 + \text{nonce})$$
     - The user authorizes this server-bound challenge via standard passkey biometric verification.
  2. Capability Token Minting:
     - Server verifies WebAuthn assertion against the expected challenge.
     - Server issues a signed HMAC-SHA256 capability token:
       `{ action, recipient, max_amount: 2000, expires_at, nonce }`
  3. Gateway Middleware:
     - Intercepts AI tool call. Checks token signature, validates `amount <= max_amount`, verifies `recipient === approved_recipient`, checks nonce is unspent.
  4. Adversarial Attack Demo:
     - Script a prompt-injection attack attempting to alter recipient to `Attacker_Wallet` or amount to ₹50,000.
     - Gateway rejects with `403 Forbidden (Capability Constraint Violation)`.

---

### Hours 12:00 – 16:00 | Admin Dashboard, Risk Engine & Audit Trail (Sprint 4)
* **Lead:** Member B (UI Lead) & Member C (Backend)
* **Milestones:**
  1. Admin SOC Dashboard:
     - Real-time table of registered credentials, device models, and active sessions.
     - Event feed displaying: `USER_LOGIN_SUCCESS`, `PHISHING_ORIGIN_REJECTED`, `RECOVERY_CODE_CONSUMED`, `DEVICE_REVOKED`, `AGENT_ACTION_BLOCKED`.
  2. Risk-Based Step-Up Checks:
     - If simulated login occurs from a new IP or unrecognized user-agent, flag `risk_score = HIGH` and demand an explicit biometric re-authentication prompt.
  3. Audit Logging Architecture:
     - Append-only database records with ISO 8601 UTC timestamps, designed with reference to CERT-In Rule 2(v) logging principles.

---

### Hours 16:00 – 20:00 | Automated Attack & Defense Lab + PQC Benchmark (Sprint 5)
* **Lead:** Member A (Security Lead) & Member D (Crypto Lead)
* **Milestones:**
  1. Attack & Defense Test Runner (`test_attacks.ts`):
     - Executes concrete attack probes:
       1. Origin Mismatch Probe (Assertion claiming wrong origin $\to$ `BLOCKED`).
       2. Replayed Authentication Challenge ($\to$ `BLOCKED`).
       3. Reused Recovery Code ($\to$ `BLOCKED`).
       4. Revoked Credential Assertion ($\to$ `BLOCKED`).
       5. Terminated Session Cookie Access ($\to$ `BLOCKED`).
       6. AI Agent Prompt Injection Tampering ($\to$ `BLOCKED` if Sprint 3 completed).
     - Display test results live on the dashboard (Report passing count honestly: e.g., 6/6 Defended).
  2. NIST FIPS 204 (ML-DSA) Post-Quantum Benchmark Script (Optional Research Stretch):
     - Standalone script comparing ECDSA (P-256) vs ML-DSA-44 keygen time, signature size (64B vs ~2,420B), and verification latency across 100 trials.
     - Outputs clean comparison table for presentation slides as an isolated migration readiness study.

---

### Hours 20:00 – 24:00 | Rehearsal, Threat Model & Pitch Polish (Sprint 6)
* **Lead:** Entire Team
* **Milestones:**
  1. Finalize STRIDE Threat Model Document (`THREAT_MODEL.md`) detailing covered attacks and honest residual risks (endpoint malware, physical theft).
  2. Freeze code 2 hours before the deadline. Do NOT push last-minute untested changes!
  3. Rehearse the 3-minute pitch 5 times:
     - Minute 1: The Problem (SMS OTPs & Digital Arrest crisis in India).
     - Minute 2: Live Demo (Genuine login $\to$ Look-alike phishing deflection $\to$ Recovery code use $\to$ AI prompt-injection block).
     - Minute 3: Standards Alignment & Impact (Admin SOC view, PQC benchmark, and defensible regulatory principles).

---

## 3. Team Responsibilities & Ownership Matrix

| Member | Focus Area | Core Deliverables |
| :--- | :--- | :--- |
| **Member A (Security Lead)** | Attack Scenarios & Testing | Controlled phishing proxy setup, `test_attacks.ts` suite, STRIDE threat model, judge Q&A defense. |
| **Member B (Product & UI Lead)** | User Experience & Admin View | React UI, accessible prompts, QR modal, Admin SOC event log, pitch deck formatting. |
| **Member C (Backend & Lifecycle Lead)** | WebAuthn Engine & Storage | `@simplewebauthn` integration, Argon2id recovery codes, server-side session invalidation, SQLite schema, multi-device logic. |
| **Member D (Tech Lead & AI/Crypto Lead)** | AI Gateway & Integration | Challenge-bound AI delegation tokens, prompt-injection attack script, PQC benchmark script, end-to-end integration. |

---
*Roadmap complete. Keep this document as your operational checklist throughout Day 2 and the 24-hour sprint.*
