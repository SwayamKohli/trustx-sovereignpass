# TrustX SovereignPass — Statutory Compliance, Security Frameworks & Defensible Claims Guide

**Definitive Guide to Indian Regulations, International Standards, and Judge-Proof Claims for CyberCup 6.0 (CC6-IC04)**

---

## 1. Executive Summary & Philosophy of Defensible Claims

In cybersecurity hackathons, claiming "100% DPDP Compliant", "Certified AAL3", or "Unbreakable Post-Quantum Security" undermines credibility before experienced cybersecurity evaluators. A software prototype built in a hackathon setting has not undergone third-party SOC 2 audits, ISO 27001 certification, or formal regulatory filings.

Instead, **TrustX SovereignPass** adopts an audit-grade communication posture:

> *"TrustX is an architectural reference implementation engineered in alignment with statutory data protection principles and international cryptographic identity standards. Every security claim is backed by deterministic automated tests, and every system limitation is transparently documented."*

### The 4-Tier Claim Classification System

```
+----------------------------------------------------------------------------------------+
|                        TRUSTX 4-TIER DEFENSE CLASSIFICATION                            |
+----------------------------------------------------------------------------------------+
| [1. IMPLEMENTED & TESTED]     | Live, verified in code with passing test suites        |
| [2. DESIGNED WITH REFERENCE]  | Architecture strictly models statutory/NIST guidelines |
| [3. EXPERIMENTAL BENCHMARK]   | Standalone empirical research & migration study        |
| [4. FUTURE WORK BACKLOG]      | Formal compliance audits & production operational steps|
+----------------------------------------------------------------------------------------+
```

---

## 2. Indian Statutory & Regulatory Landscape

```
                     +---------------------------------------------------+
                     |          INDIAN CYBER-LEGAL JURISPRUDENCE         |
                     +-------------------------+-------------------------+
                                               |
         +------------------------+------------+-----------+------------------------+
         v                        v                        v                        v
+------------------+    +------------------+    +------------------+    +------------------+
|  DPDP Act, 2023  |    | CERT-In Dir 2022 |    |  RBI DPSC, 2021  |    |  GIGW 3.0 / WCAG |
|  Privacy & SPDI  |    | 180-Day ICT Logs |    | Sector Context   |    |  Accessibility   |
+------------------+    +------------------+    +------------------+    +------------------+
```

### 2.1 Digital Personal Data Protection Act, 2023 (DPDP Act) & DPDP Rules, 2025
*Statutory Authority: Ministry of Electronics and Information Technology (MeitY), Government of India.*

#### Statutory Provisions & TrustX Architecture
* **Section 8(5) — Reasonable Security Safeguards:** Data Fiduciaries must protect personal data in their possession by taking reasonable security safeguards to prevent personal data breaches.
  * *TrustX Alignment:* WebAuthn eliminates central credential databases. There are no shared secrets, plaintext passwords, or reversible hashes in our database that could be leaked in a database breach.
* **Data Minimization & Storage Limitation:** Processing only what is strictly necessary.
  * *TrustX Alignment:* The relying party server stores **zero biometrics**. Biometric templates (fingerprints, face scans) never leave the user's secure hardware enclave (Apple Secure Enclave, Android StrongBox, Windows TPM). The server stores only the public key, credential ID, signature counter, and Argon2id-hashed recovery codes.
* **Server Data Footprint Reality:**
  * While biometrics are zero-server, the system does process and store account identifiers (usernames), public keys, device metadata, session tokens, and audit event logs.
  * *Legal Stance:* We do not claim "zero personal data." We state: *"Biometric templates remain strictly on-device; server stores minimal pseudonymized public keys and device identifiers governed by configurable retention policies."*
* **Phased Commencement Reality:**
  * The DPDP Act, 2023 and DPDP Rules, 2025 have phased implementation timelines.
  * *Judge-Proof Pitch:* *"Our architecture is engineered proactively around DPDP privacy-by-design requirements, ensuring institutional readiness as rules become legally operative."*

---

### 2.2 CERT-In Cyber Security Directions (28 April 2022)
*Statutory Authority: Indian Computer Emergency Response Team under Section 70B(6) of the Information Technology Act, 2000.*

#### Statutory Provisions & TrustX Architecture
* **Rule 2(v) — 180-Day ICT System Log Retention:** Mandatory obligation for intermediaries, corporate entities, and service providers to maintain all system logs for a rolling period of 180 days within Indian jurisdiction.
  * *TrustX Alignment:* The database audit ledger implements an append-only schema:
    ```sql
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      event_type TEXT NOT NULL,
      details JSON NOT NULL,
      ip_address TEXT,
      timestamp TEXT NOT NULL -- UTC ISO-8601 format for NTP synchronization
    );
    ```
