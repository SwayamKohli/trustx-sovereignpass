# TrustX SovereignPass — Master System Architecture & Technical Specification

> Historical design, not current implementation evidence. Use [the final-evaluation contract](final-evaluation.md) and [current threat model](security/THREAT_MODEL.md). IntentLock now uses a persisted opaque capability and exact amount matching, not the HMAC spending-ceiling design below. GuardianMesh is not implemented; no live LLM or quantum-safe login is connected. Benchmark values must come from the current runner, not old illustrative sizes/trial counts.

**Project Codename:** TrustX SovereignPass  
**Hackathon:** CyberCup 6.0 | Problem Statement: CC6-IC04 (Theme 1: IoT & Cyber Security)  
**Classification:** Phishing-Resistant Passwordless Authentication with Shared-Device Session Security & Constrained AI-Agent Delegation  

---

## 1. Executive Summary & Problem Framing

Authentication infrastructure faces critical challenges: credential harvesting, SIM swapping, and Adversary-in-the-Middle (AiTM) reverse-proxy phishing attacks bypass legacy passwords and SMS OTPs. In India, fraudsters exploit SMS OTPs to execute extortion and identity fraud schemes. Furthermore, the rapid emergence of autonomous AI agents introduces an alarming new attack surface: prompt-injection attacks that can manipulate an agent into executing unauthorized transactions.

TrustX SovereignPass addresses these challenges through an architectural reference implementation engineered in alignment with statutory data protection principles and international cryptographic identity standards:

1. **W3C WebAuthn Level 3 / FIDO2 Passkeys:** Eliminates passwords and shared secrets through origin-bound asymmetric public-key cryptography.
2. **Deterministic Phishing Resistance:** Cryptographically binds authentication to the relying party domain and port (`https://bank.local:3000`), defeating look-alike phishing attacks (`b4nk-secure.local:3001`).
3. **Shared-Device Kiosk Security:** Delivers 15-minute ephemeral server-side sessions via QR cross-device authentication without leaving persistent credentials on public machines.
4. **Zero-Downgrade Account Recovery:** Replaces SMS fallback with single-use, high-entropy emergency recovery bearer secrets hashed via Argon2id and consumed atomically.
5. **Challenge-Bound AI-Agent Delegation (Optional Extension):** The relying party constructs an authentication challenge cryptographically bound to proposed agent action parameters (`SHA-256(user + action + recipient + max_amount + nonce)`). The user's passkey authorizes this server-bound challenge during standard WebAuthn verification, after which the server issues a constrained, time-limited HMAC capability token enforced by the API gateway against prompt-injection tampering.
6. **Empirical Post-Quantum Migration Benchmark (Optional Research Stretch):** Evaluates NIST FIPS 204 (ML-DSA) performance and payload trade-offs for future-ready identity engineering.

---

## 2. End-to-End System Architecture

```
           [ CLIENT TIER ]                                    [ SERVER & GATEWAY TIER ]
 +---------------------------------+                    +---------------------------------+
 | USER AUTHENTICATOR (Client)     |                    | TRUSTX APPLICATION SERVER       |
 | - Touch ID / Windows Hello      |                    | (Node.js + Express + TypeScript)|
 | - FIDO2 USB/NFC Hardware Key    |                    |                                 |
 | - Secure Enclave / TPM (Local)  |                    | * Relying Party Engine          |
 +----------------+----------------+                    |   (@simplewebauthn/server)      |
                  | FIDO2 / CTAP2                       | * Session & Kiosk Lifecycle     |
                  v                                     | * Argon2id Recovery Engine      |
 +---------------------------------+   Local HTTPS      | * Capability Delegation Gateway |
 | PRESENTATION BROWSER (React 18) | <----------------> | * Append-Only Audit Ledger      |
 | Origin: https://bank.local:3000 |                    +----------------+----------------+
 +---------------------------------+                                     |
                  ^                                                      | Local SQLite
                  | Phishing Attempt Blocked                             v
 +----------------+----------------+                    +---------------------------------+
 | LOOK-ALIKE ADVERSARY SITE       |                    | EMBEDDED AUDIT & STATE STORE    |
 | Origin: https://b4nk-secure...  |                    | * Users, Credentials, Sessions  |
 +---------------------------------+                    | * Argon2id Recovery Code Hashes |
                                                        | * CERT-In Style Audit Events    |
                                                        +---------------------------------+
```

---

