# TrustX SovereignPass — Team Ownership & Collaboration Guide
**File:** `TEAM_TASK_BREAKDOWN.md`  
**Hackathon:** CyberCup 6.0 | Problem Statement: CC6-IC04  
**Classification:** Internal Team Architectural Ownership, Interface Contracts & Collaboration Standards  

---

## 1. Collaboration Philosophy & Anti-Conflict Rules

To prevent code conflicts and integration bottlenecks during a 24-hour hackathon, every file, interface, and test boundary is strictly assigned to a single owner.

### The Five Non-Negotiable Engineering Rules
1. **Strict Single Ownership at the File Level:** No file is shared between two authors. Each file has exactly one maintainer. Changes to shared files (such as database schemas or root dependencies) are proposed via coordination, never edited unilaterally.
2. **Interface Contracts First:** Frontend and backend development are decoupled. Sanchit and Ananya agree on REST JSON shapes on Day 2; Ananya develops all UI screens using typed mock fixtures immediately, without waiting for backend routes to be completed.
3. **P0 Core Isolation:** Advanced and stretch modules (AI capability delegation, risk engine, post-quantum benchmark) live in dedicated files. If an optional feature experiences delays or bugs, it can be disabled via a feature flag without affecting the core passkey lifecycle.
4. **Canonical Test Path:** All automated security probes live strictly in `tests/test_attacks.ts`. All documents and scripts reference this single canonical path.
5. **Team-Enforced Main Branch Hygiene:** `main` is the protected integration branch. No member pushes unreviewed code directly to `main`. Every feature merges via a feature branch (`feat/*`) after quick teammate confirmation.

---

### 1.1 Canonical WebAuthn Origin, RP ID & Reverse-Proxy Architecture

To prevent WebAuthn origin mismatches and cross-port browser ceremony failures, the system uses a **Single Unified HTTPS Origin**:

| Parameter | Configuration Value | Architectural Scope |
| :--- | :--- | :--- |
| **User Browser URL** | `https://bank.local:3000` | The exact URL opened by citizens and administrators in the browser. |
| **Frontend Browser Origin** | `https://bank.local:3000` | `window.location.origin` (includes scheme, hostname, and non-default port). |
| **Backend API Route** | `https://bank.local:3000/api/*` | Reverse-proxied on the same origin (no CORS preflight overhead or origin drift). |
| **WebAuthn RP ID** | `bank.local` | FIDO2 Relying Party ID: strictly the domain string (**no scheme, no port**). |
| **WebAuthn `expectedOrigin`** | `https://bank.local:3000` | Server-side verification strictly requires `clientDataJSON.origin === "https://bank.local:3000"`. |
| **Reverse Proxy Host** | Express HTTPS (`server.ts`) | Terminates SSL via `mkcert` certs at `:3000`, serves the API at `/api/*`, and proxies frontend client traffic to the Vite build/dev server (`:5173` internal). |
| **Adversary Phishing Origin** | `https://b4nk-secure.local:3001` | RP ID: `b4nk-secure.local`, `expectedOrigin`: `https://b4nk-secure.local:3001`. Browser finds 0 matching credentials; server rejects any cross-origin assertion. |

---

## 2. Monorepo File Ownership Matrix

```text
TrustX/
├── .gitignore                                 [Swayam]
├── README.md                                  [Swayam & Team]
├── TEAM_TASK_BREAKDOWN.md                     [Swayam & Team]
├── package.json (root)                        [Swayam]
├── certs/                                     [Adnan & Swayam]
├── docs/
│   ├── architecture.md                        [Swayam]
│   ├── execution-roadmap.md                   [Swayam]
│   ├── compliance-and-frameworks.md           [Swayam]
│   └── security/
│       └── THREAT_MODEL.md                    [Adnan]
├── tests/
│   └── test_attacks.ts                        [Adnan]
├── scripts/
│   └── benchmarks/
│       └── pqc_benchmark.ts                   [Swayam]
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── auth.config.ts             [Sanchit]
│   │   │   │   └── server.config.ts           [Swayam]
│   │   │   ├── db/
│   │   │   │   ├── schema.ts                  [Sanchit]
│   │   │   │   └── database.ts                [Sanchit]
│   │   │   ├── middleware/
│   │   │   │   ├── session.middleware.ts      [Sanchit]
│   │   │   │   ├── auth.middleware.ts         [Sanchit]
│   │   │   │   └── risk.middleware.ts         [Swayam]
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts             [Sanchit]
│   │   │   │   ├── recovery.routes.ts         [Sanchit]
│   │   │   │   ├── devices.routes.ts          [Sanchit]
│   │   │   │   ├── kiosk.routes.ts            [Sanchit]
│   │   │   │   ├── admin.routes.ts            [Sanchit]
│   │   │   │   └── agent.routes.ts            [Swayam]
│   │   │   ├── services/
│   │   │   │   ├── webauthn.service.ts        [Sanchit]
│   │   │   │   ├── recovery.service.ts        [Sanchit]
│   │   │   │   ├── audit.service.ts           [Sanchit]
│   │   │   │   ├── risk.service.ts            [Swayam]
│   │   │   │   └── agent.service.ts           [Swayam]
│   │   │   └── server.ts                      [Sanchit]
│   └── frontend/
│       ├── src/
│       │   ├── components/                    [Ananya]
│       │   │   ├── PasskeyModal.tsx           [Ananya]
│       │   │   ├── KioskQRModal.tsx           [Ananya]
│       │   │   ├── DeviceTable.tsx            [Ananya]
│       │   │   ├── AuditFeed.tsx              [Ananya]
│       │   │   └── RecoveryModal.tsx          [Ananya]
│       │   ├── pages/                         [Ananya]
│       │   │   ├── LoginPage.tsx              [Ananya]
│       │   │   ├── RegisterPage.tsx           [Ananya]
│       │   │   ├── RecoveryPage.tsx           [Ananya]
│       │   │   ├── DashboardPage.tsx          [Ananya]
│       │   │   └── AdminSOCPage.tsx           [Ananya]
│       │   ├── services/
│       │   │   └── api.ts                     [Ananya]
│       │   ├── styles/                        [Ananya]
│       │   └── App.tsx                        [Ananya]
```