* **NTP Synchronization Requirement:** All systems must synchronize their ICT clocks with the National Physical Laboratory (NPL) or NIC NTP servers.
  * *TrustX Alignment:* Server-side event timestamps are generated in ISO-8601 UTC format, explicitly designed for centralized NTP synchronization.
* **Cyber Incident Audit Trail:**
  * TrustX explicitly logs incident-relevant anomalies: `ORIGIN_MISMATCH_REJECTED`, `REPLAY_ATTACK_DETECTED`, `REVOKED_CREDENTIAL_ATTEMPT`, and `RECOVERY_CODE_CONSUMED`.
* *Defensible Stance:* Do not claim *"Our prototype is CERT-In certified."* CERT-In does not certify hackathon apps. State: *"The Admin SOC event feed is engineered with reference to CERT-In Rule 2(v) audit trail and timestamping principles to facilitate forensic incident response."*

---

### 2.3 Information Technology Act, 2000 & SPDI Rules, 2011
*Statutory Authority: Government of India (IT Act Sections 43A, 66C, 66D).*

* **Section 43A & SPDI Rules (Sensitive Personal Data or Information):**
  * Historically governed passwords, financial information, and biometric data.
  * The DPDP Act provides for the eventual omission of Section 43A upon full operationalization.
  * *TrustX Alignment:* Demonstrates how migrating from legacy passwords to FIDO2 passkeys de-risks the entity from storing biometric SPDI or plaintext passwords on central servers.
* **Section 66C (Identity Theft) & Section 66D (Cheating by Impersonation):**
  * Addresses India's epidemic of OTP harvesting and cyber-extortion scams.
  * *TrustX Alignment:* Because WebAuthn private keys are origin-bound and hardware-isolated, a fraudster impersonating an authority on a phone call cannot compel a victim to dictate an SMS OTP. The victim's device will physically refuse to produce a cryptographic signature for an attacker-controlled origin.

---

### 2.4 Reserve Bank of India (RBI) Regulatory Context
*Reference: RBI Master Direction on Digital Payment Security Controls (2021) & Cyber Security Framework for Banks.*

* **Sectoral Context (Not a Blanket Mandate):**
  * The RBI Digital Payment Security Controls apply specifically to **regulated entities** (banks, payment aggregators, PPI issuers).
  * RBI working groups and regulatory advisories emphasize the vulnerabilities of SMS-based two-factor authentication (SIM swapping, SS7 interception, social engineering) and advocate strong, verifier-bound authentication.
* *TrustX Alignment:*
  * TrustX serves as an architectural prototype demonstrating how financial applications can transition away from fragile SMS OTPs toward phishing-resistant asymmetric cryptographic keys.
  * In the AI Delegation flow, fund transfers require explicit challenge binding: transaction parameters (amount, recipient, nonce) are cryptographically bound to the user's biometric assertion.
* *Defensible Stance:* Do not claim *"RBI has mandated passkeys for all applications"* or *"TrustX is RBI certified."* State: *"TrustX draws inspiration from RBI's strategic guidance on digital payment security controls and SMS OTP risk mitigation to demonstrate a phishing-resistant authentication workflow."*

---

### 2.5 GIGW 3.0 & WCAG 2.1 Accessibility Guidelines
*Statutory Authority: Guidelines for Indian Government Websites (GIGW 3.0) / MeitY & W3C Web Content Accessibility Guidelines.*

* **Digital Inclusivity Target:**
  * Authentication systems must not exclude citizens who have motor disabilities, visual impairments, or low digital literacy.
* *TrustX Alignment:*
  * High-contrast UI (WCAG 2.1 AA compliant color ratios).
  * Fully operable via keyboard navigation (Tab / Enter / Space without mouse traps).
  * Assistive guidance: Clear citizen prompts (*"Please touch your fingerprint sensor or insert your security key"*) instead of raw cryptographic error strings.
  * Hardware Token Support: For users without biometric smartphones, physical FIDO2 USB/NFC security keys provide an accessible path.

---

## 3. International Cryptographic & Security Standards

```
+----------------------------------------------------------------------------------------+
|                        INTERNATIONAL TECHNICAL STANDARDS                               |
+----------------------------------------------------------------------------------------+
| W3C WebAuthn Level 3 (FIDO2)  | Origin-Bound Asymmetric Cryptography (Public-Key Cred) |
| NIST SP 800-63B / SP 800-63-4 | Digital Identity Guidelines & Architectural Reference  |
| NIST FIPS 204 (ML-DSA)        | Post-Quantum Module-Lattice Digital Signatures         |
| OWASP ASVS v4.0               | Application Security Verification Standard             |
+----------------------------------------------------------------------------------------+
```

