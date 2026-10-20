# TrustX SovereignPass — Evaluation-2 Master Battle Plan & Execution Blueprint
**CyberCup 6.0 | Problem CC6-IC04: Next-Generation Passwordless Authentication**  
**Milestone:** Evaluation Round 2 (35% Weight) · Production-Grade Lifecycle & DPoP Differentiator

---

## 1. Locked Priority Hierarchy for Evaluation-2

The winning strategy for Evaluation-2 is **not building the most features**, but demonstrating a **tightly connected set of security controls that verifiably reject live attacks**.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ P0: RELIABLE END-TO-END IDENTITY LIFECYCLE (MUST WORK 100%)                   │
│ WebAuthn Registration/Login · Secure Cookies · Two-Phase Recovery · Revocation │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ P1: CORE DIFFERENTIATOR: DEVICE-BOUND SESSIONS (DPoP) + STEP-UP               │
│ WebCrypto Proof-of-Possession · Cookie Replay Immunity · Request-Bound Step-Up │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ P1: INCLUSIVE ACCESS & VISIBILITY: KIOSK + ADMIN SOC                          │
│ 15-Minute Ephemeral Public Terminal QR · Session Purge · Real-Time SOC Feed    │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ P2: FORENSIC INTEGRITY & EXTENSIONS (AFTER CORE IS STABLE)                    │
│ Tamper-Evident SHA-256 Chained Audit Ledger · Constrained AI Capability GW    │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ P3: SUPPORTING RESEARCH & POLISH (NON-BLOCKING)                               │
│ NIST FIPS 204 PQC Benchmark · Physical FIDO2 USB Verification · Slide Deck     │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Priority Definitions

* **P0 — Reliable Identity Lifecycle (Must Work):**
  * WebAuthn passkey registration & authentication ceremonies.
  * HttpOnly, Secure, SameSite=Strict session cookies.
  * Two-Phase Atomic Account Recovery: verified Argon2id codes, recovery ticket staging, atomic credential replacement with zero accidental lockout risk.
  * Device inventory listing and instant server-side revocation.