## 3. Four Core User Journeys

### Journey A: Passkey Onboarding & Biometric Authentication
* **Enrollment:** User enters a username (e.g., `alice`). The browser requests attestation options from the relying party server. The authenticator prompts the user (Touch ID / Windows Hello / hardware key) and creates an asymmetric keypair.
* **Storage:** The server verifies the ceremony and stores the public key, credential ID, and metadata. The server never receives or stores biometrics.
* **Emergency Recovery Issuance:** The system displays 8 single-use recovery bearer codes (e.g., `A8F2-99K1-M42L`). The user saves them offline; the server stores only Argon2id salted hashes.
* **Subsequent Login:** The server issues an expiring challenge. The authenticator signs over `clientDataJSON` and `authenticatorData`. The server verifies the assertion and issues an HttpOnly, SameSite=Strict session cookie.

### Journey B: Shared Computer / Kiosk Access
* **Context:** User accesses an untrusted shared terminal (e.g., college lab or public computer).
* **Cross-Device Flow:** The public terminal displays a dynamic QR challenge. The user scans it with their personal smartphone (using native FIDO hybrid transport or a reachable secure tunnel).
* **Biometric Approval:** The user approves the login prompt on their phone with a fingerprint or facial scan.
* **Ephemeral Session:** The public terminal receives a 15-minute ephemeral server session. On explicit logout or after 15 minutes of inactivity, the server invalidates the session record. Zero passkey credentials remain stored on the public terminal.

### Journey C: Device Loss & Account Recovery
* **Context:** The user loses their registered device and sets up a new machine with no passkey.
* **Recovery Ceremony:** The user selects "Recover Account" and provides their username and one emergency recovery code.
* **Atomic Verification:** The server validates the code against stored Argon2id hashes and marks it `consumed = true` in an atomic database transaction.
* **Credential Replacement:** The server immediately marks the lost credential `status = 'REVOKED'`, terminates active sessions for that credential, and guides the user to register a fresh passkey.

### Journey D: Multi-Device Management & Two-Layer Phishing Defense
* **Adding Devices:** Adding a secondary device requires step-up re-authentication using an active trusted credential.
* **One-Click Revocation:** An admin or user can revoke any device from the dashboard, immediately invalidating its credential and terminating its active server sessions.
* **Two-Layer Phishing Defense:**
  * *Client Layer:* Visiting a look-alike phishing domain (`https://b4nk-secure.local:3001`) causes the authenticator to discover zero matching credentials for that RP ID, refusing to offer or unlock the bank passkey.
  * *Server Layer:* If an attacker attempts to forward an assertion signed for `b4nk-secure.local:3001` to the genuine backend, the server's `expectedOrigin` check rejects it with an `OriginMismatchError`.

---

## 4. Technical Deep Dives & Security Controls

### Component 1: WebAuthn Foundation & Two-Layer Phishing Defense
* **Library Stack:** Implemented using `@simplewebauthn/server` and `@simplewebauthn/browser`.
* **Zero Biometrics on Server:** The relying party database stores only public keys (`credentialPublicKey`). Biometric matching is confined entirely to the client device's Secure Enclave, TPM, or hardware token.
* **Strict Origin & Port Binding:**
  * Genuine Relying Party: `https://bank.local:3000`
  * Look-alike Phishing Domain: `https://b4nk-secure.local:3001`
  * The browser captures the calling origin (including port) in `clientDataJSON.origin`.
  * The relying party strictly enforces `clientDataJSON.origin === expectedOrigin`.
* **Two-Layer Phishing Test:**
  * *Layer 1 (Browser/Client RP ID Isolation):* When a user visits `https://b4nk-secure.local:3001`, the browser scopes credentials to RP ID `b4nk-secure.local`. It discovers zero matching credentials and refuses to offer or unlock the genuine passkey.
  * *Layer 2 (Server-Side Validation):* The backend independently tests rejection of invalid or mismatched assertions: an assertion claiming an unexpected origin or bearing an invalid cryptographic signature is immediately rejected with `OriginMismatchError`.
* **Signature Counter Handling:**
  * Some platform authenticators (such as Apple iCloud Keychain) consistently return `signCount = 0` to preserve user privacy.
  * Counter rollbacks are flagged as an anomaly signal only when `lastCounter > 0` and `incomingCounter <= lastCounter`.

---