### Git Feature Branch Allocations
* `feat/security-tests` -> **Adnan**
* `feat/frontend-ui` -> **Ananya**
* `feat/auth-backend` -> **Sanchit**
* `feat/systems-ai` -> **Swayam**

---

## 3. Detailed Member Responsibilities & Boundaries

---

### Adnan — Security Lead & Attack/Defense Engineer

#### 1. File Ownership
* `tests/test_attacks.ts` (canonical attack suite)
* `docs/security/THREAT_MODEL.md` (STRIDE threat model & residual risks)
* `certs/` (local SSL certificate generation with `mkcert`)
* Mock adversary proxy script: `tests/mock_phishing_server.ts`

#### 2. Key Deliverables
* **Local SSL Setup:** Generate trusted local CA certs for `bank.local`, `b4nk-secure.local`, `localhost`, `127.0.0.1` and configure `/etc/hosts`.
* **Multi-Layer Phishing & Legacy Demonstration:**
  * *Browser Layer (Client RP ID Isolation):* Citizen navigates to `https://b4nk-secure.local:3001`. Browser queries authenticator for RP ID `b4nk-secure.local`, finds zero matching passkeys, and refuses to offer the legitimate bank credential.
  * *Legacy Phishing Comparison (Dummy Credentials):* Side-by-side legacy form captures clearly labeled dummy credentials (e.g., `user: "alice_dummy"`, `pass: "DemoPassword123!"` — strictly test fixtures, never real secrets) to visually demonstrate credential harvesting in RED.
  * *Server Layer (`tests/test_attacks.ts` Probe 1):* Automated adversary script submits a crafted assertion deliberately bearing an untrusted/tampered origin (`https://b4nk-secure.local:3001`). Server validates `clientDataJSON.origin`, detects mismatch against `expectedOrigin`, rejects with `400/401`, sets no session cookie, and logs an incident event. *(Note: Reported strictly as server-side origin rejection, not as a browser-generated assertion from the fake domain).*
* **Automated Attack Runner (`tests/test_attacks.ts`):** Deterministic execution of 5 core attack vectors (+ 1 optional AI vector):
  1. Origin Mismatch Assertion -> `BLOCKED (400/401)`
  2. Replayed Authentication Challenge -> `BLOCKED (400/401)`
  3. Reused Recovery Bearer Code -> `BLOCKED (400)`
  4. Revoked Credential Assertion -> `BLOCKED (401)`
  5. Terminated Session Cookie Request -> `BLOCKED (401)`
  6. AI Prompt-Injection Parameter Alteration -> `BLOCKED (403)` *(OPTIONAL: executed only if Sprint 3 AI Delegation is active; otherwise explicitly reported as `SKIPPED`)*
* **STRIDE Threat Model:** Complete documentation of covered mitigations and transparent residual risks (e.g., endpoint malware, session cookie theft, physical device coercion).

#### 3. Interfaces & Touchpoints
* Consumes backend endpoints at `https://bank.local:3000/api/*`.
* Coordinates with **Sanchit** when a test discovers an authentication bypass or unhandled edge case.
* Supplies test status data to **Ananya** so the Admin SOC Dashboard can display automated defense results.

#### 4. Acceptance Criteria
* Test runner executes against the live running server and computes outcomes dynamically (never hardcoded):
  * **Probe 1 (Look-alike Phishing Origin Rejection):** `PASS` when backend rejects assertion for `https://b4nk-secure.local:3001` with 400/401 and issues no session cookie. (Client-side RP ID isolation is demonstrated visually in the browser).
  * **Probe 2 (Challenge Replay):** `PASS` when replayed authentication assertion is rejected.
  * **Probe 3 (Recovery Code Reuse):** `PASS` when already-consumed recovery code returns `400 Bad Request`.
  * **Probe 4 (Revoked Credential):** `PASS` when assertion with revoked credential ID is rejected.
  * **Probe 5 (Terminated Session):** `PASS` when request with invalidated session cookie receives `401 Unauthorized`.
  * **Probe 6 (AI Parameter Tampering):** `PASS` when tampered payment request receives `403 Forbidden`; explicitly marked `SKIPPED` if AI module is inactive.
* Core suite reports `PASS: 5, FAIL: 0, SKIPPED: 1` honestly without false green claims.
* Observable behavior verified: invalid assertions are rejected, no session cookies are set, and security audit events are appended to the ledger.

#### 5. Freedom & Exploration Space
* Choose assertion libraries and testing methodologies.
* Design the visual structure and flow of the live phishing demonstration.
* Formulate adversarial edge cases and lead technical Q&A defense during judge cross-examination.

---

### Ananya — Product, UI/UX & Admin SOC Lead

#### 1. File Ownership
* `packages/frontend/` (complete ownership of client code)
  * `src/components/*`
  * `src/pages/*`
  * `src/services/api.ts`
  * `src/styles/*`
  * `src/App.tsx`
* Pitch presentation slide deck assets

#### 2. Key Deliverables
* **Citizen Authentication Views:**
  * High-contrast Registration and Login screens with readable citizen guidance (*"Touch your fingerprint sensor or insert security key"*).
  * Design aligned with WCAG 2.1 AA accessibility targets (4.5:1 contrast, full keyboard navigation).
* **Safe Two-Phase Recovery Interface:**
  * Modal displaying 8 single-use emergency codes with "Download Codes / Copy" confirmation upon onboarding.
  * Two-phase recovery flow: entering the recovery code unlocks replacement passkey enrollment; the user is confirmed safe before entering the dashboard.
* **Shared-Device Kiosk QR Interface:**
  * Displays dynamic QR code for smartphone authentication; polling mechanism for session authorization.
