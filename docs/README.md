# TrustX SovereignPass Documentation Hub (`docs/`)

Welcome to the comprehensive documentation repository for **TrustX SovereignPass**, built for **CyberCup 6.0 (Problem Statement CC6-IC04: Next-Generation Passwordless Authentication)**.

---

## Documentation Roadmap

```text
docs/
├── architecture.md               # Master technical architecture & cryptographic specifications
├── final-evaluation.md           # Live demonstration runbook, test guides, and operational boundaries
├── compliance-and-frameworks.md  # Regulatory mapping (CERT-In, RBI, DPDP Act 2023, NIST SP 800-63B)
├── execution-roadmap.md          # 24-hour sprint milestones, task progression, and deliverables
├── iphone-rehearsal.md           # Real mobile device HTTPS & camera QR rehearsal guide
├── security/                     # Threat modeling and security verification
│   ├── README.md                 # Security overview & STRIDE category breakdown
│   └── THREAT_MODEL.md           # Comprehensive STRIDE threat model & residual risk disclosures
├── archive/                      # Historical hackathon records, pitch scripts & battle plans
│   ├── README.md                 # Archive index & document manifest
│   ├── TEAM_TASK_BREAKDOWN.md    # Original team ownership matrix, interfaces & git rules
│   ├── master-task-checklist.md  # Master 24-hour task tracker across P0/P1/P2
│   ├── target-users-and-final-battle-plan.md
│   ├── pitch-deck-and-judge-defense-strategy.md
│   ├── evaluation2-pitch-deck-and-demo-script.md
│   ├── evaluation2-battle-plan-and-execution.md
│   ├── statutory-compliance-and-security-frameworks.md
│   ├── day2-and-hackathon-execution-steps.md
│   └── cybercup-ic04-supercharged-blueprint.md
└── README.md                     # This documentation hub
```

---

## Primary Technical Guides

### 1. [Master Architecture (`architecture.md`)](./architecture.md)
* Comprehensive breakdown of the WebAuthn ceremony lifecycle (registration & authentication).
* Single Unified Origin reverse-proxy routing architecture (`bank.local:3000`).
* SQLite database relational schema (9 normalized tables, Argon2id hashing, ACID transactions).
* Two-phase concurrency-safe account recovery engine with lockout prevention.
* Shared-device kiosk architecture with short-lived QR challenges and ephemeral 15-minute sessions.
* **IntentLock** capability gateway for constrained AI-agent transaction execution.

### 2. [Final Evaluation & Live Runbook (`final-evaluation.md`)](./final-evaluation.md)
* The official evaluation runbook used during final judge assessment.
* Step-by-step instructions for running the live same-laptop multi-window demonstration:
  * Legitimate Bank: `http://localhost:3000/demo`
  * Adversary Lab: `http://127.0.0.1:3001/phishing`
* Setup guide for **PersistenceGuard** connected to a real local Ollama LLM (`qwen3:1.7b` / `llama3.2:1b`).
* Verification commands, automated probe execution, and explicit technical non-claims.

### 3. [Security & Threat Model (`security/THREAT_MODEL.md`)](./security/THREAT_MODEL.md)
* Full STRIDE threat model evaluating Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege.
* Attack surface enumeration, mitigations, and explicit residual risk disclosures.

### 4. [Compliance & Statutory Frameworks (`compliance-and-frameworks.md`)](./compliance-and-frameworks.md)
* Regulatory mapping against:
  * **CERT-In Cyber Security Directions (April 2022):** Mandatory NTP clock synchronization, tamper-evident audit logging, and 6-hour incident reporting readiness.
  * **RBI Master Directions on Digital Payment Security:** Phishing-resistant MFA mandates, dynamic linking of transaction authenticators, and session invalidation rules.
  * **Digital Personal Data Protection (DPDP) Act 2023:** Data minimization (biometric templates never leave the citizen's Secure Enclave/TPM), explicit consent flows, and purpose limitation.
  * **NIST SP 800-63B Authentication Assurance Level 3 (AAL3):** Hardware-backed cryptographic authenticators, verifier impersonation resistance, and zero SMS/voice OTP fallback.

### 5. [Mobile iPhone / Android Rehearsal (`iphone-rehearsal.md`)](./iphone-rehearsal.md)
* Detailed procedure for configuring local CA trust on iOS/Android devices.
* Setting up LAN IP routing for live cross-device biometric passkey authentication and kiosk QR scanning.

---

## Authors & Contributors

* **Swayam Kohli** ([@SwayamKohli](https://github.com/SwayamKohli)) — Architecture, system integration, compliance mapping, final runbook, and AI delegation.
* **Sanchit Mishra** ([@san-10-max](https://github.com/san-10-max)) — Core backend routes, database schema, recovery engine, and kiosk lifecycle.
* **Ananya Robinson** ([@ananya411-robinson](https://github.com/ananya411-robinson)) — Evaluation 2 runbooks, frontend interface contracts, and Admin SOC design.
* **Syed Adnan Ahmed Hanfi** ([@Theshyguy01](https://github.com/Theshyguy01)) — STRIDE threat modeling, phishing adversary design, and attack automation.