### Component 2: Multi-Device Management & Kiosk Security
* **Device Enrolment Authorization:** Enrolling an additional passkey requires active re-authentication with an existing trusted credential.
* **Kiosk Session Mechanics:**
  * A web application cannot force remote operating system keychains to purge credentials.
  * To prevent passkey residue on shared machines, public computers **never enroll a local passkey**.
  * Access is mediated via cross-device QR approval (testing either native FIDO caBLE hybrid transport or a reachable secure tunnel where `rpID` and `expectedOrigin` match the tunnel hostname) or a dedicated removable FIDO2 USB key.
  * Sessions on shared terminals carry a strict 15-minute time-to-live.
* **Authoritative Server-Side Session Revocation:**
  * When a user logs out or revokes a device, the server deletes the corresponding session record from the database.
  * Every protected API endpoint verifies active session existence. Once deleted, any request using that session cookie immediately receives `401 Unauthorized`.

---

### Component 3: Account Recovery Engine & Lockout Prevention
* **The Problem:** Falling back to SMS OTPs or security questions re-exposes accounts to SIM swapping and social engineering.
* **Safe Two-Phase Atomic Recovery (Lockout Prevention):**
  * 8 high-entropy alphanumeric codes generated at initial onboarding, stored strictly as **Argon2id salted hashes**.
  * Sensitive bearer secrets: users must store them securely offline; server enforces rate limiting on verification attempts.
  * *Phase 1 (Verification):* User submits a recovery code. The server validates it against the stored Argon2id hash and issues a temporary, short-lived (5-minute) recovery ticket. **The code is not permanently consumed yet**, preventing permanent lockout if the browser crashes or replacement registration is interrupted.
  * *Phase 2 (Atomic Finalization):* The user completes replacement passkey enrollment. Only upon **successful verification of the new passkey assertion**, the server atomically burns the recovery code (`consumed = true`), marks the lost credential `status = 'REVOKED'`, and terminates all old sessions.
* **Tier 2 (Optional Stretch — P3): GuardianMesh Shamir Secret Sharing:**
  * Master recovery secret split into 3 polynomial shards ($S_1, S_2, S_3$).
  * Any 2 guardians approve via their passkeys to reconstruct the recovery secret, with a 24-hour time-lock cancellation window.

---

### Component 4: Challenge-Bound AI-Agent Delegation (Optional Extension)
* **The Problem:** Providing autonomous AI agents with static credentials or passwords exposes systems to prompt-injection tampering.
* **Structured Intent Binding Mechanism:**
  1. The user reviews and delegates an action: *"Pay utility bill of INR 1,800 to TataPower."*
  2. The server records a pending transaction intent in `delegation_intents` with canonical parameters:
     `{ intent_id, user_id, action: "POST /api/v1/payments", recipient: "TataPower", max_amount: 2000, nonce, expires_at }`.
  3. The server generates a single-use WebAuthn challenge cryptographically bound to this stored intent record.
  4. The user authorizes this server-bound challenge via biometric passkey in a standard WebAuthn ceremony.
  5. The server validates that the WebAuthn assertion authorizes the specific challenge.
  6. Upon server verification, the server issues a constrained capability token (HMAC-SHA256 signed by the server) carrying the approved intent parameters:
     ```json
     {
       "delegation_id": "del_99812a",
       "user_id": "usr_alice",
       "action": "POST /api/v1/payments",
       "recipient": "TataPower",
       "max_amount": 2000,
       "nonce": "e4f891ac3b",
       "expires_at": 1728852000
     }
     ```
  7. The AI agent submits the transaction with this capability token.
  8. **Gateway Enforcement:** The API gateway independently verifies that `recipient === approved_recipient`, `amount <= max_amount`, and `nonce` is unspent. If prompt injection attempts to redirect funds to an unauthorized wallet, the gateway rejects the request with `403 Forbidden`.

---

### Component 5: NIST FIPS 204 (ML-DSA) Post-Quantum Benchmark (Optional Research Stretch)
* **Research Context:** W3C WebAuthn currently relies on classical elliptic curves (secp256r1 / P-256), which are susceptible to Shor's algorithm on a cryptographically relevant quantum computer.
* **Benchmark Scope:** A standalone migration readiness benchmark comparing classical ECDSA P-256 with NIST FIPS 204 ML-DSA-44:
  * Measures key generation time, signature generation latency, verification throughput, and signature payload sizes across 100 trials.
  * Quantifies the protocol impact of larger post-quantum signatures (64 bytes vs ~2,420 bytes).

