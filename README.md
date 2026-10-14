# TrustX SovereignPass

**Phishing-Resistant Passwordless Authentication with Shared-Device Session Security & Constrained AI-Agent Delegation**

* **Hackathon:** CyberCup 6.0
* **Problem Statement:** CC6-IC04 — Next-Generation Passwordless Authentication
* **Theme:** Theme 1: IoT & Cyber Security

---

## Overview

Authentication infrastructure faces critical challenges: credential harvesting, SIM swapping, and Adversary-in-the-Middle (AiTM) reverse-proxy phishing attacks bypass legacy passwords and SMS OTPs. Furthermore, the rapid adoption of autonomous AI agents introduces prompt-injection risks where compromised LLM agents can be manipulated into executing unauthorized transactions.

**TrustX SovereignPass** is an architectural reference implementation engineered around W3C WebAuthn Level 3 standards, statutory data protection principles, and international identity guidelines. It replaces passwords and SMS OTPs with origin-bound cryptographic passkeys, enforces strict server-side session invalidation on shared machines, and provides challenge-bound authorization for delegated AI actions.

---

## Core Capabilities

1. **Deterministic Phishing Resistance:** Cryptographically binds authentication to the relying party's exact origin and port (`https://bank.local:3000`), defeating look-alike phishing domains (`b4nk-secure.local:3001`).
2. **Shared-Device Kiosk Security:** Provides 15-minute ephemeral server sessions via cross-device QR authentication without persisting credentials on public workstations.
3. **Zero-Downgrade Account Recovery:** Eliminates SMS fallback in favor of high-entropy, single-use emergency recovery bearer secrets hashed via Argon2id and consumed atomically.
4. **Challenge-Bound AI Delegation (Optional Extension):** The relying party binds proposed agent transactions into a single-use WebAuthn challenge. The user's biometric passkey authorizes this server-bound challenge, allowing the server to issue an HMAC capability token strictly enforced by an API gateway.
5. **Post-Quantum Migration Benchmark (Optional Research Stretch):** An empirical benchmark evaluating NIST FIPS 204 (ML-DSA) key sizes, signing times, and verification latency against classical ECDSA P-256.

---

## Documentation Index

Detailed specifications and implementation guides are available in the [`docs/`](./docs) directory:

* [`docs/architecture.md`](./docs/architecture.md) — Complete system topology, cryptographic models, four user journeys, and STRIDE threat model.
* [`docs/execution-roadmap.md`](./docs/execution-roadmap.md) — Step-by-step roadmap for Day 2 preparation and the 24-hour hackathon sprint.
* [`docs/compliance-and-frameworks.md`](./docs/compliance-and-frameworks.md) — Analysis of Indian cyber regulations (DPDP Act, CERT-In Directions), international standards (NIST SP 800-63B, W3C WebAuthn), and defensible pitch claims.
* [`TEAM_TASK_BREAKDOWN.md`](./TEAM_TASK_BREAKDOWN.md) — Member folder boundaries, deliverables, API interface contracts, and Git merge rules for Adnan, Ananya, Sanchit, and Swayam.

---

## System Topology

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

## Four Core User Journeys

1. **Journey A: Passkey Onboarding & Biometric Authentication**
   * User registers username -> Touch ID / Windows Hello generates public-private keypair.
   * Server stores public key; client receives 8 single-use recovery codes (stored server-side as Argon2id hashes).
   * Subsequent sign-in verifies a cryptographic challenge over HTTPS.
2. **Journey B: Shared Workstation / Kiosk Access**
   * Public PC displays a dynamic QR challenge.
   * User approves on their smartphone -> public workstation receives a 15-minute ephemeral server session.
   * On logout or expiry, the server invalidates the session record. Zero passkey residue on the public PC.
3. **Journey C: Device Loss & Account Recovery**
   * User presents a single-use recovery code on a new machine.
   * Server validates the Argon2id hash, atomically consumes the code, enrolls a replacement passkey, and revokes the lost credential.
4. **Journey D: Multi-Device Management & Two-Layer Phishing Defense**
   * Additional devices require step-up re-authentication from an existing active credential.
   * Phishing defense verified at two layers: client authenticator refuses to offer credentials for look-alike RP IDs, and server strictly validates `expectedOrigin`.

---

## Team Role Responsibilities

| Role | Member | Title | Primary Focus | Key Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **Role 1** | **Adnan** | Security Lead & Attack/Defense Engineer | Threat modeling & attack automation | Controlled phishing site (`b4nk-secure.local`), `test_attacks.ts` suite, STRIDE threat model, judge Q&A defense. |
| **Role 2** | **Ananya** | Product, UI/UX & Admin SOC Lead | Frontend presentation & operational view | React 18 UI, accessible prompts, QR login modal, Admin SOC event log, presentation deck. |
| **Role 3** | **Sanchit** | Core Backend & Identity Lifecycle Lead | WebAuthn engine & state management | `@simplewebauthn` integration, Argon2id recovery codes, server-side session invalidation, SQLite schema. |
| **Role 4** | **Swayam** | Systems Integration & AI/Crypto Lead | Capability gateway & benchmarks | Challenge-bound AI delegation tokens, prompt-injection attack script, NIST FIPS 204 benchmark script. |

---

## Standards & Regulatory Alignment

* **DPDP Act, 2023 & DPDP Rules, 2025:** Privacy-by-Design architecture. Biometric templates remain on-device; central database stores zero biometric data.
* **CERT-In Cyber Security Directions (Rule 2(v)):** Append-only audit ledger with UTC timestamps modeling 180-day retention and incident response readiness.
* **NIST SP 800-63B:** Informed by digital identity guidelines, modeling phishing-resistant multi-factor authentication (AAL2 platform passkeys and AAL3 hardware security key characteristics) without claiming formal lab certification.
* **RBI Digital Payment Security Controls:** Contextual alignment with regulatory recommendations to phase out vulnerable SMS OTPs for high-assurance operations.
* **NIST FIPS 204 (ML-DSA):** Empirical post-quantum signature evaluation measuring latency and payload overhead for migration readiness.

---

## License

This project is developed for educational and hackathon demonstration purposes under CyberCup 6.0.