### 3.1 W3C WebAuthn Level 3 & FIDO Alliance (CTAP 2.2)
*Standard: W3C Recommendation & FIDO Alliance Client-to-Authenticator Protocol.*

* **Origin & Port Binding Mechanism:**
  * The browser cryptographically collects the calling origin (`clientDataJSON.origin`) directly from the browser context, including the non-default port:
    $$\text{assertion.origin} == \text{"https://bank.local:3000"}$$
  * The authenticator signs over a SHA-256 hash of this `clientDataJSON`.
* **Two-Layer Phishing Defense:**
  1. *Client/Authenticator Isolation:* When a user visits a look-alike domain (`https://b4nk-secure.local:3001`), the authenticator queries credentials for RP ID `b4nk-secure.local`. It discovers zero matching credentials and refuses to offer or sign with the `bank.local` passkey.
  2. *Server-Side Origin Enforcement:* If an attacker attempts to proxy an assertion with origin `https://b4nk-secure.local:3001` to `bank.local`, the server-side `verifyAuthenticationResponse` immediately throws an `OriginMismatchError` and blocks authentication.
* **Signature Counter Semantics:**
  * Apple Touch ID / Face ID (iCloud Keychain) and many mobile authenticators return `signCount = 0` by design for privacy.
  * Counter rollbacks are evaluated as an anomaly signal only when `lastCounter > 0` and `incomingCounter <= lastCounter`.

---

### 3.2 NIST SP 800-63-4 & SP 800-63B (Digital Identity Guidelines)
*Standard: National Institute of Standards and Technology (NIST Special Publication).*

#### Removing Blanket AAL Guarantees
* **The NIST Reality:** Formal Authenticator Assurance Level 3 (AAL3) requires an extensive, validated security posture: FIPS 140 validated hardware authenticators, non-exportable keys, verifier-impersonation resistance across all touchpoints, and comprehensive verifier operational controls.
* Multi-device syncable passkeys (e.g., Apple iCloud Keychain, Google Password Manager) replicate private keys across cloud keychains and therefore align with **AAL2** multi-factor guidelines, not AAL3.
* **TrustX Defensible Position:**
  > *"TrustX is **informed by and architected with reference to NIST SP 800-63B guidelines**. We implement phishing-resistant public-key authentication for everyday devices (modeling AAL2 characteristics) and support non-exportable FIDO2 hardware security keys (modeling AAL3 characteristics), without claiming formal laboratory certification."*
* **Account Recovery Security (Bearer Secret Handling):**
  * NIST SP 800-63B warns against security degradation during recovery (e.g., reverting to SMS OTP).
  * TrustX uses high-entropy, single-use emergency recovery codes hashed with **Argon2id**.
  * **Honest Security Reality:** Recovery codes are **sensitive bearer secrets** (similar to offline backup keys); they are not origin-bound like passkeys. They must be stored securely offline and are protected on the server by strict rate-limiting, Argon2id salting, and atomic consumption.

---

### 3.3 NIST FIPS 204 (ML-DSA) Post-Quantum Cryptography Standard
*Standard: National Institute of Standards and Technology (FIPS 204, August 2024).*

* **The Quantum Reality:**
  * W3C WebAuthn standards currently operate on classical elliptic curves (secp256r1 / P-256). These are vulnerable to Shor's algorithm on a cryptographically relevant quantum computer.
* **TrustX Benchmark Scope:**
  * TrustX does not claim to make WebAuthn quantum-proof today.
  * We build an **empirical migration research benchmark** comparing classical ECDSA P-256 against NIST FIPS 204 ML-DSA-44:
    * Keygen time, verification throughput, and signature payload sizes across 100 trials.
    * Highlights the engineering challenge: ECDSA signatures are **64 bytes**; ML-DSA-44 signatures are **~2,420 bytes** (a 38x payload increase).
* *Defensible Claim:* *"Our PQC benchmark is a standalone migration study evaluating NIST FIPS 204 ML-DSA to quantify latency and bandwidth trade-offs for future post-quantum identity protocols."*

---

### 3.4 OWASP ASVS v4.0 & Server-Side Session Invalidation
*Standard: Open Web Application Security Project (OWASP) Application Security Verification Standard v4.0.*

* **Server-Side Session Invalidation Reality:**
  * The server cannot remotely force a client browser to delete its cookies over the air.
  * *Implementation:* When a user logs out or revokes a device, the server **purges the session record in the database/store**.
  * Every protected API endpoint verifies session existence in the database. When the session record is deleted, subsequent requests with that cookie fail immediately with `401 Unauthorized`.

