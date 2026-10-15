# Final evaluation: build, test and present

This is the current demo contract. Earlier Day 2 documents describe plans, not proof of implementation. Ananya is handling integration across the original team boundaries for this final pass.

## Start here

```sh
npm install
npm run dev
```

Open `http://localhost:3000/demo`. Register a new demo account, save all eight recovery codes, then sign in. Grant that registered account SOC access from a second terminal:

```sh
npm run admin:grant -- your-username
```

Refresh the browser. Use these windows side by side:

| Window | URL | Purpose |
| --- | --- | --- |
| Genuine application | `http://localhost:3000` | Passkey, account and sandbox payments |
| Attacker lab | `http://127.0.0.1:3001/phishing` | Synthetic password capture and origin checks |
| SOC observer | `http://localhost:3000/admin` | Actual events, route probes and audit verification |
| IntentLock observer | `http://localhost:3000/agent` | Persisted ledger and authorization events |

Keep `localhost` and `127.0.0.1` distinct. Do not demonstrate on the internal Vite port. Existing unbound sessions must sign in again after this upgrade. The stack uses localhost secure-context support unless trusted HTTPS certificates and both named domains have been configured.

Use Node 24. `npm run dev` now checks occupied ports: it reuses a complete healthy running stack without starting a duplicate, or explains a partial/conflicting stack without killing anything. Stop your existing stack with Ctrl+C before changing profiles. The normal HTTP bank and attacker bind to loopback; only the explicit HTTPS bank profile is reachable from the phone's network.

The ordinary interface is intentionally small: **Access help**, **Sign in/My account**, and a collapsed **Security labs** menu. Open the menu for Demo arena, AgentShield and Crypto Lab. The account has **Devices and access**, **Security and recovery**, and **Sandbox payments** tabs; SOC is available only to an operator-granted administrator.

## Core acceptance checklist — do these first

Use invented demo details, keep recovery codes private, and record actual outcomes. A green automated test is not proof that your physical device worked.

| Requirement | How to check | Expected result |
| --- | --- | --- |
| Passwordless | Register using Mac Touch ID, save eight codes, sign out, sign in | Native passkey prompts; no password/SMS; registered device visible |
| Phishing | Open the separate attacker window and run both origin checks | Browser rejects the wrong RP; server rejects the wrong origin; no usable bank credential captured |
| Recovery | Perform the replacement flow below with a saved code | Old passkeys/sessions revoked only after successful replacement; reused code rejected |
| Device lifecycle | Add a second real authenticator if available, then revoke it | Existing-passkey approval before enrollment; revoked device cannot sign in |
| Inclusivity | Open Access help; switch EN/हिन्दी; read/listen; test phone QR | Guided choices, local-voice fallback, authenticated limited terminal session |
| Risk checks | Change actual browser User-Agent after a successful sign-in, then sign in again | Explicit extra passkey check before a new session; cancel gives no new login |
| Admin | Grant role, open SOC device inventory, login history and audit | Real device/revocation data, bounded actual login events and working filters |

**Your hardware:** Mac Touch ID and an iPhone. Do not choose the external security-key option unless you actually obtain a FIDO2 key; a storage USB is not one. The external-key branch is covered by a virtual USB authenticator test, not by a physical-key rehearsal. Follow [the complete iPhone HTTPS and QR guide](iphone-rehearsal.md) for the real phone test. A basic phone alone cannot execute WebAuthn; the inclusive options require access to a trusted passkey device or an actual security key plus a capable computer.

### Guided access and language

Open **Access help** to select existing passkey, security key, trusted-device QR, or recovery. Switch to हिन्दी and verify the core sign-in, recovery and QR guidance. **Listen to instructions** speaks only static instructions using a locally available matching-language voice. It never reads recovery codes or account details. If that voice is unavailable, written guidance remains available and the UI says so; there is no cloud voice fallback or voice-based identity proof. Technical labs and some status labels remain English.

### Real unusual-login check

After a successful login, sign out. In Chrome DevTools → More tools → Network conditions, uncheck the default User-Agent and set a different valid browser User-Agent; keep it consistent for both prompts. Sign in again. The server compares actual request IP/User-Agent with the last successful context for that credential; it does not invent a location.

First cancel **Check this sign-in**: no new account session should be created. Repeat and approve **Verify this sign-in with my passkey**. The account's Security tab shows the completed extra check. Restore the browser's default User-Agent afterwards. SOC → Login history shows the actual extra-check and sign-in events, with exact-username filtering and pagination. This is an additional fresh verification with the same passkey, not an independent second factor or a geolocation/ML engine.

### Recovery readiness and rotation

In **Security and recovery**, check the actual remaining-code count. Choose to replace recovery codes, confirm, then complete a fresh passkey check. Save the eight new codes before continuing. All previous codes become invalid; do not accidentally use the old printout for your recovery demonstration. If the response is lost after replacement, sign in with the working passkey and rotate again. The server cannot redisplay plaintext codes.

Losing every passkey **and** every recovery code fails closed. There is no SMS/password/admin override; independent institution-assisted identity proofing is not implemented.

