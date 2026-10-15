# TrustX SovereignPass — STRIDE Threat Model & Security Assurance Architecture
**CyberCup 6.0 | Problem CC6-IC04: Next-Generation Passwordless Authentication**  
**Role:** Adnan (Role 1 — Security Lead & Attack/Defense Engineer) & Swayam (Role 4 — Systems Integration)

---

## 1. System Scope & Trust Boundaries

TrustX SovereignPass re-architects digital citizen banking and public workstation access around cryptographic proof-of-possession, replacing credential-stealing vulnerable factors (passwords, SMS OTPs, static bearer session cookies).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   UNTRUSTED INTERNET                                   │
│  Adversary in the Middle (Evilginx) · DNS Spoofing · Infostealers (RedLine/Lumma)       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ TLS 1.3 Termination (mkcert / CA Root)
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ CLIENT TRUST BOUNDARY (Citizen Browser / Mobile)                                      │
│  - Non-extractable WebCrypto ECDSA P-256 Keypair (IndexedDB / memory)                 │
│  - W3C WebAuthn Authenticator (Apple Secure Enclave, Windows Hello, YubiKey 5 Series) │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ DPoP HTTP Proofs + Encrypted Sessions
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ GATEWAY TRUST BOUNDARY (TrustX SovereignPass Core)                                    │
│  - Origin Enforcement & Challenge Store (Single-Use TTL: 60s)                         │
│  - DPoP Proof Validator (Method, Path, JTI Cache, Replay Defense)                      │
│  - Contextual Risk Engine & Request-Bound Step-Up Controller                           │
│  - AI Agent Capability Gateway (HMAC-SHA256 Parameter Bounds)                         │
│  - SHA-256 Chained Tamper-Evident Forensic Audit Ledger                               │
│  - Frozen SQLite Database (Argon2id Recovery Hashes, Active/Revoked Credentials)       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive STRIDE Threat Matrix

| STRIDE Category | Threat Description | Attack Vector / Scenario | TrustX Cryptographic Defense & Architectural Mitigation | Evaluation 2 Validation Probe |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing (Identity)** | Phishing & Lookalike Domain Relay | Attacker sets up `https://b4nk-secure.local:3001` with valid TLS and lures citizen. | **Two-Layer Origin Isolation:**<br>1. Client-Side: W3C WebAuthn §5.1.3 refuses to touch authenticator credentials registered to `bank.local`.<br>2. Server-Side: `verifyAuthenticationResponse` asserts signed `clientDataJSON.origin === EXPECTED_ORIGIN`. | **Probe 1:** Origin Mismatch Probe rejects relayed assertion. |
| **Tampering** | Session Cookie Theft & Infostealer Replay | Infostealer malware dumps `session_id` cookie from browser and replays from terminal. | **RFC 9449 DPoP Device Binding:**<br>Every protected API call requires a live WebCrypto private key signature over `(method, path, jti, iat)`. Stolen cookies lack the hardware key. | **Probe 7:** Cookie replay without DPoP proof returns `401 Unauthorized (DPOP_PROOF_REQUIRED)`. |
| **Tampering** | AI Agent Prompt Injection & Parameter Divergence | LLM agent is jailbroken by prompt injection to divert payment to `Attacker_Vault`. | **Cryptographic Capability Gateway:**<br>Agent must present an HMAC-SHA256 capability token signed with user passkey assertion, binding exact recipient, max amount, and single-use nonce. | **Probe 6:** Tampered recipient / amount rejected with `403 Forbidden (CAPABILITY_CONSTRAINT_VIOLATION)`. |
| **Tampering** | Step-Up Authorization Bypassing | Attacker attempts sensitive action using expired step-up challenge or wrong path. | **Request-Bound Intent Hashing:**<br>Step-up token binds `SHA-256(method + route + body)`. Replay or cross-route reuse is rejected. | **Probe 8:** Tampered step-up intent rejected with `403 Forbidden`. |
| **Repudiation** | Denying Financial Action or Device Revocation | User or rogue employee claims audit logs were falsified or deleted after breach. | **Tamper-Evident SHA-256 Chained Audit Ledger:**<br>Every event computes `hash = SHA256(prevHash + timestamp + type + userId + details)`. Modifying any past event breaks chain integrity. | **Audit Chain Verification:** `POST /api/admin/audit-chain/verify` asserts `intact: true`. |
| **Information Disclosure** | Recovery Code Leakage in Database Dump | Attacker obtains database file and attempts to recover accounts using stored codes. | **Argon2id Cryptographic Code Hashing:**<br>Emergency codes are stored strictly as Argon2id hashes with unique salts. Verification is single-use and tickets expire in 300s. | **Probe 4:** Replayed or consumed recovery code permanently returns `400 Bad Request`. |
| **Denial of Service** | Public Workstation Session Hijacking & Abandonment | Citizen leaves public bank terminal unattended without clicking logout. | **Ephemeral Kiosk Isolation:**<br>Kiosk sessions enforce strict 15-minute server-side TTL. Browser keys are deleted on session expiration, leaving zero residual authentication artifacts. | **Kiosk Expiry Check:** Terminal session invalidates at `expiresAt`. |
| **Elevation of Privilege** | Replay of Stale Authenticator Signatures | Attacker records a valid passkey signature and replays it over the network. | **Monotonic Hardware Signature Counter:**<br>Server records `counter` for every credential. If received counter $\le$ stored counter, authenticator clone is detected and rejected. | **Probe 2:** Stale counter assertion rejected with `400 Authenticator Clone Detected`. |

---

## 3. Honest Residual Risk & Bounded Trust Declarations

To maintain absolute credibility with hackathon judges, TrustX acknowledges the following bounded residual risks:

1. **Kernel/OS Compromise on Citizen Endpoint:**  
   If an adversary possesses root / kernel-level code execution on the citizen's laptop, they can intercept unencrypted display pixels or hook user interactions. However, hardware security keys (Touch ID Secure Enclave, YubiKey) prevent extraction of private key bytes even under root compromise.
2. **Post-Quantum Cryptography in Consumer Hardware:**  
   While NIST finalized FIPS 204 (ML-DSA) in August 2024, consumer authenticators (phones and USB keys) do not yet natively execute ML-DSA-44 due to payload constraints (2,420-byte signatures). TrustX provides empirical migration benchmarks and is designed crypto-agile to adopt hybrid FIPS 204 FIDO2 extensions once standardized.
3. **Kiosk Visual Shoulder Surfing:**  
   A nearby observer can observe the 2-digit confirmation code on a shared terminal. TrustX mitigates this by requiring physical biometric touch on the user's personal smartphone before terminal session authorization occurs.

---

## 4. Regulatory Alignment Matrix

- **RBI Master Direction on Digital Payment Security:** Eliminates reliance on SMS OTP for financial authorizations.
- **CERT-In Cyber Security Directions (2022):** Tamper-evident chained audit ledger for forensic incident investigation.
- **FIDO Alliance & W3C WebAuthn Level 3:** Phishing-resistant asymmetric public-key cryptography.
- **NIST SP 800-63B AAL3:** Highest authenticator assurance level through hardware-backed cryptographic proof-of-possession.