---

## 5. Scope Prioritization Matrix

```
+----------------------------------------------------------------------------------------+
|                              SCOPE PRIORITIZATION MATRIX                               |
+----------------------------------------------------------------------------------------+
| P0 (CORE MUST-HAVES):                                                                  |
|  - WebAuthn registration and biometric login (@simplewebauthn).                        |
|  - Two-layer phishing defense test (client RP isolation + server origin check).        |
|  - Single-use Argon2id offline recovery codes + atomic consumption + revocation.       |
|  - Multi-device management (trusted device approval) + server-side session revoke.     |
|  - Shared-Device Mode: 15-minute ephemeral sessions without persistent local passkeys. |
|  - Risk-based checks (unusual IP or client novelty triggers re-authentication).        |
|  - Admin view: registered devices, login history, revoked credentials, audit events.   |
|  - Inclusivity: accessible UI, clear non-technical prompts, reachable QR login.        |
|  - Formal STRIDE Threat Model document.                                                |
|                                                                                        |
| P1 (HIGH PRIORITY TESTING LAB):                                                        |
|  - Repeatable automated test suite: origin mismatch, replayed challenge, reused code,  |
|    revoked credential rejection, terminated session rejection.                         |
|                                                                                        |
| P2 (OPTIONAL DIFFERENTIATOR — AI-AGENT DELEGATION):                                    |
|  - Challenge-bound capability tokens; gateway blocks prompt injection tampering.       |
|                                                                                        |
| P3 (OPTIONAL RESEARCH STRETCH BACKLOG):                                                |
|  - Physical FIDO2 USB/NFC security key testing on hardware.                            |
|  - Shamir's Secret Sharing (2-of-3) guardian recovery workflow with 24h delay alert.   |
|  - NIST FIPS 204 (ML-DSA) post-quantum signature benchmark suite.                      |
|                                                                                        |
| FUTURE RESEARCH BACKLOG (Documented for Q&A, Not Built in 24h):                        |
|  - USSD / GSM signaling, Bluetooth mesh, acoustic proximity, visual cards.             |
+----------------------------------------------------------------------------------------+
```

---

## 6. Formal Threat Model & Residual Risk Matrix

| Threat | Planned Defense | Verification Evidence |
| :--- | :--- | :--- |
| **Look-alike Phishing Origin** | WebAuthn RP-ID & origin verification | Client offers 0 passkeys; server rejects mismatched origin. |
| **Replayed Authentication Challenge** | Single-use expiring challenge bound to session | Replayed assertion fails server verification. |
| **Account Recovery Abuse** | Argon2id hashed codes, atomic consumption, rate limits | Reused code is rejected; brute force blocked. |
| **Unauthorized Device Enrolment** | Step-up re-authentication on existing trusted credential | Unverified enrolment attempt is denied. |
| **Lost or Stolen Device** | Server-side credential revocation & session termination | Revoked credential and active session cookies stop working. |
| **Shared Computer Key Residue** | Shared-Device Mode with 15-minute ephemeral sessions | Public PC stores zero persistent credentials. |
| **QR Cross-Device Relay** | Expiring challenge, domain display, number confirmation | Expired or mismatched QR request is rejected. |
| **AI Agent Prompt Injection** | Challenge-bound server-enforced capability constraints | Tampered recipient or amount is rejected (`403 Forbidden`). |
| **Residual Risk (Session Theft)** | Short session TTL (15m), HttpOnly cookies, IP-binding checks | Stolen session cookies mitigated by short lifetime and re-auth. |
| **Out-of-Scope (Malware / Rootkit)** | Documented limitation: untrusted OS cannot compromise Secure Enclave private key. | Formally documented in presentation slides. |

---

## 7. Standards Alignment Summary

* **DPDP Act, 2023 & DPDP Rules, 2025:** Privacy-by-Design architecture. Zero biometric templates stored on servers.
* **CERT-In Cyber Security Directions (Rule 2(v)):** Append-only audit ledger with UTC timestamps modeling 180-day retention.
* **NIST SP 800-63B Alignment:** Informed by digital identity guidelines, modeling phishing-resistant multi-factor authentication without claiming formal lab certification.
* **RBI Sectoral Context:** Strategic alignment with recommendations to mitigate SMS OTP vulnerabilities in payment workflows.
* **NIST FIPS 204 (ML-DSA):** Reference standard for the standalone post-quantum signature benchmark.
