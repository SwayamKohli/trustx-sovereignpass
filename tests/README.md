# Automated Security Probes & Attack Suite (`tests/`)

This directory houses the automated security verification harness and adversarial attack suites used to validate the defense posture of TrustX SovereignPass.

---

## Architecture & Verification Principles

Rather than relying on static assertions or synthetic UI mocks, TrustX verifies security guarantees using **live, end-to-end HTTP probes** executed against production Express routes and an isolated, ephemeral in-memory SQLite database.

```text
tests/
├── test_attacks.ts            # Canonical CLI runner for the 10 automated security probes
├── mock_phishing_server.ts    # Mock adversary phishing server definition
└── README.md                  # Test suite documentation and attack matrix
```

---

## Canonical Attack Probes (`test_attacks.ts`)

Run the probe runner via:

```bash
npm run test:attacks
```

### The 10 Automated Attack Vectors

| Probe # | Attack Vector Description | Adversary Action | Expected Defense | Observed Result |
| :---: | :--- | :--- | :--- | :---: |
| **01** | **Look-Alike Origin Rejection** | Adversary forwards a signed WebAuthn assertion containing `clientDataJSON.origin = "https://b4nk-secure.local:3001"` to the legitimate banking backend. | Backend compares `clientDataJSON.origin` against `expectedOrigin`; strictly rejects assertion and issues no session cookie. | `PASS (HTTP 401)` |
| **02** | **Authentication Challenge Replay** | Adversary captures an authentic signed assertion and replays the same challenge in a second request. | Server invalidates challenge nonce upon first consumption; replayed challenge is rejected. | `PASS (HTTP 401)` |
| **03** | **Consumed Recovery Code Rejection** | Adversary attempts to reuse an emergency recovery code that was already burned during a previous recovery ceremony. | Two-phase recovery engine checks `consumed == 0`; atomically rejects already-consumed Argon2id hash. | `PASS (HTTP 400)` |
| **04** | **Revoked Credential Rejection** | Adversary attempts authentication using a passkey that was previously revoked by the user from another device. | Server checks database credential status `status == 'ACTIVE'`; rejects revoked credential ID. | `PASS (HTTP 401)` |
| **05** | **Terminated Session Rejection** | Adversary presents a session cookie after the administrator or user explicitly terminated the session via the Admin SOC. | Session middleware checks SQLite session store; invalidates session instantly on server side. | `PASS (HTTP 401)` |
| **06** | **Capability Parameter Tampering** | Adversary or compromised AI agent modifies transaction parameters (e.g. changing recipient from Electricity Board to Attacker, or increasing amount from ₹500 to ₹50,000). | Challenge-bound capability token (IntentLock) verifies signed parameter constraints; rejects unauthorized mutation. | `PASS (HTTP 403)` |
| **07** | **Stolen Cookie & DPoP Replay** | Infostealer malware exfiltrates the `HttpOnly` session cookie and replays it from an attacker machine lacking the client's private key. | DPoP middleware validates request-bound cryptographic proof-of-possession header against the enrolled public key. | `PASS (HTTP 401)` |
| **08** | **Step-Up Enforcement & Replay** | High-risk action executed without fresh biometric elevation, or replayed with an already-burned single-use step-up token. | Step-up middleware validates cryptographic intent hash and marks token `consumed = 1` atomically. | `PASS (HTTP 403)` |
| **09** | **Unauthorized Device Enrollment** | Attacker holding a stolen session attempts to enroll their own passkey without performing biometric step-up elevation. | **PersistenceGuard** credential firewall blocks passkey enrollment unless authorized by fresh biometric assertion. | `PASS (HTTP 401/403)` |
| **10** | **Expired Session Rejection** | Adversary submits requests using a session cookie whose timestamp exceeds absolute or idle expiry boundaries. | Session validation rejects timestamps beyond expiration threshold. | `PASS (HTTP 401)` |

---

## Execution Constraints & Test Scope

* **Deterministic In-Memory Isolation:** CLI attack probes use `process.env.DB_PATH = ':memory:'` to ensure test runs do not contaminate the primary demonstration database (`trustx.db`).
* **Hardware Authenticator Realities:** The automated probe runner uses software-generated authenticator fixtures to test server route logic. Physical Touch ID/Face ID prompt rejection and browser-layer RP ID filtering are verified interactively via the live UI at `http://localhost:3000/demo`.

---

## Primary Contributors

* **Syed Adnan Ahmed Hanfi** ([@Theshyguy01](https://github.com/Theshyguy01)) — Threat modeling, automated probe test runner (`test_attacks.ts`), phishing origin simulation harness.
* **Swayam Kohli** ([@SwayamKohli](https://github.com/SwayamKohli)) — Live router probes integration (`live-probes.ts`), IntentLock capability tampering checks, and DPoP session replay assertions.