## Main demonstration: IntentLock

1. Open AgentShield, which now contains IntentLock. Approve exactly INR 5,000 to Electricity Board. Review the server-returned details, then confirm with a passkey.
2. Leave the attempted request as INR 50,000 to Attacker sandbox. Send it to the deliberately vulnerable endpoint: it accepts the parameters. That endpoint is only a comparison, not a bank account.
3. Send the same attempt to the protected gateway. Show HTTP 403, the precise constraint reason and event ID. The ledger and balance must not change.
4. Click **Use approved parameters** and submit to the gateway. Show HTTP 200, the transaction row and a balance reduced by exactly INR 5,000.
5. Submit again. Show HTTP 403 `TOKEN_REPLAY`, with no second payment. The observer window refreshes every three seconds; SOC refreshes every five seconds.
6. Changing only the amount, even to a smaller amount, is also denied. This is exact intent approval, not a spending ceiling.

The default sandbox starts with synthetic INR 125,000. Account-page payments and IntentLock share the persisted balance. No payment network or real bank is connected. Reloading the browser does not reset the balance.

## Other customer journeys

- **Phishing:** use invented credentials only. Show what the local password form receives, the browser's actual `SecurityError` for the wrong RP ID, and the server's separate origin-verification result. The latter uses a crafted assertion; it is not a captured browser signature or a reverse-proxy attack.
- **Session theft:** in Demo arena, run the cookie replay comparison. A signed legitimate request must return HTTP 200 before the cookie-only bank request returns HTTP 401 `DPOP_PROOF_REQUIRED`. The legacy result uses a published dummy token, not an actual compromised third-party account.
- **Individual probes:** run revoked-session access, step-up replay, unauthorized enrollment and expired-session access from Demo arena. Each has a run ID, timestamp and actual HTTP observations. Admin access is required. These use isolated fixtures, not the demonstrator's credentials.
- **Risk and payments:** open **Sandbox payments**. Enter a recipient and amount, or expand the clearly labeled evaluation examples. A synthetic INR 450 bill can be recorded without step-up; INR 50,000 requires a fresh passkey. The amount threshold is a separate enforced policy, not a fabricated change in the risk score. Check the actual updated balance and reload to verify persistence.
- **Devices:** adding another authenticator now requires fresh approval by an existing active passkey before the registration prompt. Revoke a backup device and show its status. Do not revoke the only working authenticator unless recovery is the next demonstration.
- **Kiosk:** open a private/separate browser context as the terminal, choose shared-terminal access, then open its current phone-approval link in the authenticated-device browser. Approve the matching code with a passkey. Show the 15-minute terminal session, no enrollment control, and logout. A real phone needs reachable trusted HTTPS and matching RP configuration; localhost links do not work across devices.
- **Recovery:** use a separate/replacement authenticator context and one saved recovery code. Cancel the first enrollment: the code stays unused. Complete it next: old credentials and sessions are revoked atomically, then demonstrate the replacement sign-in. Keep the remaining codes private.
- **PQC:** run Crypto Lab's live benchmark. It measures ECDSA and ML-DSA-44 on this machine. It does not replace WebAuthn's signature algorithm or make this login post-quantum.

## Run the checks

### Hands-on acceptance reported by Ananya, 16 October 2026

Ananya reported that Mac/iPhone trusted HTTPS, iPhone passkey registration/login, real QR approval, terminal restrictions/logout, Mac Touch ID, replacement recovery, browser/server phishing rejection and IntentLock altered/success/replay checks passed. She also supplied the actual SOC run `dc507830-4363-4282-b5f0-bc9efef25c54`: ten PASS, zero FAIL/SKIPPED, and an INTACT audit check covering 59 events. These are user-reported hands-on results, not physical-device tests performed by the automated runner. Counts and balances change as more demonstrations run.

Still awaiting separate hands-on confirmation: changed-browser extra approval, recovery-code replacement, installed local speech voices and physical FIDO2 key operation. The first two already have real-backend browser coverage; a storage USB drive is not a hardware authenticator. No real LLM or post-quantum login is implemented.

Latest local verification, 16 October 2026: production build passed; startup/backend checks and 17 frontend unit tests passed; all ten CLI attack probes passed; seven UI browser tests passed; both real-backend browser scenarios passed. An isolated HTTPS smoke check also validated the bank, attacker, frontend proxy and matching certificate/RP/origin using the explicit local CA. Desktop and mobile screenshots were inspected. These results do **not** verify native Touch ID, physical FIDO2 hardware, iPhone certificate trust/network reachability or actual installed speech voices; complete the hands-on checklist above and phone guide.

```sh
npm run build
npm test
npm run test:attacks
npm run test:e2e --workspace=@trustx/frontend
npm run test:integration --workspace=@trustx/frontend
```

`npm test` uses in-memory or generated temporary databases. It tests exact intent binding, wrong actor/session/action, expiry, altered tokens, smaller/larger amounts, rollback after a real ledger-write failure, restart persistence, persistent proof-replay rejection, payment validation and step-up atomicity. The ten live HTTP router probes run twice. They use real signature verification with software-authenticator fixtures, not physical-key evidence.