* **Admin SOC Dashboard:**
  * Credentials table populated by `GET /api/admin/credentials` (device model, credential ID, username, status: ACTIVE / REVOKED).
  * Active sessions monitor populated by `GET /api/admin/sessions` with 1-click server-side termination button (`POST /api/admin/sessions/terminate`).
  * Live incident event stream displaying `USER_LOGIN_SUCCESS`, `PHISHING_ORIGIN_REJECTED`, `RECOVERY_CODE_CONSUMED`, `DEVICE_REVOKED`, `AGENT_ACTION_BLOCKED`.

#### 3. Interfaces & Touchpoints
* Consumes REST API endpoints defined in Section 4 using `packages/frontend/src/services/api.ts`.
* Uses `@simplewebauthn/browser` for client-side ceremonies (`startRegistration`, `startAuthentication`).
* Renders admin data returned by `GET /api/admin/credentials`, `GET /api/admin/sessions`, and `GET /api/admin/audit-logs`.

#### 4. Acceptance Criteria
* Entire UI is operable using only keyboard navigation (`Tab`, `Enter`, `Space`) with visible focus outlines.
* Clicking "Revoke" on an active device immediately updates UI state to `REVOKED` and removes active sessions.
* Zero raw cryptographic exceptions or unhandled promise rejections displayed to users.

#### 5. Freedom & Exploration Space
* Full ownership of layout, typography, Tailwind color themes, and component composition.
* Add accessibility cues (visual status badges, audio cues, animated confirmation checks).
* Style the Admin SOC view to look like a modern security operations center dashboard.

---

### Sanchit — Core Backend & Identity Lifecycle Lead

#### 1. File Ownership
* `packages/backend/src/config/auth.config.ts` (RP ID, expected origin, challenge options)
* `packages/backend/src/db/schema.ts` & `database.ts` (database schema, tables, queries)
* `packages/backend/src/routes/auth.routes.ts` (registration & login)
* `packages/backend/src/routes/recovery.routes.ts` (two-phase recovery)
* `packages/backend/src/routes/devices.routes.ts` (device list & revocation)
* `packages/backend/src/routes/kiosk.routes.ts` (kiosk session & QR endpoints)
* `packages/backend/src/routes/admin.routes.ts` (admin audit log queries)
* `packages/backend/src/middleware/session.middleware.ts` & `auth.middleware.ts`
* `packages/backend/src/services/webauthn.service.ts`, `recovery.service.ts`, `audit.service.ts`
* `packages/backend/src/server.ts` (Express bootstrapping & route mounting)

#### 2. Key Deliverables
* **WebAuthn Ceremony Engine:**
  * Registration and authentication ceremonies using `@simplewebauthn/server`.
  * Strict origin validation enforcing `clientDataJSON.origin === expectedOrigin` (`https://bank.local:3000`).
  * Signature counter logic: accept `signCount == 0` for platform authenticators; evaluate anomalies only when `lastCounter > 0`.
* **Database Schema Constraints & Provisioning (`schema.ts`):**
  * `users`: `id TEXT PRIMARY KEY`, `username TEXT UNIQUE NOT NULL`, `role TEXT NOT NULL CHECK(role IN ('USER', 'ADMIN')) DEFAULT 'USER'`, `created_at TEXT NOT NULL`. Public registration unconditionally provisions `role = 'USER'`. Initial admin is provisioned exclusively via bootstrap seed (`npm run db:seed`), preventing privilege escalation.
  * `credentials`: `id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `public_key BLOB NOT NULL`, `counter INTEGER NOT NULL DEFAULT 0`, `transports TEXT`, `device_name TEXT NOT NULL`, `status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'REVOKED')) DEFAULT 'ACTIVE'`, `created_at TEXT NOT NULL`, `last_used_at TEXT NOT NULL`. Index: `idx_credentials_user (user_id, status)`. (No `is_master` field; device trust is based on status and authenticated context).
  * `recovery_codes`: `id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `code_hash TEXT NOT NULL`, `consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0, 1))`, `consumed_at TEXT`. Index: `idx_recovery_user (user_id, consumed)`.
  * `pending_recoveries`: `ticket_id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `verified_recovery_code_id TEXT NOT NULL REFERENCES recovery_codes(id)`, `replacement_registration_challenge TEXT NOT NULL UNIQUE`, `expires_at INTEGER NOT NULL`, `used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0, 1))`. Index: `idx_pending_rec_lookup (ticket_id, used, expires_at)`.
  * `sessions`: `id TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `credential_id TEXT REFERENCES credentials(id)`, `expires_at INTEGER NOT NULL`, `is_kiosk INTEGER NOT NULL DEFAULT 0 CHECK(is_kiosk IN (0, 1))`, `ip_address TEXT NOT NULL`, `user_agent TEXT NOT NULL`, `created_at TEXT NOT NULL`, `last_active_at INTEGER NOT NULL`. Indexes: `idx_sessions_user (user_id)`, `idx_sessions_expiry (expires_at)`.
  * `kiosk_authorizations`: `kiosk_session_id TEXT PRIMARY KEY`, `token_hash TEXT NOT NULL UNIQUE`, `kiosk_client_secret_hash TEXT NOT NULL`, `display_code INTEGER NOT NULL`, `user_id TEXT REFERENCES users(id)`, `challenge TEXT UNIQUE`, `status TEXT NOT NULL CHECK(status IN ('PENDING', 'AUTHORIZED', 'EXPIRED', 'CLAIMED')) DEFAULT 'PENDING'`, `expires_at INTEGER NOT NULL`, `created_at TEXT NOT NULL`. Index: `idx_kiosk_lookup (kiosk_session_id, status, expires_at)`.
  * `step_up_authorizations`: `token TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE`, `http_method TEXT NOT NULL`, `route TEXT NOT NULL`, `intent_hash TEXT NOT NULL`, `expires_at INTEGER NOT NULL`, `consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0, 1))`. Index: `idx_step_up_lookup (token, consumed, expires_at)`.
  * `delegation_intents` & `audit_events`: Primary keys, foreign keys, and indexes on `timestamp`.
