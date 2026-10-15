# TrustX SovereignPass

**Phishing-Resistant Passwordless Authentication with Shared-Device Session Security & Constrained AI-Agent Delegation**

* **Hackathon:** CyberCup 6.0
* **Problem Statement:** CC6-IC04 — Next-Generation Passwordless Authentication
* **Theme:** Theme 1: IoT & Cyber Security

---

## Overview

For the final evaluation, start with [the current runbook and security contract](docs/final-evaluation.md). It includes IntentLock, real attack controls, test commands, the presentation sequence and explicit limits. Older roadmap documents are planning references, not implementation or compliance evidence.

Authentication infrastructure faces critical challenges: credential harvesting, SIM swapping, and Adversary-in-the-Middle (AiTM) reverse-proxy phishing attacks bypass legacy passwords and SMS OTPs. Furthermore, the rapid adoption of autonomous AI agents introduces prompt-injection risks where compromised LLM agents can be manipulated into executing unauthorized transactions.

**TrustX SovereignPass** is a working demonstration using WebAuthn passkeys, server-side shared-terminal session controls and challenge-bound authorization for delegated actions. PersistenceGuard connects a real local Ollama model to an allowlisted, disposable-account lifecycle experiment. It is not a certified identity provider or a production banking system. See the current threat model for the precise boundaries.

---

## Core Capabilities

1. **Origin-Bound Phishing Resistance:** Authenticator RP-ID checks and server challenge/origin verification reject look-alike sites. The default laptop profile uses `http://localhost:3000`; the attacker uses the distinct `http://127.0.0.1:3001` host. Named-domain and phone profiles require trusted HTTPS.
2. **Shared-Device Kiosk Security:** Provides 15-minute ephemeral server sessions via cross-device QR authentication without persisting credentials on public workstations.
3. **Zero-Downgrade Account Recovery:** Eliminates SMS fallback in favor of high-entropy, single-use emergency recovery bearer secrets hashed via Argon2id and consumed atomically.
4. **IntentLock Action Authorization:** Fresh passkey verification approves an exact sandbox operation. A persisted, session-bound opaque capability permits one matching execution; consumption, payment and audit commit atomically. This payment comparison is separate from the real local model in PersistenceGuard.
5. **Post-Quantum Migration Benchmark (Optional Research Stretch):** An empirical benchmark evaluating NIST FIPS 204 (ML-DSA) key sizes, signing times, and verification latency against classical ECDSA P-256.
6. **Guided Access and Recovery Readiness:** English/Hindi core guidance, optional local-only spoken instructions, explicit FIDO2-key choice, trusted-device QR access and fresh-passkey-protected recovery-code replacement. Basic phones alone cannot run WebAuthn.
7. **Actual Context Checks and Admin History:** Changed IP/browser context requires explicit fresh passkey verification before login completes. SOC shows paginated, filterable real login events; it does not invent locations or risk results.
8. **PersistenceGuard:** Shared fresh-authorization policy for enrollment, revocation and recovery-code replacement, with separate one-time recovery authority. Real local Qwen and Llama models propose allowlisted lifecycle actions; the experiment compares disposable weak-baseline and protected accounts, independent attacker login, unchanged authentication state and legitimate owner access. A Framer Motion evidence map offers clearly labelled replay without executing new requests. Open **Security labs → PersistenceGuard** as an administrator. See [setup and presentation steps](docs/final-evaluation.md#persistenceguard--real-local-model).

---

## Documentation Index

### Run the live same-laptop demo

```sh
npm install
npm run dev
```

This starts the bank, Vite frontend, and attacker lab together. With no local certificates, open **http://localhost:3000/demo**. The attacker is **http://127.0.0.1:3001/phishing**: use a separate window and keep the hosts distinct. `localhost` uses the browser's loopback secure-context exception; these are real backend requests, not preview mode. Do not use the internal Vite port for the live demo.

Use Node 24. The launcher detects an already-running healthy stack and avoids duplicate servers. The uncluttered header keeps advanced tools under **Security labs**; the account separates devices, recovery/security and sandbox payments. For a real iPhone QR rehearsal, use [the HTTPS setup and test guide](docs/iphone-rehearsal.md) and `npm run dev:phone`; do not open a phone's own localhost.

Register an account at the bank, save its recovery codes, and sign in. To enable SOC for a registered account, the local operator runs:

```sh
npm run admin:grant -- your-username
```

Refresh the bank and open `/admin` in another window. Use the demo arena for cookie-replay comparisons and individual attack controls, and the attacker site for synthetic-password capture and browser/server origin tests. The SOC runner executes ten measured HTTP route checks using isolated software-authenticator fixtures. It does not replace separate browser or physical-key tests. AgentShield contains IntentLock: real passkey authorization with a persistent sandbox ledger, not financial transfers. Crypto Lab never substitutes benchmark figures on failure.

For the named HTTPS demo, install trusted certificates covering `bank.local` and `b4nk-secure.local` in `certs/cert.pem` and `certs/key.pem`, and resolve both names to `127.0.0.1` in `/etc/hosts`. Restart the stack and use the configured HTTPS origins throughout. Without that setup, use the working loopback URLs above rather than an unavailable HTTPS link. `LOCAL_HTTP=1 npm run dev` explicitly selects the loopback configuration.

```sh
npm run build
npm test
npm run test:e2e --workspace=@trustx/frontend
npm run test:integration --workspace=@trustx/frontend
```

The integration test uses an isolated temporary database and virtual authenticators to exercise bank registration/login, the separate attacker site, SOC evidence, agent bounds, kiosk approval, device revocation, recovery and session termination. Existing databases are preserved. Audit rows are anchored once on upgrade; subsequent verification detects changes against stored anchors, not pre-upgrade tampering or a full rewrite of both data and anchors.

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

* **Data minimization:** Authentication uses public-key verification; this server does not receive biometric templates. It does store usernames, credential metadata, recovery hashes, sessions and security events.
* **Audit evidence:** UTC events and stored hash anchors support the demonstrated integrity checks. Enforced 180-day retention, clock synchronization and full-database tamper resistance are not established.
* **Authentication assurance:** No FIDO certification, NIST AAL assessment, WCAG certification or legal/regulatory compliance determination has been obtained. Production readiness requires deployment-specific review, operations and independent testing.
* **ML-DSA research:** The standalone benchmark measures signing/verification and payload trade-offs; it does not make WebAuthn login post-quantum or establish implementation certification.

---

## License

This project is developed for educational and hackathon demonstration purposes under CyberCup 6.0.
