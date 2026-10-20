# TrustX SovereignPass — Master Operational Task Checklist
**CyberCup 6.0 | CC6-IC04: Next-Generation Passwordless Authentication**  
**Team Members & Roles:**
* **Adnan:** Role 1 — Security Lead & Attack/Defense Engineer
* **Ananya:** Role 2 — Product, UI/UX & Admin SOC Lead
* **Sanchit:** Role 3 — Core Backend & Identity Lifecycle Lead
* **Swayam:** Role 4 — Systems Integration & AI/Crypto Lead

---

## 1. Day 2: Preparation, Scaffolding & Uncertainty Elimination (Tomorrow)

### Phase 1: Local HTTPS, mkcert & Origin Configuration (Hours 0 – 2)
- [x] **Task 1.1 [Adnan & Swayam]:** Install `mkcert` on presentation laptop (`brew install mkcert && mkcert -install`). *(Completed)*
- [x] **Task 1.2 [Adnan & Swayam]:** Generate local SSL certs: `mkcert -cert-file certs/cert.pem -key-file certs/key.pem bank.local b4nk-secure.local localhost 127.0.0.1`. *(Completed: verified RSA 2048-bit with SAN bank.local & b4nk-secure.local)*
- [ ] **Task 1.3 [Adnan]:** Configure `/etc/hosts` on presentation laptop: add `127.0.0.1 bank.local b4nk-secure.local`.
- [x] **Task 1.4 [Swayam]:** Configure exact origin, reverse proxy & port in backend environment: set `RP_ID = "bank.local"`, `EXPECTED_ORIGIN = "https://bank.local:3000"`. Configure Express HTTPS server at `:3000` to proxy frontend routes to internal Vite dev server (`:5173`) so user browser origin is strictly `https://bank.local:3000`. Set fake phishing site to `https://b4nk-secure.local:3001` (RP ID `b4nk-secure.local`, expectedOrigin `https://b4nk-secure.local:3001`). *(Completed in branch `feat/systems-ai`)*
- [ ] **Task 1.5 [Swayam & Adnan]:** Verify smartphone cross-device route before committing:
  - [ ] *Option A (Native FIDO Hybrid / caBLE):* Confirm browser & device Bluetooth support on presentation machine (browser handles QR natively at `https://bank.local:3000`).
  - [ ] *Option B (Custom Web Kiosk QR via Tunnel):* If exposing via tunnel (e.g., `cloudflared tunnel`), configure backend `RP_ID` and `EXPECTED_ORIGIN` to match the exact tunnel domain (e.g., `trustx-demo.trycloudflare.com`), since public tunnels change the origin.
- [ ] **Task 1.6 [Adnan & Ananya]:** Milestone check: Open `https://bank.local:3000` in Chrome & Safari; verify trusted green padlock with zero SSL warnings.

---