* **Safe Two-Phase Recovery Engine (Concurrency-Safe Lockout Prevention):**
  * Generate 8 high-entropy codes; store strictly as **Argon2id salted hashes**.
  * `POST /api/recovery/verify-code` (Phase 1): Validate code against hash; generate replacement registration challenge and store in `pending_recoveries` table: `{ ticket_id, user_id, verified_recovery_code_id, replacement_registration_challenge, expires_at: 5m, used: false }`. Returns `recoveryTicket` and `registrationOptions`. **The recovery code is NOT burned yet.**
  * `POST /api/recovery/complete` (Phase 2 Concurrency Guarantee): Verify replacement passkey attestation. Inside an atomic database transaction:
    1. Recheck ticket validity (`used == 0` AND `now < expires_at`).
    2. Recheck recovery code status (`consumed == 0`).
    3. Execute conditional updates checking affected rows (`changes === 1`):
       `UPDATE pending_recoveries SET used = 1 WHERE ticket_id = ? AND used = 0;`
       `UPDATE recovery_codes SET consumed = 1, consumed_at = ? WHERE id = ? AND consumed = 0;`
       If either update affects 0 rows, rollback immediately.
    4. Update lost credentials to `status = 'REVOKED'`, insert replacement credential as `ACTIVE`, purge previous sessions, and issue fresh session.
    5. Two simultaneous requests cannot both succeed; a failed or expired recovery attempt never revokes existing credentials.
  * Rate-limiting: maximum 3 failed attempts per IP/user before progressive cooldown.
* **Strict Authorization & Session Management:**
  * Session cookies: `HttpOnly; SameSite=Strict; Secure; Path=/`, rotated on login/privilege change, absolute + idle timeout, server-side SQLite session store. Zero session tokens in `localStorage`.
  * Device revocation (`POST /api/devices/revoke`) checks authenticated session context (`req.session.userId`) and verifies the target credential belongs to the caller (no IDOR/BOLA).
  * Admin endpoints require explicit admin authorization (`req.session.role === 'ADMIN'`).
* **Shared-Device Kiosk Session Engine:**
  * Public terminal creates session challenge paired with private `kioskClientSecret` and 2-digit confirmation code.
  * QR token is treated as a short-lived bearer secret: hashed at rest (`token_hash = SHA256(token)`), excluded from server logs, and protected via `Referrer-Policy: no-referrer` on the landing page.
  * Phone calls `POST /api/kiosk/qr-auth-challenge` with `{ kioskSessionId, token, username }`. Server verifies the user exists and owns an active credential (`status === 'ACTIVE'`) before generating authentication options; binds the challenge server-side to `{ kiosk_session_id, token_hash, user_id, username, expires_at: 60s }` and returns stored `displayCode`. **Requesting challenge does NOT consume the QR token.**
  * Overwrite & Race Protection: If an unexpired challenge already exists for this kiosk session, subsequent requests return the existing challenge or are rejected to prevent an attacker from racing or overwriting the legitimate challenge.
  * Phone asserts passkey and posts to `POST /api/kiosk/qr-authorize`. Server verifies the exact server-side binding (session, token hash, username, challenge) and confirmed code before atomically updating state (`status = 'AUTHORIZED'`) and consuming both the challenge and the token. Visual 2-digit confirmation code assists citizen against misdirected/accidental approvals (rate-limited; not claimed as full cryptographic relay protection).
  * Kiosk terminal polls `POST /api/kiosk/qr-poll` presenting `kioskClientSecret` in request body (kept strictly in kiosk memory, never in URL query strings). Server grants 15-minute ephemeral session and burns authorization ticket.
  * Workstation logout or 15-minute expiry invalidates session records; zero passkey residue left on public machine.

#### 3. Interfaces & Touchpoints
* Implements the exact REST contracts documented in Section 4.
* Exposes shared TypeScript types for all request bodies and responses.
* Incorporates Swayam's `risk.middleware.ts` and mounts `agent.routes.ts`.

#### 4. Acceptance Criteria
* Protected endpoints return `401 Unauthorized` immediately after session revocation.
* Reusing an already-consumed recovery code returns `400 Bad Request`.
* Assertions with invalid origins or invalid signatures are rejected, no session is created, and audit events are logged.

#### 5. Freedom & Exploration Space
* Design internal service architecture, query helpers, and repository patterns.
* Configure Argon2id hashing cost parameters (memory, iterations, parallelism).
* Optimize SQLite indexing for session lookups and audit queries.

---

### Swayam — Systems Integration, Risk Engine & AI/Crypto Lead

#### 1. File Ownership
* Root configuration: `package.json`, `.gitignore`, `tsconfig.json`, root `npm run dev`
* `packages/backend/src/config/server.config.ts` (port & environment configuration)
* `packages/backend/src/middleware/risk.middleware.ts` (risk scoring & step-up triggers)
* `packages/backend/src/services/risk.service.ts` (IP/client anomaly evaluation)
* `packages/backend/src/routes/agent.routes.ts` (AI capability delegation endpoints)
* `packages/backend/src/services/agent.service.ts` (intent recording, token minting, gateway enforcement)
* `scripts/benchmarks/pqc_benchmark.ts` (NIST FIPS 204 post-quantum migration benchmark)
* `packages/frontend/src/features/agent/` (AI agent transaction UI modal)
* Presentation slide synthesis and rehearsal coordination

#### 2. Key Deliverables
* **Monorepo & Environment Bootstrapping:**
  * Root `npm run dev` starting backend and frontend concurrently with zero errors.
  * Cross-device mobile verification: test native FIDO caBLE hybrid transport or reachable secure tunnel.
* **Risk Engine Middleware & Request-Bound Step-Up Handler:**
  * Evaluates client IP and device novelty; flags anomalies as `risk_score = HIGH` returning `403 Forbidden` with `STEP_UP_REQUIRED`, `intentId`, and `stepUpOptions`.
  * `POST /api/auth/step-up-verify` validates step-up biometric assertion and mints `step_up_authorizations` record bound to: `{ token, user_id, session_id, http_method, route, intent_hash, expires_at: 2m, consumed: false }`.
  * **Safe Step-Up Token Consumption & Idempotency:**
    * When client re-executes the sensitive action with header `X-Step-Up-Token`, middleware validates caller session, HTTP method, route, and body hash against the token record.
    * Middleware consumes token atomically (`UPDATE step_up_authorizations SET consumed = 1 WHERE token = ? AND consumed = 0`) within the same database transaction that executes the protected business operation.
    * If the operation fails business validation, the token remains consumed to prevent replay; client receives the business error and must request fresh step-up if retrying. The protected operation cannot execute twice under the same token.
