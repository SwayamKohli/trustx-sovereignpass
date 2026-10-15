# TrustX SovereignPass — current threat model

This describes the final-evaluation implementation, not the earlier roadmap. TrustX is a local hackathon/reference application, not a certified identity provider, bank or network firewall.

## Assets and trust boundaries

- The WebAuthn authenticator controls its credential private key and user-verification procedure. The server stores public keys and counters, not biometric templates or the authenticator PIN. Synced and platform passkeys are not automatically hardware-bound.
- A separate non-extractable WebCrypto browser key signs protected API requests. It is stored through IndexedDB; non-extractability is an API property, not proof of TPM/Secure Enclave storage.
- The backend owns sessions, authorization decisions, recovery hashes, known login contexts and sandbox state.
- The bank and attacker lab use different hosts. The attacker lab accepts invented demonstration credentials only by operator convention; never enter real secrets.
- The browser displays transaction details. It is not an independent trusted display if the genuine origin is compromised.
- SQLite and stored audit anchors are inside the server's trust boundary. A full database/server compromise can change both.

## Covered attacks and evidence

| Threat | Implemented boundary | How it is checked |
| --- | --- | --- |
| Look-alike site tries to use a bank passkey | Browser RP checks and server challenge/origin/RP verification | Real browser wrong-RP request; actual verifier rejection; valid positive-control login |
| Old authentication assertion is replayed | Short-lived, single-use challenges and WebAuthn counter checks where supported | Repeat an actual signed login assertion; no new cookie |
| Session cookie is copied without its browser key | Mandatory method/path/time/identifier-bound ES256 proof for protected sessions | Actual cookie-only request denied; fresh proof accepted; reused proof denied |
| Proof is replayed after server restart | Persistent unique proof identifiers with expiry | Independent-process restart test against the same temporary database |
| Network/browser login context changes | Server compares successful history; no new session until another fresh, user-verified passkey assertion | Changed-browser/network HTTP tests; browser cancellation and confirmation journey |
| An authenticated client enrolls a new device without approval | Existing-passkey step-up creates one session-bound registration ceremony; kiosk enrollment forbidden | Missing approval and fabricated attestation denied; approved enrollment succeeds |
| A lost credential or terminal session is reused | Server checks active credential/session state; revocation removes associated sessions; kiosk sessions retain their approving credential | Revoked assertion, terminated/expired session, revoked kiosk approval and claimed-session tests |
| A recovery code/ticket is reused | Argon2id hashes, bounded verification attempts and transactional one-time completion | Code reuse rejected; browser cancellation then completion; expiry rechecked at commit |
| Old recovery material is used after code replacement | Fresh passkey approval; old codes and pending tickets invalidated in the same transaction | HTTP rotation and browser old-code rejection checks |
| Approved action parameters are changed | IntentLock checks exact route/action, actor, session, recipient, amount, expiry and status | Actual HTTP altered-recipient/amount denial and unchanged ledger |
| Approval is reused or requests race | Capability consumption, sandbox payment and audit commit together in an immediate transaction | Two concurrent requests produce one payment; replay denied; forced ledger failure rolls back permission |
| Audit rows are edited or deleted | Stored SHA-256 anchors compared with current history | Edit/deletion tests and server-side verification |
| Clickjacking or cached recovery/API responses | Frame-ancestor restriction and no-store API responses | Normal-stack HTTP header checks; not a complete XSS policy |

The session proof protocol deliberately uses a path-only target. It is not full OAuth RFC 9449 implementation. Challenges, origin checks and assertions are not replaced by UI risk labels.

Login-context checks use observed IP address and User-Agent, not GPS or IP geolocation. These signals are spoofable and are not identity factors. The extra assertion checks presence/user verification again with the same passkey; it is not an independent second factor. Previous contexts are learned only after successful sign-in.

## Recovery and inclusion policy

A user can use a device passkey, a compatible FIDO2 security key with supported user verification on a computer, or a trusted-device QR approval for a shared terminal. A basic phone by itself cannot execute this WebAuthn app. An ordinary USB storage drive cannot become a security key.

The access guide and core account/recovery/kiosk controls provide English/Hindi text. Optional spoken instructions use a matching local browser voice only. No speech service is contacted and private codes/account data are never included in spoken instructions. No matching installed voice means written instructions remain available; audio success is not fabricated.

Recovery codes are bearer secrets and can themselves be phished. They must be stored offline/private and never shared with an assistant, caller or support agent. If another passkey still works, the user can replace the code set after fresh passkey approval.

If all passkeys and all codes are lost, recovery fails closed. There is no password, SMS, admin reset or fabricated identity-proofing bypass. An organization needing assisted identity proofing must establish and validate that separate process before deployment.

## Explicitly not covered

1. Same-origin XSS or malicious browser extensions invoking a non-extractable key, tricking approvals or reading recovery codes. The basic security headers are not a complete script CSP or XSS assessment.
2. Full endpoint/root compromise, physical coercion, malicious authenticator firmware or an independently compromised passkey-sync account.
3. QR relay/social engineering: a matching display code helps avoid mistakes, but does not establish physical proximity or defeat every approval relay.
4. A real intercepted reverse-proxy attack. The standalone server-origin probe is a crafted assertion, explicitly not an intercepted valid browser signature.
5. Live model prompt injection. No LLM is connected. Actual adversarial API requests test the execution boundary instead; a future agent must expose only approved tools/routes.
6. Real financial settlement. Sandbox INR and the deliberately vulnerable comparison endpoint do not move money.
7. Post-quantum authentication. The PQC page benchmarks ECDSA versus ML-DSA; it does not change WebAuthn authentication algorithms.
8. Database administrator/server compromise rewriting both audit events and their anchors. Pre-upgrade history was anchored once, not independently validated.
9. Zero forensic residue on public terminals. Server expiry/revocation ends access; browser/OS history, memory and forensic traces are not erased.
10. Broad denial-of-service resistance, distributed deployment or a tamper-proof network perimeter. Existing recovery attempt limits are not comprehensive API abuse protection.

## Before any real deployment

- Complete actual platform-authenticator, physical security-key and real-phone trusted-HTTPS acceptance tests on target devices.
- Validate translations, spoken instructions and recovery usability with the intended low-literacy users. Browser tests do not establish usability outcomes.
- Use stable, reachable RP domains and trusted TLS. Phone and laptop need matching DNS/trust; localhost cannot be shared across devices.
- Configure trusted reverse proxies explicitly before using forwarded IP signals. Do not trust arbitrary client-supplied forwarding headers.
- Add deployment-appropriate abuse controls, monitoring, backup/restore drills, data retention/deletion rules, secret/OS hardening and dependency maintenance.
- Obtain independent security review and assess relevant organizational/regulatory obligations. No AAL3, FIDO certification or full legal-compliance claim is made here.

## Specification references

- [W3C WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/): RP/origin binding, user verification and authenticator selection.
- [W3C security-key hint explainer](https://github.com/w3c/webauthn/wiki/Explainer%3A-Hints-for-WebAuthn-Clients): hints guide browser UI; they do not prove hardware storage.
- [Mozilla localService documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService): local versus remote voices.

For exact commands and the final rehearsal sequence, use [the final-evaluation runbook](../final-evaluation.md).