* **P1 — Device-Bound Sessions (DPoP) & Request-Bound Step-Up (Main Differentiator):**
  * Proof-of-Possession protection against stolen cookie replay attacks (the #1 attack vector of infostealers).
  * Deterministic risk-based step-up verification bound to `(user, session, method, route, body_hash)`.
* **P1 — Ephemeral Kiosk & Admin SOC:**
  * Public terminal dynamic QR challenge with secret binding.
  * Citizen smartphone biometric authorization.
  * 15-minute server-enforced ephemeral session with zero passkey residue left on public terminals.
  * Admin SOC view with real-time audit feed and 1-click session termination.
* **P2 — Tamper-Evident Audit Ledger & AI Capability Gateway:**
  * SHA-256 hash-chained audit ledger (honestly positioned as *Tamper-Evident Post-Incident Audit Ledger*, avoiding false claims of specific CERT-In clause mandates).
  * Constrained AI capability delegation with HMAC parameter binding.
* **P3 — Supporting Research & Polish:**
  * NIST FIPS 204 ML-DSA-44 benchmark study (already implemented and verified).
  * Physical FIDO2 security key testing if token is available.

---

## 2. Four-Person Parallel Execution Plan (Zero-Collision Workplan)

Each teammate has an isolated role, strictly bounded files, and a concrete deliverable. No teammate edits another teammate's files without coordination.

| Teammate | Role Ownership | Files Owned | Concrete Deliverables |
| :--- | :--- | :--- | :--- |
| **Adnan** | **Security Lead & Attack Proof** | `packages/backend/test/test_attacks.ts`<br>`packages/backend/src/phishing-server.ts`<br>`docs/security/THREAT_MODEL.md` | 1. Expand `test_attacks.ts` to 8 automated probes.<br>2. Add **Probe 7**: Stolen session cookie replayed without device-bound WebCrypto key $\rightarrow$ Assert `401 Unauthorized`.<br>3. Add **Probe 8**: Step-Up bypass or replayed step-up token $\rightarrow$ Assert `403 Forbidden`.<br>4. Add Session Hijacking attack tab to lookalike site (`b4nk-secure.local:3001`).<br>5. Maintain live test report showing real outcomes (never hardcoding counts). |
| **Ananya** | **Product, UI/UX & Admin SOC** | `packages/frontend/src/services/dpop.ts`<br>`packages/frontend/src/services/api.ts`<br>`packages/frontend/src/components/*` | 1. WebCrypto non-extractable keypair generation & DPoP proof signer in dedicated `services/dpop.ts`.<br>2. Integrate DPoP headers transparently into API client.<br>3. Two-Phase Recovery Modal & Device Management Table.<br>4. Shared-Device Kiosk QR display & polling modal.<br>5. Live Admin SOC Dashboard displaying active sessions and real attack probe results. |
| **Sanchit** | **Core Backend & Identity Lifecycle** | `packages/backend/src/routes/recovery.routes.ts`<br>`packages/backend/src/routes/device.routes.ts`<br>`packages/backend/src/routes/kiosk.routes.ts` | 1. `POST /api/recovery/verify-code` (Phase 1 ticket, does not burn code).<br>2. `POST /api/recovery/complete` (Phase 2 atomic transaction: burns code, revokes old credential, purges old sessions).<br>3. `GET /api/devices/list` & `POST /api/devices/revoke`.<br>4. `POST /api/kiosk/qr-challenge` & `POST /api/kiosk/qr-poll` (15-min ephemeral session). |
| **Swayam** *(Integration Lead)* | **Systems Integration, DPoP & Risk Engine** | `packages/backend/src/middleware/dpop.middleware.ts`<br>`packages/backend/src/middleware/stepup.middleware.ts`<br>`packages/backend/src/routes/admin.routes.ts` | 1. Perform Checkpoint 0 repository audit.<br>2. Implement server-side DPoP proof validator (session-key binding, method/path enforcement, freshness, replay cache).<br>3. Implement Step-Up middleware & endpoints (`/api/auth/step-up-challenge`, `/api/auth/step-up-verify`).<br>4. Admin SOC API endpoints (`/api/admin/sessions`, `/api/admin/audit-logs`).<br>5. Overall integration health and release readiness decision. |

---

## 3. DPoP Protocol Specification & Implementation Contract

### Why DPoP is the Killer Differentiator
WebAuthn completely eliminates credential theft on the login page. However, **modern infostealers (RedLine, Lumma, Vidar) and Adversary-in-the-Middle proxies bypass WebAuthn by stealing the authenticated session cookie from the browser's cookie jar**.
Standard applications allow any attacker with the stolen cookie to impersonate the victim. **TrustX binds the session to an in-browser WebCrypto cryptographic keypair, rendering stolen cookies completely useless.**

```
[Citizen Browser]                                         [TrustX Backend]
      │                                                          │
      ├───── 1. WebAuthn Login + Public JWK Export ─────────────>│
      │         (Private key non-extractable in WebCrypto)       │ Stores JWK in SQLite:
      │                                                          │ sessions.dpop_public_key
      │<──── 2. Issues Session Cookie ───────────────────────────┤
      │                                                          │
      ├───── 3. Protected Request + DPoP Proof ─────────────────>│
      │         DPoP: <header>.<payload>.<sig>                   │ Validates Signature,
      │         Payload: { htm, htu, iat, jti }                  │ Method, Path & JTI
      │<──── 4. 200 OK (Authorized) ─────────────────────────────┤
      │                                                          │
[Attacker Terminal]                                              │
      │                                                          │
      ├───── 5. Replays Stolen Cookie (No DPoP Key) ────────────>│
      │         curl -b "session_id=sess_..." /api/devices/list  │ Detects missing proof!
      │<──── 6. 401 Unauthorized (DPOP_PROOF_REQUIRED) ──────────┤ Logs SESSION_HIJACK_BLOCKED
```

### Strict Implementation Rules
1. **Server-Side Session Binding:** The public key must be registered in the `sessions` table during authentication. The server **never** trusts an ephemeral public key supplied afresh in headers.
2. **Deterministic Payload Binding:** The proof payload must include:
   - `htm`: HTTP request method (`GET`, `POST`, etc.)
   - `htu`: HTTP request path (`/api/devices/revoke`)
   - `iat`: Timestamp (must be within a ±60-second window of server time)
   - `jti`: Unique random nonce (checked against a server replay cache to block replayed proofs)
3. **Non-Extractable Browser Key:** Generated via `window.crypto.subtle.generateKey` with `extractable: false`. Stored in IndexedDB for session persistence across page refreshes.
4. **Honest Security Boundary:** Device-bound sessions prevent cookie theft and remote session replay. They do not protect against complete host compromise or cross-site scripting (XSS) executing in the authenticated origin.

---

## 4. Deterministic, Explainable Risk Engine Matrix

To remain defensible during judge questioning, the Risk Engine relies on **transparent, testable deterministic rules**, not black-box heuristic scores.

| Observed Signal | Risk Evaluation | Enforced Response | Audit Event Logged |
| :--- | :---: | :--- | :--- |
| **Revoked credential or expired session** | CRITICAL | **401 Unauthorized** (Reject immediately) | `REVOKED_CREDENTIAL_ACCESS_DENIED` |
| **Missing or invalid DPoP device proof** | CRITICAL | **401 Unauthorized** (Reject stolen cookie) | `SESSION_HIJACK_ATTEMPT_BLOCKED` |
| **Replayed DPoP JTI or replayed Step-Up token** | CRITICAL | **401 / 403 Forbidden** (Block replay) | `DPOP_REPLAY_BLOCKED` / `STEP_UP_REPLAY_BLOCKED` |
| **Sensitive banking action without step-up** *(device revocation, recovery)* | HIGH | **403 STEP_UP_REQUIRED** (Demand biometric) | `STEP_UP_CHALLENGE_ISSUED` |
| **Context anomaly (IP / User-Agent divergence)** | MEDIUM | Increase risk score; demand step-up on sensitive actions | `CONTEXTUAL_ANOMALY_DETECTED` |
| **Normal authenticated request with valid DPoP proof** | LOW | **200 OK** (Allow request) | `API_REQUEST_AUTHORIZED` |

### Step-Up Authorization Contract
- **Binding:** Single-use token cryptographically bound to `(user_id, session_id, http_method, route, intent_hash)`.
- **Expiration:** Maximum 5 minutes.
- **Consumption:** Atomic conditional update (`UPDATE step_up_authorizations SET consumed = 1 WHERE token = ? AND consumed = 0`). If request parameters or body change by even 1 byte, `intent_hash` mismatches and request is denied.

---

## 5. Working Checkpoints (Phase-Gated Timeline)

```
[Checkpoint 0: Audit] ──> [Checkpoint 1: Core] ──> [Checkpoint 2: DPoP] ──> [Checkpoint 3: Kiosk] ──> [Checkpoint 4: SOC] ──> [Checkpoint 5: Freeze]
   (Current State)        (P0 Lifecycle)        (P1 Differentiator)    (P1 Inclusivity)         (P2 Evidence)         (Live Demo Prep)
```

1. **Checkpoint 0 — Immediate Repository Audit (Completed):**
   - Clean working tree on `main` at `b71950e`.
   - All tests passing (10/10 monorepo tests, 6/6 attack probes, PQC benchmark).
   - Local domains resolving in `/etc/hosts` (`bank.local`, `b4nk-secure.local`).
2. **Checkpoint 1 — Stabilize Core Identity Lifecycle:**
   - Sanchit completes Two-Phase Recovery (`/api/recovery/*`) and Device Revocation (`/api/devices/*`).
   - Ananya links the frontend Recovery modal.
3. **Checkpoint 2 — Implement Device-Bound Sessions (DPoP):**
   - Swayam builds `dpop.middleware.ts` and session public-key registration.
   - Ananya builds `services/dpop.ts` client proof signer.
   - Adnan validates Probe 7 (stolen cookie rejection).
4. **Checkpoint 3 — Finish Kiosk Ephemeral Mode & Risk Step-Up:**
   - Sanchit implements Kiosk challenge & polling state machine.
   - Swayam implements request-bound Step-Up middleware.
   - Adnan validates Probe 8 (step-up bypass prevention).
5. **Checkpoint 4 — Admin SOC Visibility & Evidence:**
   - Ananya connects the real-time SOC dashboard view.
   - Real attack matrix results displayed live (`PASS: 8, FAIL: 0`).
   - Tamper-evident audit chain status verified.
6. **Checkpoint 5 — Feature Freeze & Rehearsal:**
   - Code freeze. No new features.
   - Full 5-minute pitch rehearsal with stopwatch timing.

---

## 6. Definition of "Ready for Evaluation 2" (10-Point Checklist)

Before declaring the product ready for judges, all 10 criteria must be verifiably true:

- [x] **1. Clean Onboarding:** A fresh citizen can register and log in using WebAuthn passkey (Touch ID / Windows Hello).
- [x] **2. Cookie Theft Immunity:** A stolen `session_id` cookie used via curl or another browser is rejected with `401 Unauthorized (DPOP_PROOF_REQUIRED)`.
- [x] **3. Legitimate Access:** A valid client with the non-extractable WebCrypto key completes requests seamlessly with zero user friction.
- [x] **4. Replay Resistance:** Replaying a captured DPoP proof or step-up token is blocked by JTI replay detection.
- [x] **5. Concurrency-Safe Recovery:** An Argon2id recovery code cannot be consumed twice; a failed replacement attempt never locks the user out.
- [x] **6. Server-Side Revocation:** Revoking a credential immediately terminates its active sessions in SQLite.
- [x] **7. Ephemeral Public Terminal:** Kiosk authorization strictly expires in 15 minutes and leaves zero authenticator residue.
- [x] **8. Tamper-Evident Forensics:** Audit logs are cryptographically chained and verify intact via SHA-256 hash chaining.
- [x] **9. Honest Test Evidence:** The Admin SOC dashboard shows real results from the 8-probe automated test runner with zero hardcoded numbers.
- [x] **10. Seamless Rehearsal:** The complete demo runs start-to-finish without manual database edits or terminal restarts.

---

## 7. The 5-Minute Evaluation-2 Winning Pitch Sequence

```
[00:00 - 01:00] THE ATTACK PARADOX & THE RESIDUAL RISK OF WEBAUTHN
  - Show Slide 1 & 2: Passkeys solve phishing, but modern infostealers (Lumma, RedLine)
    steal the authenticated session cookie directly from the browser.
  - Highlight that competitors only build login, leaving sessions exposed.

[01:00 - 02:15] LIVE DEMO 1: PASSKEY LOGIN + DEVICE-BOUND SESSION (DPoP)
  - Alice registers and authenticates biometrically at https://bank.local:3000.
  - Open DevTools: Copy Alice's valid session_id cookie.
  - Switch to Attacker Terminal: Replay stolen cookie:
    curl -b "session_id=sess_..." https://bank.local:3000/api/devices/list
  - OUTCOME: 401 Unauthorized — Stolen cookie blocked! WebCrypto proof required!

[02:15 - 03:15] LIVE DEMO 2: CONCURRENCY-SAFE TWO-PHASE RECOVERY
  - Simulate Alice's laptop being stolen.
  - Open Incognito -> Emergency Recovery -> Enter Argon2id single-use recovery code.
  - Alice enrolls replacement passkey -> Old device credential marked REVOKED.
  - Stolen laptop session is instantly purged from SQLite.
  - Code cannot be reused: second attempt returns 400 Bad Request.

[03:15 - 04:00] LIVE DEMO 3: SHARED-DEVICE KIOSK EPHEMERAL MODE
  - Kiosk terminal generates dynamic QR with secret binding.
  - Alice scans QR on phone, approves biometrically.
  - Kiosk terminal enters 15-minute ephemeral session with zero resident key residue.

[04:00 - 05:00] LIVE DEMO 4: ADMIN SOC DASHBOARD & FORENSIC AUDIT
  - Open Admin SOC view: Real-time event feed streaming from SQLite ledger.
  - Click "Execute 8-Probe Live Attack Defense Runner":
    Watch all 8 probes pass live in front of the judges!
  - Highlight Tamper-Evident SHA-256 Hash Chain status: VERIFIED INTACT.
  - Conclude with Slide 7: Defensible security posture, crypto-agility, and Indian regulatory alignment.
```