* **Challenge-Bound AI-Agent Capability Gateway (Optional Differentiator):**
  * Server records structured transaction intent in database: `{ intent_id, action, recipient, max_amount, nonce, expires_at }`.
  * Generates single-use WebAuthn challenge bound to the stored intent record.
  * Validates user biometric assertion authorizing this server-bound challenge; issues signed HMAC-SHA256 capability token.
  * Gateway middleware intercepts payments: verifies token signature, checks limits, confirms recipient, and burns nonce atomically.
  * Adversarial prompt-injection test demonstrating that manipulated parameters receive `403 Forbidden`.
* **NIST FIPS 204 (ML-DSA) Post-Quantum Benchmark (Optional Research Stretch):**
  * Standalone script running 100 trials comparing classical ECDSA P-256 vs ML-DSA-44.
  * Outputs benchmark table (keygen latency, signature size 64B vs ~2,420B, verification throughput) for presentation slides.

#### 3. Interfaces & Touchpoints
* Provides `risk.middleware.ts` and `agent.routes.ts` to Sanchit for mounting in `server.ts`.
* Supplies automated attack hooks for AI delegation to Adnan for `tests/test_attacks.ts`.
* Coordinates slide deck assembly and demo rehearsals with Ananya.

#### 4. Acceptance Criteria
* `npm run dev` launches full application cleanly from root in one command.
* AI gateway rejects tampered transaction parameters with `403 Forbidden (Capability Constraint Violation)`.
* PQC benchmark script runs independently and outputs empirical comparison data without affecting core WebAuthn login.

#### 5. Freedom & Exploration Space
* Formulate risk scoring rules and anomaly thresholds.
* Design the AI transaction use case (e.g., utility bill payment or cloud subscription).
* Structure benchmark visualization and presentation narrative.

---

## 4. Comprehensive REST API Interface Contracts

> [!NOTE]
> **Illustrative Sample Values:** All challenge strings, public keys, recovery codes, token hashes, confirmation codes, and timestamps shown throughout this document are illustrative fixtures only. In implementation, all cryptographic materials, nonces, and session tokens must be freshly generated at runtime using CSPRNG libraries (`crypto.randomBytes`).

All endpoints use standard JSON payloads. All protected endpoints validate active sessions server-side.

### 4.1 Authentication Endpoints (`/api/auth`)

#### `POST /api/auth/register-challenge`
* **Request:** `{ "username": "alice" }`
* **Response (200):**
  ```json
  {
    "challenge": "dGhpcy1pcy1hLXJhbmRvbS1jaGFsbGVuZ2U",
    "rp": { "name": "TrustX SovereignPass Bank", "id": "bank.local" },
    "user": { "id": "usr_99812", "name": "alice", "displayName": "alice" },
    "pubKeyCredParams": [{ "alg": -7, "type": "public-key" }],
    "timeout": 60000
  }
  ```
* **Error (400):** `{ "error": "Username already registered" }`

#### `POST /api/auth/register-verify`
* Unconditionally assigns role `'USER'` in database (preventing privilege escalation).
* **Request:** `{ "username": "alice", "attestationResponse": { ... } }`
* **Response (200):**
  ```json
  {
    "success": true,
    "recoveryCodes": [
      "A9F2-K891-M42L", "B7X1-99Q2-P01K", "C3M8-44R9-T65N", "D1K5-88W2-Z71X",
      "E4L9-11V3-Y82M", "F8P2-33T5-X91L", "G2W7-66K1-M34P", "H5Q9-77N4-B12Z"
    ]
  }
  ```
* **Error (400):** `{ "error": "Registration verification failed" }`

#### `POST /api/auth/login-challenge`
* **Request:** `{ "username": "alice" }`
* **Response (200):**
  ```json
  {
    "challenge": "YW5vdGhlci1yYW5kb20tY2hhbGxlbmdl",
    "rpId": "bank.local",
    "allowCredentials": [{ "id": "cred_12345", "type": "public-key" }],
    "timeout": 60000
  }
  ```

#### `POST /api/auth/login-verify`
* **Request:** `{ "username": "alice", "assertionResponse": { ... } }`
* **Response (200):** Sets `Set-Cookie: session_id=...; HttpOnly; SameSite=Strict; Secure; Path=/`
  ```json
  { "success": true, "user": { "id": "usr_99812", "username": "alice", "role": "USER" } }
  ```
* **Error (401):** `{ "error": "Authentication failed: invalid assertion or origin mismatch" }`

---

### 4.2 Safe Two-Phase Recovery Endpoints (`/api/recovery`)

#### `POST /api/recovery/verify-code` (Phase 1: Verification & Intent Freeze)
* Validates recovery code against Argon2id hash.
* Generates replacement passkey registration options (`registrationOptions`) and creates a record in `pending_recoveries`:
  `{ ticket_id, user_id, verified_recovery_code_id, replacement_registration_challenge, expires_at: 5m, used: false }`.
* **The recovery code is NOT burned yet** (protects the user from lockout if biometric enrollment is cancelled or fails).
* **Request:** `{ "username": "alice", "recoveryCode": "A9F2-K891-M42L" }`
* **Response (200):**
  ```json
  {
    "success": true,
    "recoveryTicket": "rec_ticket_88291a",
    "registrationOptions": {
      "challenge": "cmVwbGFjZW1lbnQtY2hhbGxlbmdlLTk5MDFh",
      "rp": { "name": "TrustX SovereignPass Bank", "id": "bank.local" },
      "user": { "id": "usr_99812", "name": "alice", "displayName": "alice" },
      "pubKeyCredParams": [{ "alg": -7, "type": "public-key" }],
      "timeout": 60000
    },
    "expiresAt": 1728852300,
    "message": "Recovery code verified. Complete biometric enrollment with the provided registrationOptions to finalize."
  }
  ```