| ASVS Section | Verification Control Requirement | TrustX SovereignPass Technical Defense |
| :--- | :--- | :--- |
| **V2.1 (Passwordless)** | Phishing-resistant credential verification | Asymmetric public key assertion bound to server origin and cryptographic challenge. |
| **V2.8 (Recovery)** | Single-use recovery secrets | Offline emergency codes stored strictly as Argon2id hashes, consumed atomically. |
| **V3.2 (Session Binding)**| Secure session cookie properties | Cryptographically random session IDs stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies. |
| **V3.3 (Session Termination)**| Authoritative server-side revocation | Server purges session records on logout/revocation; all API middleware validates session active state. |
| **V4.2 (Access Control)**| Principle of least privilege for automated tools | AI Agent Capability Gateway strictly checks transaction bounds (`recipient`, `max_amount`, `nonce`). |
| **V7.1 (Audit Logging)** | Forensic audit trails for security events | Append-only database ledger recording timestamps, event types, IP addresses, and outcomes. |

---

## 4. Master Defensibility Matrix: What to Say vs. What NOT to Say

| Topic / Area | Typical Hackathon Claim (Vulnerable to Attack) | The Underlying Technical / Legal Reality | TrustX Defensible Pitch Wording (Judge-Proof) |
| :--- | :--- | :--- | :--- |
| **DPDP Act Compliance** | *"Our application is 100% compliant with the DPDP Act 2023."* | Hackathon prototypes cannot be legally certified; DPDP Rules have phased commencement. | *"Designed around DPDP privacy-by-design and data minimization principles; central server stores zero biometric templates."* |
| **CERT-In Logging** | *"Our project is CERT-In certified and compliant."* | CERT-In does not certify apps. Local logs are not an enterprise SIEM. | *"Our logging architecture models CERT-In Rule 2(v) requirements, capturing 180-day retention fields and NTP-synchronized audit trails."* |
| **NIST AAL3 Assurance** | *"Our passkey system provides certified AAL3 assurance."* | True AAL3 requires certified hardware, specific verifier controls, and formal lab validation. Synced passkeys are AAL2. | *"Informed by NIST SP 800-63B guidelines, modeling AAL2 multi-factor characteristics and supporting FIDO2 hardware security keys."* |
| **RBI Regulations** | *"RBI mandates passkeys and has approved our system."* | RBI directions apply to regulated financial entities and do not blanket-mandate passkeys everywhere. | *"Draws from RBI's digital payment security controls and strategic emphasis on phasing out vulnerable SMS OTPs."* |
| **Burner Passkeys** | *"We create burner passkeys that auto-purge from client devices."* | Web apps cannot force operating systems or browsers to delete stored passkeys. | *"Shared-Device Kiosk Mode with 15-minute ephemeral server sessions; no persistent credential is saved on the shared PC."* |
| **Session Revocation** | *"The server deletes the cookie from the user's remote browser."* | The server cannot delete remote cookies over the air; it must invalidate the session record in the backend store. | *"Server-side session invalidation immediately purges the session record, rejecting all subsequent requests with 401 Unauthorized."* |
| **Phishing Defense** | *"A fake website produces an assertion which the bank rejects."* | Authenticators will not offer or sign passkeys for mismatched RP IDs in the browser in the first place. | *"Demonstrates two-layer defense: client authenticator refuses to sign for fake RP IDs, and server strictly validates expectedOrigin."* |
| **Recovery Codes** | *"Our recovery codes are completely phishing-proof."* | Recovery codes are sensitive bearer secrets; if entered into a fake site, they could be phished. | *"High-entropy single-use recovery bearer secrets stored as Argon2id hashes, protected by atomic consumption and rate limiting."* |
| **Post-Quantum Security**| *"Our passwordless authentication is completely quantum-safe."* | W3C WebAuthn standards use classical P-256 curves; Shor's algorithm still threatens them. | *"Presents a standalone NIST FIPS 204 (ML-DSA) migration benchmark evaluating key size and verification latency trade-offs."* |
| **AI Agent Delegation** | *"The passkey directly signs arbitrary transaction JSON data."* | WebAuthn authenticators cannot sign raw JSON; the passkey authorizes a server-bound challenge embedding the transaction hash. | *"The user authorizes a server-bound challenge embedding the transaction parameters; the server issues a constrained capability token enforced by the gateway."* |

---

## 5. Pitch Deck Blueprint: The Compliance & Assurance Slide