`test:e2e` covers preview UI, saved-code gating, keyboard focus, recovery, kiosk, Hindi guidance, local-only speech selection/fallback and real WebCrypto key behavior. Preview explicitly labels fixtures and skips attack execution.

`test:integration` starts isolated bank, attacker and Vite services with virtual authenticators. It exercises real registration/login, origin checks, cookie replay, individual attack controls, all ten SOC probes, IntentLock denial/success/replay and ledger state, banking step-up, benchmark, kiosk, enrollment/revocation, recovery and session termination. Its second scenario covers external-key registration options, code rotation and old-code rejection, actual User-Agent anomaly/cancel/extra-check approval and real admin login-history filtering. Screenshots and failure traces are under `packages/frontend/test-results-live/`. These are local test artifacts, not committed credentials.

### Repeat and reset safely

Each attack-control run creates fresh fixtures and removes their active credentials and sessions. It keeps the fixture user and audit evidence so historical events remain verifiable. You can rerun without restarting or editing SQLite. The CLI attack check uses a separate in-memory database; it does not populate the live SOC.

For a completely fresh citizen/ledger demonstration, register a new username through the normal UI and grant its admin role locally. Existing accounts and audit history stay intact. There is deliberately no public delete-all/reset endpoint. Closing IntentLock drops its page-memory capability; obtain a new approval to continue. Never delete the demo database to clear a presentation screen.

## Security contract for teammates

- `POST /api/agent/delegate-challenge`: authenticated, browser-key-proven request with `action: "POST /api/agent/execute-payment"`, `recipient`, `maxAmount`. The legacy field name `maxAmount` is retained for existing callers, but now means **exact approved INR amount**. Positive values with at most two decimal places only.
- The server persists actor, approving session, action, normalized recipient, exact amount, random nonce, challenge, expiry, SHA-256 intent hash and status. Review details returned by the server, not a fabricated UI summary.
- `POST /api/agent/delegate-verify`: verifies an active owned credential, exact stored challenge/origin/RP, and required user verification. The authorization transaction rechecks session/credential validity. Approval changes PENDING to AUTHORIZED once.
- The returned capability is an opaque random 256-bit permission. Only its SHA-256 hash is stored in SQLite. It is not a client-authoritative JSON object and is no longer the old in-memory HMAC token.
- `POST /api/agent/execute-payment`: requires the same live actor/session plus capability and `paymentDetails: {recipient, amount}`. Exact scope, expiry and status are checked inside an immediate SQLite transaction. Consumption, ledger insertion and success audit commit together. A denied action or write failure cannot debit the balance or spend the permission.
- `GET /api/agent/state`: returns only the signed-in user's derived balance, latest 30 payments and latest 20 authorization events. It never returns capability tokens.
- Protected sessions cannot opt out of browser-key binding. Public device keys are validated P-256 keys with no private material. Used proof identifiers persist in SQLite, including across process restart. The protocol binds method/path/time/identifier and signature; it is not full OAuth RFC 9449 conformance or guaranteed hardware storage.
- Device revocation and bank transfers consume their request-bound step-up inside the mutation transaction. Enrollment approval creates a single, short-lived registration ceremony bound to the same session. Recovery rechecks ticket expiry inside the final transaction.
- Kiosk approval is conditionally committed against the same user/challenge and current expiry. The claimed session retains its approving credential; revoking that credential also ends its kiosk access. A revoked approval cannot be claimed.

## Pitch and boundaries

**Customer:** small organizations with shared terminals and sensitive staff or agent-assisted workflows. Clinics, colleges and service centers are candidate customers, not validated buyers.

**One-line proposition:** TrustX takes passwordless identity beyond login: a stolen session or altered delegated action does not automatically inherit a user's authority.

**Thirty-second version:** “Passkeys help protect sign-in, but the important decisions happen after login. TrustX ties sensitive actions to an exact, passkey-approved intent. In our live demo, an altered payment reaches the backend and is denied without changing the ledger. The approved payment succeeds once, and replay fails. We also show device revocation, shared-terminal sessions, recovery and the actual security evidence. We would offer this as a B2B identity and action-authorization layer, with hosted and self-hosted deployment options.”

Per-active-user subscriptions and enterprise/self-hosted tiers are business hypotheses, not proven revenue or current integrations.

**Do not claim:** a new cryptographic invention; live LLM prompt injection (no model is connected); a physically tested USB key (storage USB drives are not authenticators); full malware/XSS resistance; a separately trusted transaction display; zero forensic residue on kiosks; full regulatory certification; quantum-safe login; an immutable database. Audit anchors detect edits/deletion relative to stored history, not an attacker rewriting both rows and anchors. Existing pre-upgrade history was anchored once, not independently verified.

The implemented adversarial API requests are the explicit fallback allowed in the final plan. Real-phone HTTPS/QR and Mac Touch ID have now been reported successful by Ananya. A physical external security key and any future model/tool integration remain separate acceptance work; do not present virtual authenticators as those tests.