* **Error (400):** `{ "error": "Invalid or already consumed recovery code" }`
* **Error (429):** `{ "error": "Too many failed recovery attempts. Please try again in 15 minutes." }`

#### `POST /api/recovery/complete` (Phase 2: Concurrency-Safe Finalization & Atomic Burn)
* Validates new passkey attestation strictly against `replacement_registration_challenge` bound to `recoveryTicket`.
* **Atomic Concurrency Guarantee:** Inside a single database transaction:
  1. Rechecks ticket validity (`SELECT * FROM pending_recoveries WHERE ticket_id = ? AND used = 0 AND expires_at > ?`).
  2. Rechecks recovery code status (`SELECT * FROM recovery_codes WHERE id = ? AND consumed = 0`).
  3. If checks fail or are already satisfied by a race condition, aborts and rolls back immediately.
  4. Conditionally burns ticket and code:
     `UPDATE pending_recoveries SET used = 1 WHERE ticket_id = ? AND used = 0;`
     `UPDATE recovery_codes SET consumed = 1, consumed_at = ? WHERE id = ? AND consumed = 0;`
  5. Updates lost credentials for user to `status = 'REVOKED'`.
  6. Stores replacement passkey as `status = 'ACTIVE'`.
  7. Purges all previous active sessions in `sessions` table.
  8. Mints fresh session cookie for the newly enrolled authenticator.
* A failed, cancelled, or expired recovery attempt **never** revokes existing credentials.
* **Request:**
  ```json
  {
    "username": "alice",
    "recoveryTicket": "rec_ticket_88291a",
    "attestationResponse": { ... }
  }
  ```
* **Response (200):** Sets new session cookie
  ```json
  {
    "success": true,
    "message": "Replacement passkey enrolled. Lost credential revoked and recovery code consumed."
  }
  ```
* **Error (400):** `{ "error": "Invalid, expired, or already used recovery ticket" }`

---

### 4.3 Device Management Endpoints (`/api/devices`)

#### `GET /api/devices/list`
* **Headers:** `Cookie: session_id=...` (uses session context; does NOT accept client-supplied userId)
* **Response (200):**
  ```json
  {
    "devices": [
      { "id": "cred_1", "name": "MacBook Pro (Touch ID)", "status": "ACTIVE", "lastUsed": "2026-10-14T08:30:00Z" },
      { "id": "cred_2", "name": "iPhone 15 Pro", "status": "ACTIVE", "lastUsed": "2026-10-13T22:15:00Z" }
    ]
  }
  ```
* **Error (401):** `{ "error": "Unauthorized: invalid or terminated session" }`

#### `POST /api/devices/register-challenge` (Secondary Device Step-Up)
* **Headers:** `Cookie: session_id=...`
* **Response (200):** Returns registration options for current authenticated user.

#### `POST /api/devices/register-verify`
* **Headers:** `Cookie: session_id=...`
* **Request:** `{ "attestationResponse": { ... }, "deviceName": "iPad Air" }`
* **Response (200):** `{ "success": true, "deviceId": "cred_3" }`

#### `POST /api/devices/revoke`
* **Headers:** `Cookie: session_id=...`
* **Request:** `{ "credentialId": "cred_2" }`
* **Response (200):**
  ```json
  { "success": true, "revokedCredentialId": "cred_2" }
  ```
* **Error (403):** `{ "error": "Forbidden: credential does not belong to authenticated user" }`

---

### 4.4 Shared-Device Kiosk Endpoints (`/api/kiosk`)

> [!IMPORTANT]
> **Cross-Device Mobile Network Requirement:** An entry for `bank.local` inside a laptop's `/etc/hosts` cannot be resolved by an external smartphone. For live phone QR scanning during demo, either:
> 1. Run an HTTPS tunnel (e.g. `cloudflared tunnel`) and set `RP_ID` and `EXPECTED_ORIGIN` to the public tunnel hostname (e.g., `trustx-demo.trycloudflare.com`).
> 2. Or demonstrate the kiosk session in an incognito browser window on the laptop.

#### `POST /api/kiosk/qr-challenge`
* Initiated by the public workstation terminal. Generates a session identifier, an unguessable kiosk polling secret, and a short human-readable confirmation code.
* Stores initial state in `kiosk_authorizations` table: `{ kiosk_session_id, token, kiosk_client_secret_hash, display_code, status: 'PENDING', expires_at }`.
* **Request:** `{}`
* **Response (200):**
  ```json
  {
    "kioskSessionId": "kiosk_sess_9918a",
    "kioskClientSecret": "sec_kiosk_poll_private_9918a",
    "qrData": "https://bank.local:3000/kiosk-auth?sid=kiosk_sess_9918a&token=tok_single_use_44b",
    "displayCode": 42,
    "expiresAt": 1728852120
  }
  ```
* Terminal saves `kioskClientSecret` **only in memory** to authenticate its poll calls; displays QR code and confirmation code `42` on screen.

#### `POST /api/kiosk/qr-auth-challenge` (Phone Passkey Options Request)
* Unauthenticated smartphone visits the scanned QR URL and requests a fresh WebAuthn authentication challenge bound to this kiosk session.
* Server validates active kiosk session and single-use `token_hash`, and **strictly verifies that `username` exists and owns at least one registered active passkey (`status === 'ACTIVE'`)** before generating options (preventing phantom challenge generation or user enumeration).
* Generates WebAuthn options and cryptographically binds the challenge server-side to `{ kiosk_session_id, token_hash, user_id, username, challenge, expires_at: 60s }`.
* **Token Lifecycle:** Requesting authentication options does **NOT** consume the QR token.
* **Race & Overwrite Protection:** If an active, unexpired challenge already exists for this kiosk session, subsequent calls return the existing active challenge or are rejected to prevent an attacker from racing or overwriting the legitimate challenge.
* **Request:**
  ```json
  {
    "kioskSessionId": "kiosk_sess_9918a",
    "token": "tok_single_use_44b",
    "username": "alice"
  }
  ```
