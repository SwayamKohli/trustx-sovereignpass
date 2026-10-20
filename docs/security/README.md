# Security & Threat Modeling (`docs/security/`)

This directory houses the formal threat modeling and architectural security analysis for TrustX SovereignPass.

---

## Directory Contents

| Document | Primary Maintainer | Description |
| :--- | :--- | :--- |
| [`THREAT_MODEL.md`](./THREAT_MODEL.md) | **Syed Adnan Ahmed Hanfi** | Formal STRIDE threat analysis, asset boundaries, attack surface enumeration, covered defenses, and residual risk disclosures. |

---

## The STRIDE Security Matrix Summary

| STRIDE Category | Threat Description | TrustX SovereignPass Mitigation | Residual Risk / Operational Boundary |
| :--- | :--- | :--- | :--- |
| **Spoofing Identity** | Adversary tricks user into entering credentials on look-alike phishing domain (`b4nk-secure.local`). | W3C WebAuthn RP ID scoping prevents browser from releasing keys; server strictly verifies `clientDataJSON.origin`. | Compromise of client operating system kernel or browser process memory. |
| **Tampering with Data** | Attacker or rogue AI agent modifies transaction amount or destination account. | Challenge-bound single-use capability tokens (**IntentLock**) cryptographically sign amount and recipient. | User blindly approving high amounts on authentic biometric prompt. |
| **Repudiation** | User or administrator claims an action was executed by an attacker. | Tamper-evident append-only SQLite audit ledger with SHA-256 integrity hash chaining. | Storage drive corruption or administrator deleting raw database file. |
| **Information Disclosure** | Infostealer malware reads session cookie from victim browser. | Device-Bound Sessions (**DPoP**) require client private key proof-of-possession; **PersistenceGuard** blocks credential changes. | Full remote access trojan (RAT) actively operating the user's browser in real-time. |
| **Denial of Service** | Adversary rapidly exhausts recovery codes or floods challenge generation. | Progressive IP rate limiting, exponential backoff, and atomic database row reservation. | Distributed network volumetric DDoS (requires cloud WAF / CDN edge). |
| **Elevation of Privilege** | Attacker holding active session enrolls own passkey or revokes victim. | **PersistenceGuard** credential firewall strips credential-altering authority from regular sessions; requires biometric step-up. | Attacker coercing user to provide physical biometric touch. |

---

## Primary Contributor

* **Syed Adnan Ahmed Hanfi** ([@Theshyguy01](https://github.com/Theshyguy01)) — STRIDE analysis, attack surface cataloging, threat modeling documentation.