### Slide Blueprint: "Security Assurance, Privacy by Design & Standards Alignment"

```
+----------------------------------------------------------------------------------------+
|               SLIDE 8: SECURITY ASSURANCE & STANDARDS ALIGNMENT                        |
+----------------------------------------------------------------------------------------+
|                                                                                        |
|  [INDIAN REGULATORY CONTEXT]                  [INTERNATIONAL SECURITY STANDARDS]       |
|  -------------------------                    ---------------------------------        |
|  * DPDP Act, 2023 Principles:                 * W3C WebAuthn Level 3 (FIDO2):          |
|    Zero Server Biometrics (Data Minimization)   Origin-bound asymmetric cryptography   |
|  * CERT-In Directions 2022:                   * NIST SP 800-63B Alignment:             |
|    Rule 2(v) 180-Day Audit Logging Model        Informed by multi-factor identity specs|
|  * RBI Sectoral Context:                      * OWASP ASVS v4.0 Checklist:             |
|    Mitigating SMS OTP vulnerabilities           Server-side session & access controls  |
|                                                                                        |
+----------------------------------------------------------------------------------------+
|  [CRYPTOGRAPHIC INTEGRITY & RESEARCH BENCHMARK]                                        |
|  ---------------------------------------------                                         |
|  * Single-Use Account Recovery: Sensitive bearer secrets stored strictly as Argon2id   |
|  * NIST FIPS 204 (ML-DSA) Migration Benchmark: Empirical evaluation of PQC signatures   |
|  * Honest Residual Risk Stance: Endpoint malware & session theft explicitly documented |
+----------------------------------------------------------------------------------------+
```

### 30-Second Presenter Pitch Script
> *"Judges, rather than making unverified claims of blanket compliance, TrustX is architected with strict reference to established Indian cyber regulations and international cryptographic standards.*
>
> *Under India's DPDP Act, we implement strict Privacy-by-Design: biometric verification remains 100% on the user's hardware device, so our database stores zero biometric data. For incident response, our admin ledger models CERT-In Rule 2(v) 180-day logging with UTC timestamps. Furthermore, our project reflects RBI's strategic emphasis on mitigating SMS OTP risks in digital transactions.*
>
> *On the international standard front, we adhere to W3C WebAuthn Level 3 and are informed by NIST SP 800-63B identity guidelines. For emergency recovery, we use single-use secrets hashed with Argon2id. Finally, we provide an empirical benchmark against NIST FIPS 204 ML-DSA to evaluate the future performance overhead of post-quantum migration."*

---

## 6. Judge Cross-Examination Defense (Anticipated Questions & Answers)

### Question 1: "How can you say this is DPDP compliant when the rules are still being phased in?"
* **Defensive Response:** *"You are completely right, sir. The DPDP Act, 2023 and DPDP Rules, 2025 have phased commencement, and full institutional compliance requires registered data fiduciaries and consent management. What we are stating is that our **data architecture follows DPDP privacy-by-design and data minimization principles**: by leveraging WebAuthn, our servers never receive, store, or process biometric templates, eliminating the primary risk of central biometric credential leaks under Indian law."*

### Question 2: "Can an attacker who steals the session cookie bypass your passkey protection?"
* **Defensive Response:** *"Yes, that is an accurate and honest observation. WebAuthn protects the **authentication ceremony**—an adversary-in-the-middle phishing site cannot steal the private key or log in as the victim. However, post-login session hijacking via compromised local endpoints is an active residual risk. We mitigate this with short 15-minute session lifetimes, `HttpOnly` and `SameSite=Strict` cookies, anomalous IP risk flags, and an immediate 1-click server-side session termination API in the user dashboard."*

### Question 3: "Are your recovery codes phishing-proof like passkeys?"
* **Defensive Response:** *"No, sir. We are very transparent about this: recovery codes are **sensitive bearer secrets**, not origin-bound cryptographic keys like passkeys. If a user were tricked into entering a recovery code on a fraudulent site, it could be captured. To protect against this, our server hashes them with **Argon2id**, enforces strict rate-limiting on recovery attempts, and consumes each code atomically upon first use so that an attacker cannot replay it."*

### Question 4: "Is your system really quantum-proof?"
* **Defensive Response:** *"No, our WebAuthn login is not quantum-proof today, because current W3C WebAuthn standards and browser authenticators only support classical curves like P-256 and Ed25519. What we have built is an **empirical migration research benchmark** using NIST FIPS 204 ML-DSA to measure keygen time, verification speed, and the 38x payload difference. This allows security architects to understand the exact latency and bandwidth impact when browsers eventually adopt post-quantum authenticators."*