* **Response (200):**
  ```json
  {
    "challenge": "d2ViYXV0aG4tY2hhbGxlbmdlLWZvci1raW9zaw",
    "rpId": "bank.local",
    "allowCredentials": [{ "id": "cred_12345", "type": "public-key" }],
    "displayCode": 42,
    "timeout": 60000
  }
  ```
* **Error (400):** `{ "error": "Invalid, expired, or already used kiosk session token" }`
* **Error (404):** `{ "error": "User not found or no active passkeys enrolled" }`

#### `POST /api/kiosk/qr-authorize` (Mobile Phone Passkey Assertion)
* **Smartphone Authorization Flow:**
  1. Phone displays the received `displayCode` (`42`) and prompts citizen: *"Does this match the 2-digit code displayed on the kiosk screen?"*
  2. Phone prompts citizen's biometric passkey ceremony via `@simplewebauthn/browser` using the challenge from `qr-auth-challenge`.
  3. Phone posts the assertion together with the single-use token and confirmed code:
* **Request:**
  ```json
  {
    "kioskSessionId": "kiosk_sess_9918a",
    "token": "tok_single_use_44b",
    "username": "alice",
    "confirmedCode": 42,
    "assertionResponse": { ... }
  }
  ```
* **Strict Server-Side Binding Verification:**
  Backend validates all constraints inside an atomic check:
  1. `kioskSessionId` and `SHA256(token)` match an active pending kiosk record.
  2. `username` matches the exact user bound to the stored pending challenge.
  3. `confirmedCode` equals the session's `display_code` (`42`).
  4. Challenge is unexpired (`now < expires_at`).
  5. WebAuthn assertion signature matches the active challenge bound to this kiosk session.
* Upon successful validation, backend stores authenticated user session ready for kiosk claiming, atomically marks state `'AUTHORIZED'`, and burns both the challenge and the QR token.
* Rate-limited to 3 failed authorization attempts per session.
* **Response (200):** `{ "success": true, "status": "AUTHORIZED" }`
* **Error (400):** `{ "error": "Invalid confirmation code or signature verification failed" }`

#### `POST /api/kiosk/qr-poll` (Public Terminal Polling)
* The kiosk terminal polls this endpoint every 2 seconds, presenting its private `kioskClientSecret` in the **JSON request body** (never in URL query strings, keeping secrets out of server access logs).
* Rate-limited to 1 request every 2 seconds per `kioskSessionId`.
* **Request:**
  ```json
  {
    "kioskSessionId": "kiosk_sess_9918a",
    "kioskClientSecret": "sec_kiosk_poll_private_9918a"
  }
  ```
* **Response (200 - Pending):** `{ "status": "PENDING" }`
* **Response (200 - Authorized):** Sets ephemeral 15-minute `Set-Cookie: session_id=...; HttpOnly; SameSite=Strict; Secure; Path=/`.
  * Server immediately marks authorization state as claimed/destroyed so the ticket cannot be redeemed a second time.
  ```json
  { "status": "AUTHORIZED", "user": { "username": "alice" } }
  ```
* **Response (200 - Expired):** `{ "status": "EXPIRED" }`
* **Error (403):** `{ "error": "Invalid kiosk client secret" }`

---

### 4.5 AI Capability Delegation Endpoints (`/api/agent`) [Optional Extension]

#### `POST /api/agent/delegate-challenge`
* **Headers:** `Cookie: session_id=...`
* **Request:** `{ "action": "POST /api/v1/payments", "recipient": "TataPower", "maxAmount": 2000 }`
* **Response (200):**
  ```json
  {
    "intentId": "intent_7718a",
    "challenge": "dHJhbnNhY3Rpb24tYm91bmQtY2hhbGxlbmdl",
    "summary": "Authorize utility payment to TataPower up to INR 2000",
    "expiresAt": 1728852300
  }
  ```

#### `POST /api/agent/delegate-verify`
* **Headers:** `Cookie: session_id=...`
* **Request:** `{ "intentId": "intent_7718a", "assertionResponse": { ... } }`
* **Response (200):**
  ```json
  {
    "success": true,
    "capabilityToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": 1728852300
  }
  ```

#### `POST /api/agent/execute-payment`
* **Request:**
  ```json
  {
    "capabilityToken": "eyJhbGciOiJIUzI1NiIs...",
    "paymentDetails": { "recipient": "TataPower", "amount": 1800 }
  }
  ```
* **Response (200):** `{ "success": true, "txId": "tx_99812", "amount": 1800 }`
* **Adversarial Error Response (403):** `{ "error": "Capability Constraint Violation: Unauthorized recipient or amount exceeds limit." }`

---

### 4.6 Admin SOC Endpoints (`/api/admin`)

All admin endpoints strictly require `req.session.role === 'ADMIN'` and reject unauthorized access with `403 Forbidden`.

#### `GET /api/admin/credentials`
* Returns enrolled credential metadata across all users without exposing raw cryptographic keys or secrets.
* **Headers:** `Cookie: session_id=...`
* **Response (200):**
  ```json
  {
    "credentials": [
      { "id": "cred_12345", "username": "alice", "deviceName": "MacBook Pro (Touch ID)", "status": "ACTIVE", "createdAt": "2026-10-14T08:00:00Z", "lastUsedAt": "2026-10-14T08:30:00Z" },
      { "id": "cred_67890", "username": "bob", "deviceName": "iPhone 15 Pro", "status": "REVOKED", "createdAt": "2026-10-13T12:00:00Z", "lastUsedAt": "2026-10-13T18:20:00Z" }
    ]
  }
  ```
* **Error (403):** `{ "error": "Forbidden: Admin privileges required" }`

