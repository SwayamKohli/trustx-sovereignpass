# Evaluation-2 frontend integration handoff

> Updated integration status: the backend routes are now implemented. The original proposal notes below are historical. Use the root README's live-demo instructions: `npm run dev` starts the genuine bank and attacker service together, `/demo` provides working per-environment links, and SOC results come from live route probes. Administrator access requires an actual ADMIN role and device-bound session; no guest bypass is available.

Base: fetched `origin/main` at `b71950e`, fast-forwarded into `cybercup-ananya`. Ananya's Day 2 commit is already included. No backend source files were changed in this implementation. Dependencies now use the root workspace package-lock.json; the obsolete nested frontend lock was removed (recoverable from Git).

## Existing contracts

Registration/login use Section 4.1 of [TEAM_TASK_BREAKDOWN.md](../../docs/archive/TEAM_TASK_BREAKDOWN.md). Recovery uses Section 4.2; devices Section 4.3; kiosk Section 4.4; admin credentials/sessions/events Section 4.6. Return the documented camelCase JSON fields. All mutation wrappers require `success: true` before showing success. The shared client rejects malformed lists and evidence responses.

The current backend mounts auth and agent routes only. Recovery/device/kiosk/admin routes and DPoP middleware are not yet implemented/mounted. Missing endpoints produce visible unavailable states in the frontend. Mock mode is separate and never a network-failure fallback.

## New or extended contracts to agree with Sanchit/Swayam

These names and payloads are frontend proposals where the PDF does not specify complete wire formats.

| Endpoint | Request | Expected response |
| --- | --- | --- |
| `POST /api/auth/login-verify` | Existing username/assertion + `dpopPublicKey` (public EC JWK) | Existing `{ success: true, user: { id, username, role } }`. Persist the JWK against the newly created session; do not ignore it. |
| `GET /api/auth/session` | Cookie + DPoP proof | `{ user: { id, username, role }, isKiosk: boolean, expiresAt: number }`; 401 if the session/key is invalid. |
| `POST /api/auth/logout` | `{}`, cookie + DPoP proof | `200 { success: true }` or `204`; invalidate the server session and clear the cookie. |
| `POST /api/recovery/complete` | Existing body + `dpopPublicKey` | Existing success response; bind the new session to this key only after successful atomic replacement. |
| `POST /api/kiosk/qr-challenge` | `{ dpopPublicKey }` | Existing kiosk challenge. Stage this public key with the terminal record; bind the claimed session to it. |
| `POST /api/kiosk/qr-poll` | Existing session ID and private terminal secret in JSON | Existing status. On authorization return full `{ status: 'AUTHORIZED', user: { id, username, role }, isKiosk: true, expiresAt }` or make `/auth/session` available after claim. Never re-claim an already claimed ticket. |

Timestamps accept epoch seconds or milliseconds; prefer milliseconds in new endpoints. The kiosk countdown is based on server expiry, not a fabricated client lifetime. Server-side expiry remains mandatory. Frontend key persistence allows refresh restoration through `/auth/session`; no session token enters localStorage. On successful logout, or known terminal expiry, the device key is removed from IndexedDB. Shared cookies/keys are origin-scoped: use a separate browser profile for independent citizens or a kiosk demo, not another tab in the same signed-in profile.

## DPoP proof protocol (PDF pages 4–5)

- Header: `DPoP: <base64url-header>.<base64url-payload>.<base64url-signature>`.
- Protected header: `{ typ: 'dpop+jwt', alg: 'ES256', jwk: <public EC JWK> }`.
- Payload: `{ htm: 'POST', htu: '/api/devices/revoke', iat: <epoch seconds>, jti: <random UUID> }`.
- ES256 uses WebCrypto's raw 64-byte IEEE-P1363 signature, not DER. Public curve is P-256.
- The PDF specifies path-only `htu`; no query/fragment is included. This is a project-specific cookie-bound proof contract, not a claim of complete OAuth DPoP compliance.
- Match the header key to `sessions.dpop_public_key`; never accept a substituted header key as authority. Enforce the HTTP method/path, ±60-second freshness and atomic unique-JTI replay rejection. Handle parallel legitimate requests without reusing proofs.
- Login/recovery/QR-claim bind session keys server-side. Public ceremonies do not require an existing session proof. All protected calls, including session restoration, logout, step-up and admin polls, carry a new proof.
- Non-extractable private keys are stored directly as CryptoKey objects in IndexedDB. No private JWK is exported. This is not a hardware attestation or protection against XSS/full host compromise. WebCrypto key generation follows [the platform API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey).

## Step-up handshake

The client accepts either `403 { error: 'STEP_UP_REQUIRED', intentId, stepUpOptions }` from the task breakdown or the current risk middleware's `{ error: 'STEP_UP_REQUIRED', intentHash }` shape.

For the second shape it proposes `POST /api/auth/step-up-challenge` with `{ method, route, body, intentHash }`, returning `{ intentId, stepUpOptions }`. Derive/validate the intended action on the server against the authenticated session; do not trust a supplied hash. Then `POST /api/auth/step-up-verify` accepts `{ intentId, assertionResponse }` and returns `{ success: true, stepUpToken }`.

Both requests carry cookie + fresh DPoP proof. The original request is resumed once with exactly the original serialized body, a new DPoP proof and `X-Step-Up-Token`. Bind the token to user/session/method/path/body hash, enforce maximum five-minute expiry and consume atomically with the operation. The frontend never retries a consumed token after a business error. Public emergency recovery starts with a recovery code rather than an unavailable old passkey.

## Evidence contracts to agree with Swayam/Adnan

| Endpoint | Response |
| --- | --- |
| `GET /api/admin/attack-results` | Latest completed `AttackReport` below, or 404 if none exists. |
| `POST /api/admin/attacks/run` | Run Adnan's bounded suite under strict admin authorization; return an actual completed `AttackReport`. Never invoke arbitrary shell commands supplied by the browser. |
| `POST /api/admin/audit-chain/verify` | `{ intact: boolean, checkedEvents: number, verifiedAt: ISO8601 }` from actual ledger verification. |

```ts
type AttackReport = {
  runId: string;
  timestamp: string; // ISO8601, actual test time
  probes: Array<{
    id: string; // unique in this report
    name: string;
    status: 'PASS' | 'FAIL' | 'SKIPPED';
    detail: string; // sanitized result, no cookies/recovery codes/tokens
  }>;
};
```

Counts are derived from returned rows. Eight probes are expected, but partial/absent reports are labelled honestly. Failures keep earlier data visibly marked as potentially stale. Preview reports have eight SKIPPED results, never fabricated PASS results. Audit-chain state starts unverified and returns to unverified on a failed verification attempt.

## Verification ownership

Ananya: unit/API tests, real-browser UI and WebCrypto tests, isolated real-backend registration/login. Sanchit/Swayam/Adnan: live recovery concurrency, stolen-cookie and JTI replay rejection, step-up replay, session purge, real phone/tunnel, eight-probe report production, chain tamper detection and trusted `bank.local` HTTPS/hardware checks. These remain necessary before declaring Evaluation 2 ready.