### Phase 2: Monorepo Scaffolding & Database Schema Freeze (Hours 2 – 4)
- [x] **Task 2.1 [Swayam]:** Scaffold monorepo structure: `packages/backend`, `packages/frontend`, root `package.json`. *(Completed in branch `feat/systems-ai`)*
- [x] **Task 2.2 [Sanchit]:** Set up Node.js + Express + TypeScript backend with `better-sqlite3`. *(Completed in branch `feat/auth-backend`)*
- [x] **Task 2.3 [Sanchit]:** Freeze and initialize complete SQLite database tables with integrity constraints: *(Completed in branch `feat/auth-backend`)*
  - [x] `users` (`id TEXT PRIMARY KEY`, `username TEXT UNIQUE NOT NULL`, `role TEXT NOT NULL CHECK(role IN ('USER', 'ADMIN')) DEFAULT 'USER'`, `created_at TEXT NOT NULL`) — initial admin seeded via `npm run db:seed`.
  - [x] `credentials` (`id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `public_key BLOB NOT NULL`, `counter INTEGER NOT NULL DEFAULT 0`, `transports TEXT`, `device_name TEXT NOT NULL`, `status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'REVOKED')) DEFAULT 'ACTIVE'`, `created_at TEXT NOT NULL`, `last_used_at TEXT NOT NULL`) — Index: `idx_credentials_user (user_id, status)`. (No `is_master`).
  - [x] `recovery_codes` (`id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `code_hash TEXT NOT NULL`, `consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0, 1))`, `consumed_at TEXT`) — Index: `idx_recovery_user (user_id, consumed)`.
  - [x] `pending_recoveries` (`ticket_id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `verified_recovery_code_id TEXT NOT NULL REFERENCES recovery_codes(id)`, `replacement_registration_challenge TEXT NOT NULL UNIQUE`, `expires_at INTEGER NOT NULL`, `used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0, 1))`) — Index: `idx_pending_rec_lookup (ticket_id, used, expires_at)`.
  - [x] `sessions` (`id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `credential_id TEXT REFERENCES credentials(id)`, `expires_at INTEGER NOT NULL`, `is_kiosk INTEGER NOT NULL DEFAULT 0 CHECK(is_kiosk IN (0, 1))`, `ip_address TEXT NOT NULL`, `user_agent TEXT NOT NULL`, `created_at TEXT NOT NULL`, `last_active_at INTEGER NOT NULL`) — Indexes: `idx_sessions_user`, `idx_sessions_expiry`.
  - [x] `kiosk_authorizations` (`kiosk_session_id TEXT PRIMARY KEY`, `token_hash TEXT NOT NULL UNIQUE`, `kiosk_client_secret_hash TEXT NOT NULL`, `display_code INTEGER NOT NULL`, `user_id TEXT REFERENCES users(id)`, `challenge TEXT UNIQUE`, `status TEXT NOT NULL CHECK(status IN ('PENDING', 'AUTHORIZED', 'EXPIRED', 'CLAIMED')) DEFAULT 'PENDING'`, `expires_at INTEGER NOT NULL`, `created_at TEXT NOT NULL`) — Index: `idx_kiosk_lookup`.
  - [x] `step_up_authorizations` (`token TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE`, `http_method TEXT NOT NULL`, `route TEXT NOT NULL`, `intent_hash TEXT NOT NULL`, `expires_at INTEGER NOT NULL`, `consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0, 1))`) — Index: `idx_step_up_lookup`.
  - [x] `delegation_intents` (`id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `action TEXT NOT NULL`, `recipient TEXT NOT NULL`, `max_amount INTEGER NOT NULL`, `nonce TEXT NOT NULL UNIQUE`, `challenge TEXT NOT NULL UNIQUE`, `status TEXT NOT NULL`, `expires_at INTEGER NOT NULL`).
  - [x] `audit_events` (`id TEXT PRIMARY KEY`, `user_id TEXT`, `event_type TEXT NOT NULL`, `details TEXT NOT NULL`, `ip_address TEXT NOT NULL`, `timestamp TEXT NOT NULL`) — Index: `idx_audit_time (timestamp)`.
- [x] **Task 2.4 [Ananya]:** Set up React 18 + Vite + Tailwind CSS frontend; establish theme, typography, and accessible layout targets. *(Completed in branch `cybercup-ananya`)*
- [x] **Task 2.5 [Swayam & Sanchit]:** Create root `npm run dev` script using `concurrently` to start backend and frontend in one terminal command. *(Completed in branch `feat/systems-ai`)*

---

### Phase 3: Core WebAuthn Proof-of-Concept & Two-Layer Origin Test (Hours 4 – 7)
- [x] **Task 3.1 [Sanchit]:** Implement registration endpoints: *(Completed in branch `feat/auth-backend`)*
  - [x] `POST /api/auth/register-challenge` calling `generateRegistrationOptions`.
  - [x] `POST /api/auth/register-verify` calling `verifyRegistrationResponse`, storing credential public key.
- [x] **Task 3.2 [Ananya]:** Implement frontend Registration form and trigger `@simplewebauthn/browser` `startRegistration`. *(Completed in branch `cybercup-ananya`)*
- [x] **Task 3.3 [Sanchit]:** Implement authentication endpoints: *(Completed in branch `feat/auth-backend`)*
  - [x] `POST /api/auth/login-challenge` calling `generateAuthenticationOptions`.
  - [x] `POST /api/auth/login-verify` calling `verifyAuthenticationResponse`, validating `expectedOrigin`, setting HttpOnly session cookie.
- [x] **Task 3.4 [Ananya]:** Implement frontend Login form and trigger `startAuthentication`. *(Completed in branch `cybercup-ananya`)*
- [ ] **Task 3.5 [Team]:** Verify live biometric passkey ceremony on presentation laptop (Touch ID / Windows Hello); confirm record in SQLite.
- [ ] **Task 3.6 [Sanchit & Swayam]:** Verify signature counter handling: ensure `signCount == 0` is accepted without error for platform authenticators.
- [x] **Task 3.7 [Adnan]:** Execute two-layer phishing defense test: *(Completed in branch `feat/security-simulation`)*
  - [x] *Layer 1 (Client RP ID Isolation):* Open `https://b4nk-secure.local:3001` -> confirm browser discovers 0 passkeys for fake RP ID, refusing to offer genuine credential.
  - [x] *Layer 2 (Server Verification):* Test backend rejection of an invalid or mismatched assertion -> verify backend throws `OriginMismatchError` / signature verification failure and logs incident.

---

### Phase 4: Subsystem Stubs, API Contracts & Pre-Hackathon Freeze (Hours 7 – 9)
- [ ] **Task 4.1 [Swayam & Sanchit]:** Finalize and lock TypeScript API interface contracts:
  - [ ] `POST /api/recovery/verify-code` (Phase 1 recovery ticket)
  - [ ] `POST /api/recovery/complete` (Phase 2 new passkey enrollment + atomic code burn)
  - [ ] `GET /api/devices/list` & `POST /api/devices/revoke`
  - [ ] `POST /api/kiosk/qr-challenge`, `POST /api/kiosk/qr-auth-challenge`, `POST /api/kiosk/qr-authorize`, `POST /api/kiosk/qr-poll`
  - [ ] `POST /api/auth/step-up-verify` (Action-bound step-up token)
  - [ ] `GET /api/admin/credentials`, `GET /api/admin/sessions`, `POST /api/admin/sessions/terminate`, `GET /api/admin/audit-logs`
  - [ ] `POST /api/agent/delegate-challenge` & `POST /api/agent/execute-payment`
- [x] **Task 4.2 [Ananya]:** Build UI component placeholder stubs: User Dashboard, Recovery Modal, Kiosk QR Modal, Admin SOC Table. *(Completed in branch `cybercup-ananya`)*
- [x] **Task 4.3 [Adnan]:** Create initial test harness scaffold in `test_attacks.ts`. *(Completed in branch `feat/security-simulation` with 6 automated probes)*
- [ ] **Task 4.4 [Team]:** Git commit & push Day 2 scaffolding to GitHub repository.
- [ ] **Task 4.5 [Team]:** Pre-hackathon hardware checklist: chargers, cables, phone hotspot, presentation browser bookmarks verified.

---

## 2. 24-Hour Campus Hackathon Sprint

### Sprint 1 (Hours 00:00 – 04:00): Core Polish, Recovery Engine & Session Invalidation
- [ ] **Task S1.1 [Ananya]:** Build clear UI screens for Login, Registration, and Recovery designed with reference to WCAG 2.1 AA accessibility guidelines.
- [x] **Task S1.2 [Sanchit]:** Implement Recovery Code Generator: *(Completed in branch `feat/auth-backend`)*
  - [x] Generate 8 single-use high-entropy alphanumeric codes upon registration.
  - [x] Hash codes strictly using **Argon2id** with cryptographic salt and save to `recovery_codes` table.
- [x] **Task S1.3 [Ananya]:** Display recovery codes in clean modal with "Download Codes / Copy" confirmation before entering dashboard. *(Completed in branch `cybercup-ananya`)*
- [ ] **Task S1.4 [Sanchit]:** Implement Safe Two-Phase Atomic Recovery (Concurrency-Safe Lockout Prevention):
  - [ ] *Phase 1 (`POST /api/recovery/verify-code`):* Verify code against Argon2id hash. Store ticket in `pending_recoveries` table `{ ticket_id, user_id, verified_recovery_code_id, replacement_registration_challenge, expires_at: 5m, used: false }` and return `recoveryTicket` + `registrationOptions`. **Do not burn the code yet.**
  - [ ] *Phase 2 (`POST /api/recovery/complete`):* Verify replacement passkey attestation. Inside an atomic database transaction: recheck ticket is unused/unexpired and recovery code is unconsumed; execute conditional updates (`UPDATE ... WHERE used = 0`, `UPDATE ... WHERE consumed = 0`); revoke lost credential, register replacement passkey, purge active sessions, and issue fresh session. A failed or expired attempt never revokes existing credentials.
- [ ] **Task S1.5 [Adnan]:** Test case: Verify that reusing an already-consumed recovery code fails immediately (`400 Bad Request`).
- [ ] **Task S1.6 [Sanchit]:** Add rate-limiting on recovery verification (maximum 3 failed attempts before progressive backoff).

---

### Sprint 2 (Hours 04:00 – 08:00): Multi-Device Management, Kiosk Mode & Phishing Lab
- [ ] **Task S2.1 [Sanchit]:** Implement `POST /api/devices/register-challenge` requiring active session re-authentication (step-up auth).
- [ ] **Task S2.2 [Ananya]:** Build "Add Secondary Device" flow and enrolled devices table in user dashboard.
- [ ] **Task S2.3 [Sanchit]:** Implement `POST /api/devices/revoke`:
  - [ ] Update credential `status = 'REVOKED'`.
  - [ ] Purge matching session records in `sessions` table.
- [ ] **Task S2.4 [Sanchit]:** Implement protected route session middleware: every protected API request validates session active status in SQLite.
- [ ] **Task S2.5 [Adnan & Swayam]:** Build Shared-Device Kiosk Mode:
  - [ ] Public workstation UI generates challenge with secret (`kioskClientSecret`) and displays dynamic QR + 2-digit confirmation code (`/api/kiosk/qr-challenge`).
  - [ ] Unauthenticated phone scans QR, requests options via `POST /api/kiosk/qr-auth-challenge`: server verifies user exists and owns active passkey (`status === 'ACTIVE'`), binds challenge to `{ kiosk_session_id, token_hash, username, expires_at: 60s }`, and returns options with `displayCode`. (Does NOT consume QR token; prevents challenge overwrites).
  - [ ] Citizen verifies 2-digit code on screen (visual check against misdirected approvals, rate-limited to 3 attempts), and completes biometric assertion (`POST /api/kiosk/qr-authorize`): server verifies exact binding (session, token hash, username, challenge) and confirmed code before atomically consuming challenge and token.
  - [ ] Public terminal polls `POST /api/kiosk/qr-poll` presenting `kioskClientSecret` in request body (kept in kiosk memory, never in URL); server grants 15-minute ephemeral session and burns authorization ticket immediately.
  - [ ] Workstation logout or 15-minute timer expiry destroys session record in database; zero passkey residue left on public machine.
- [ ] **Task S2.6 [Adnan]:** Finalize `https://b4nk-secure.local:3001` look-alike phishing demonstration:
  - [ ] Set up side-by-side presentation browser layout.
  - [ ] Show legacy password site intercepting clearly labeled dummy test credentials (`alice_dummy` / `DemoPassword123!`) in RED.
  - [ ] Show passkey site refusing credentials at browser layer (RP ID isolation) and backend rejecting mismatched origin assertions in GREEN.

---

### Sprint 3 (Hours 08:00 – 12:00): AI-Agent Capability Delegation Gateway (Optional Extension)
- [ ] **Task S3.1 [Swayam]:** Server-Side Structured Intent Binding (Unambiguous Authorization):
  - [ ] Client submits transaction intent: `{ action: "POST /api/v1/payments", recipient: "TataPower", max_amount: 2000 }`.
  - [ ] Server creates pending record in `delegation_intents` with single-use `nonce` and expiration.
  - [ ] Server generates a single-use WebAuthn challenge cryptographically bound to the stored intent record.
- [ ] **Task S3.2 [Ananya & Swayam]:** Frontend displays AI delegation confirmation modal; user authorizes server-bound challenge via biometric passkey.
- [ ] **Task S3.3 [Swayam]:** Server validates WebAuthn assertion authorizing that challenge; issues signed HMAC-SHA256 capability token bound to the approved intent parameters:
  `{ intent_id, action, recipient, max_amount: 2000, expires_at, nonce }`.
- [ ] **Task S3.4 [Swayam]:** Implement API Gateway middleware intercepting agent transactions:
  - [ ] Validates token HMAC signature against server secret.
  - [ ] Enforces `amount <= max_amount`.
  - [ ] Enforces `recipient === approved_recipient`.
  - [ ] Validates `nonce` is unspent and marks it spent atomically.
- [ ] **Task S3.5 [Adnan & Swayam]:** Script adversarial prompt-injection attack attempting to alter recipient to `Attacker_Wallet` or amount to INR 50,000; verify gateway blocks with `403 Forbidden (Capability Constraint Violation)`.

---

### Sprint 4 (Hours 12:00 – 16:00): Admin SOC Dashboard, Risk Engine & Audit Trail
- [ ] **Task S4.1 [Ananya]:** Build Admin SOC Dashboard view consuming admin-authorized endpoints (`req.session.role === 'ADMIN'`):
  - [ ] Table of registered credentials across all users (`GET /api/admin/credentials`).
  - [ ] Active session monitor (`GET /api/admin/sessions`) with 1-click server-side terminate button (`POST /api/admin/sessions/terminate`).
- [ ] **Task S4.2 [Ananya & Sanchit]:** Build live security audit event feed displaying:
  - [ ] `USER_LOGIN_SUCCESS`
  - [ ] `PHISHING_ORIGIN_REJECTED`
  - [ ] `RECOVERY_CODE_CONSUMED`
  - [ ] `DEVICE_REVOKED`
  - [ ] `AGENT_ACTION_BLOCKED`
- [ ] **Task S4.3 [Sanchit & Swayam]:** Implement risk-based anomaly scoring: flag anomalous IP/client as `risk_score = HIGH`, returning `403 STEP_UP_REQUIRED` with `intentId` + `stepUpOptions`. Verify via `POST /api/auth/step-up-verify` to mint `X-Step-Up-Token` bound to user, session, HTTP method, route, and body hash; middleware verifies all bindings and consumes token atomically within the database transaction executing the protected action (if action fails business validation, token remains consumed to prevent replay; operation cannot execute twice).
- [x] **Task S4.4 [Sanchit & Adnan]:** Ensure all audit records use UTC ISO-8601 timestamps designed with reference to CERT-In Rule 2(v) logging principles and cryptographic SHA-256 hash chaining. *(Completed in branch `feat/security-simulation` with `export-audit-log.ts`)*

---

### Sprint 5 (Hours 16:00 – 20:00): Automated Attack & Defense Lab + PQC Benchmark
- [x] **Task S5.1 [Adnan]:** Write and run automated test suite (`tests/test_attacks.ts`) executing 5 core probes (+ 1 optional AI probe) asserting live outcomes: *(Completed in branch `feat/security-simulation`: 6/6 probes passed)*
  - [x] Probe 1: Look-alike origin mismatch assertion -> `PASS` (rejected 400/401, no session cookie created)
  - [x] Probe 2: Replayed authentication challenge / counter anomaly -> `PASS` (rejected 401)
  - [x] Probe 3: Reused recovery bearer code -> `PASS` (400 Bad Request)
  - [x] Probe 4: Revoked credential assertion -> `PASS` (rejected 401)
  - [x] Probe 5: Terminated session cookie / unissued challenge request -> `PASS` (401 Unauthorized)
  - [x] Probe 6: AI prompt-injection parameter alteration -> `PASS` (blocked 403 Forbidden by capability token HMAC)
- [ ] **Task S5.2 [Ananya]:** Render attack test runner results live on the Admin Dashboard: display dynamic live test results (`PASS: 5, FAIL: 0, SKIPPED: 1`), never hardcoding test counts.
- [x] **Task S5.3 [Swayam]:** Build NIST FIPS 204 (ML-DSA) Post-Quantum Benchmark Script (Optional Research Stretch): *(Completed and merged into main)*
  - [x] Standalone script comparing ECDSA (P-256) vs ML-DSA-44 across 100 trials: keygen time, signature size (64B vs ~2,420B), and verification latency.
  - [x] Output formatted comparison table for presentation deck as an isolated migration study.
- [ ] **Task S5.4 [Adnan]:** Test real FIDO2 USB/NFC hardware key (if physical token available) [Optional Stretch].

---

### Sprint 6 (Hours 20:00 – 24:00): End-to-End Rehearsal, Threat Model & Pitch Polish
- [ ] **Task S6.1 [Adnan]:** Finalize STRIDE Threat Model document (`THREAT_MODEL.md`) detailing covered mitigations and honest residual risks (session theft, compromised endpoints).
- [ ] **Task S6.2 [Ananya]:** Finalize 8-slide pitch deck (Problem, Architecture, User Journeys, Phishing Lab, Recovery, AI Gateway, SOC View, Standards Reference & Defensibility).
- [ ] **Task S6.3 [Swayam & Sanchit]:** Code freeze at Hour 22:00. No unverified code changes pushed after code freeze.
- [ ] **Task S6.4 [Team]:** Rehearse 3-minute pitch 5 times with exact stopwatch timing:
  - [ ] Minute 1: Problem statement, SMS OTP vulnerabilities & Indian threat context.
  - [ ] Minute 2: Live end-to-end demo (genuine login -> phishing block -> safe recovery -> AI injection block).
  - [ ] Minute 3: Admin SOC dashboard, PQC migration study, standards references & defensible security posture.
- [ ] **Task S6.5 [Team]:** Rehearse Judge Q&A Playbook:
  - [ ] Q1: DPDP phased rollout defense (data minimization reference).
  - [ ] Q2: Session cookie theft residual risk defense (honest limitation).
  - [ ] Q3: Recovery codes as bearer secrets defense (two-phase atomic recovery).
  - [ ] Q4: Post-quantum migration benchmark scope defense (isolated study, not claiming passkeys are quantum-safe).

---

## 3. Judge Presentation Live Demo Sequence (Day of Presentation)

- [ ] **Step 1:** Open `https://bank.local:3000` -> Register username `alice` -> Touch ID / Windows Hello prompt -> Show credential created in SQLite.
- [ ] **Step 2:** Display 8 recovery codes in modal -> Save code `CODE-1`.
- [ ] **Step 3:** Open side-by-side phishing site `https://b4nk-secure.local:3001` -> Attempt login -> Show authenticator refusing to offer bank passkey, and backend rejecting mismatched origin.
- [ ] **Step 4:** Open private/incognito window -> Click "Recover Account" -> Enter `CODE-1` -> Register replacement passkey -> Show lost device marked `REVOKED` and old sessions invalidated atomically.
- [ ] **Step 5 (Optional):** Trigger AI Agent payment for utility bill -> Prompt biometric confirmation -> Show capability token issued -> Attempt prompt-injection attack with modified wallet -> Show `403 Forbidden` block.
- [ ] **Step 6:** Open Admin SOC Dashboard -> Highlight real-time event feed, CERT-In referenced audit ledger, and PQC benchmark slide.
- [ ] **Step 7:** Close with Slide 8: Standards References & Defensible Security.