#### `GET /api/admin/sessions`
* Returns active session records across all users for SOC monitoring.
* **Headers:** `Cookie: session_id=...`
* **Response (200):**
  ```json
  {
    "sessions": [
      { "sessionId": "sess_live_1a", "username": "alice", "isKiosk": false, "ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 ... Chrome/130", "createdAt": "2026-10-14T08:30:00Z", "expiresAt": 1728880200 },
      { "sessionId": "sess_kiosk_9b", "username": "alice", "isKiosk": true, "ipAddress": "127.0.0.1", "userAgent": "Mozilla/5.0 ... Public Terminal", "createdAt": "2026-10-14T08:45:00Z", "expiresAt": 1728854700 }
    ]
  }
  ```
* **Error (403):** `{ "error": "Forbidden: Admin privileges required" }`

#### `POST /api/admin/sessions/terminate`
* Allows administrators to immediately terminate any active session server-side.
* **Headers:** `Cookie: session_id=...`
* **Request:** `{ "sessionId": "sess_kiosk_9b" }`
* **Response (200):** `{ "success": true, "terminatedSessionId": "sess_kiosk_9b" }`
* **Error (403):** `{ "error": "Forbidden: Admin privileges required" }`

#### `GET /api/admin/audit-logs`
* Returns append-only security incident logs formatted with reference to CERT-In Rule 2(v) UTC logging principles.
* **Headers:** `Cookie: session_id=...`
* **Response (200):**
  ```json
  {
    "logs": [
      {
        "id": "evt_1",
        "timestamp": "2026-10-14T08:30:00Z",
        "eventType": "USER_LOGIN_SUCCESS",
        "userId": "alice",
        "ipAddress": "127.0.0.1",
        "details": { "rpId": "bank.local", "authenticator": "Touch ID" }
      },
      {
        "id": "evt_2",
        "timestamp": "2026-10-14T08:32:15Z",
        "eventType": "PHISHING_ORIGIN_REJECTED",
        "userId": "alice",
        "ipAddress": "127.0.0.1",
        "details": { "attemptedOrigin": "https://b4nk-secure.local:3001", "result": "BLOCKED" }
      }
    ]
  }
  ```
* **Error (403):** `{ "error": "Forbidden: Admin privileges required" }`

---

### 4.7 Risk-Based Step-Up Check & Request-Bound Action Resumption

When an anomalous request or sensitive transaction triggers risk scoring (`risk_score = HIGH`):
* **Middleware Interception (403 Forbidden):**
  ```json
  {
    "error": "STEP_UP_REQUIRED",
    "reason": "Anomalous client or sensitive transaction detected. Biometric step-up confirmation required.",
    "intentId": "stepup_req_9921b",
    "stepUpOptions": {
      "challenge": "c3RlcC11cC1jaGFsbGVuZ2UtOTk1",
      "rpId": "bank.local",
      "allowCredentials": [{ "id": "cred_12345", "type": "public-key" }],
      "timeout": 60000
    }
  }
  ```

#### `POST /api/auth/step-up-verify` (Step-Up Verification)
* **Headers:** `Cookie: session_id=...`
* **Request:**
  ```json
  {
    "intentId": "stepup_req_9921b",
    "assertionResponse": { ... }
  }
  ```
* Server verifies biometric assertion against the user's active passkey.
* Creates a bound server-side authorization record in `step_up_authorizations`:
  `{ token, user_id, session_id, http_method, route, intent_hash, expires_at: 2m, consumed: false }`.
* **Response (200):**
  ```json
  {
    "success": true,
    "stepUpToken": "stp_tok_99182a44b1",
    "expiresAt": 1728852240
  }
  ```

#### Resuming the Interrupted Action (Strict Request-Binding Enforcement)
* Client re-executes the exact original API request, appending the verification token header:
  `X-Step-Up-Token: stp_tok_99182a44b1`
* Middleware validates all constraints inside a single atomic check:
  1. Token exists, is unexpired (`now < expires_at`), and `consumed === false`.
  2. Caller session matches `user_id` and `session_id`.
  3. Replayed HTTP method matches `http_method`.
  4. Target endpoint path matches `route`.
  5. Cryptographic hash of request body matches `intent_hash`.
* If any parameter differs (e.g., modified recipient or replayed against a different route), middleware rejects with `403 Forbidden`.
* If all parameters match, middleware executes `UPDATE step_up_authorizations SET consumed = 1 WHERE token = ? AND consumed = 0` atomically within the database transaction that executes the protected business operation.
* **Failure & Idempotency Semantics:** If the business operation fails (e.g., business logic validation error or invalid form data), the token remains consumed to prevent replay. The client receives the business error and must request a fresh step-up challenge if retrying. The protected operation cannot execute twice under the same token.

---

## 5. Scope Preservation & Emergency Rules

1. **Protect P0 Above All Else:** Core authentication, two-phase recovery, and device revocation are the primary grading criteria. If AI delegation or kiosk QR encounters hurdles, freeze them and polish P0.
2. **Mock-Data Fallback for UI:** Ananya can use the exact JSON schemas in Section 4 as static fixtures in `src/services/api.ts` so frontend work never blocks on backend route completion.
3. **PQC Benchmark Isolation:** The NIST FIPS 204 benchmark in `scripts/benchmarks/pqc_benchmark.ts` is strictly standalone. It must never be wired into the WebAuthn login route, and the application must never claim to be "quantum-safe" based on an isolated algorithm benchmark.
4. **Code Freeze 2 Hours Before Deadline:** At Hour 22:00, all feature development stops. The final two hours are reserved for end-to-end rehearsals, demo dry-runs, and pitch presentation polish.
5. **Bounded Security Posture & Honest Defensibility:**
   - WebAuthn origin/RP ID binding prevents credential phishing and credential relaying.
   - Transparently document residual risks: session cookie theft via endpoint malware/infostealers, physical hardware loss, recovery code social engineering, and camera shoulder-surfing.
   - Audit claims: Reference CERT-In Rule 2(v) for UTC logging conventions without asserting formal statutory audit compliance.
   - Git Workflow: Scaffolding and feature work starting on Day 2 must use individual feature branches (`feat/*`) with peer reviews before merging to local `main`.
