# Ananya — Evaluation 2 frontend

For the integrated live solution, follow the root [README](../../README.md#run-the-live-same-laptop-demo). Start `npm run dev`, open `http://localhost:3000/demo` without local certificates, and use the separate attacker window. Backend routes, DPoP, step-up, kiosk and SOC are now connected. Missing-backend notes below describe the original handoff, not the current main branch. The live browser test now covers the full bank/attacker/SOC/recovery/kiosk scenario.

Day 2 onboarding is extended with Ananya's assignments from the Evaluation-2 battle-plan PDF: DPoP signing, two-phase recovery, device management, shared-terminal QR approval, and SOC visibility. Backend enforcement is owned by Sanchit/Swayam; this frontend does not claim those controls are implemented server-side.

## Run and verify

From the repository root:

```sh
npm install
npm run dev:frontend:mock
```

Open http://127.0.0.1:5173. Sign in as `demo` for the citizen view or `demo-admin` for SOC. You can also register another preview account. All preview data is tab-local and resets on refresh. No real passkeys or server sessions are created; probe fixtures are all SKIPPED. Normal builds use real APIs, never a fallback to mock data.

```sh
npm run build --workspace=@trustx/frontend
npm test --workspace=@trustx/frontend
npx playwright install chromium
npm run test:e2e --workspace=@trustx/frontend
npm run test:integration --workspace=@trustx/frontend
npm run dev
```

For real integration, browse **https://bank.local:3000**, not the internal Vite port. Sanchit's HTTPS server must serve `/api/*` and proxy frontend traffic, including Vite's development resources, to port 5173. Use RP ID `bank.local` and expected origin `https://bank.local:3000`. Certificate generation and host configuration belong to Adnan/Swayam. No certificate verification bypass is configured here.

## Delivered frontend work

- React 18, TypeScript, Vite, and Tailwind package-local setup.
- Registration/login forms with loading, cancellation, error, and browser-support guidance.
- Four documented authentication endpoints, using `startRegistration({ optionsJSON })` and `startAuthentication({ optionsJSON })`.
- Recovery-code onboarding with Copy/Download and a saved-code confirmation. Codes and recovery tickets remain in memory, never localStorage.
- Two-phase recovery: verify code, show expiring enrollment confirmation, then enroll a replacement passkey. Cancelled enrollment never calls completion. Only server-confirmed success shows recovery complete.
- Device table, additional passkey enrollment, confirmation before revocation, and server-refreshed status. A protected 401 ends the UI session.
- Non-extractable ECDSA P-256 private key stored as a CryptoKey in IndexedDB. Public JWK accompanies login, recovery completion, and terminal challenge creation. Protected requests carry fresh ES256 proofs.
- Step-up handling: obtain challenge, perform passkey authentication, verify, and resume the original serialized request once with a fresh proof and single-use token. Failed operations are not automatically retried.
- Kiosk QR generation, two-second non-overlapping polling, expiry/regeneration, private in-memory terminal secret, and a separate phone confirmation view. The phone strips the bearer token from the address bar; the page sends no referrer. Public-terminal enrollment is disabled.
- Admin-only SOC view with session termination, periodically refreshed credentials/sessions/events, returned probe counts, an attack-run button, and explicit server audit-chain verification. Missing APIs show unavailable states, never fabricated success.
- Unit tests, real Chromium UI/crypto tests, and real-backend registration/login using a virtual authenticator and an in-memory test database. Physical Touch ID/security-key and bank.local HTTPS checks remain manual.

Registration verification does not document a session cookie, so onboarding ends at sign-in rather than assuming the user is authenticated.

## Team handoff — contracts still to confirm

**Sanchit:** recovery, device and kiosk routes remain placeholders on fetched main `b71950e`. Complete those routes using Section 4 of the task breakdown and the additions in [INTEGRATION.md](./INTEGRATION.md). Existing real registration/login is compatible; replacement enrollment and revocation cannot be live-verified until the APIs are mounted.

**Swayam:** implement server-side DPoP/session-key binding, step-up, session restoration/logout and admin endpoints. Root workspace startup was fetched from main; only the generated root dependency lock changed for frontend dependencies. The current branch remains `cybercup-ananya`; peer-review before merging to main.

**Adnan:** help verify real registration/login and both origin-defense layers on the presentation machine. Mock preview is not security evidence.

Use `recoveryCode` and `credentialId` from the detailed task-breakdown contracts. Some roadmap fields are older. New contracts are explicitly proposals in INTEGRATION.md, not claims of team approval.

## Presentation-machine checklist (pending)

- Open `https://bank.local:3000` without certificate warnings.
- Register with Touch ID/Windows Hello/security key; confirm the credential exists server-side.
- Save the real recovery codes, then log in; verify the server session cookie.
- Cancel a passkey prompt and confirm readable feedback and no false success.
- Use only Tab/Shift+Tab/Enter/Space through registration, the recovery dialog, login, and logout. Check responsive layout and readable contrast.
- Log out and confirm the old cookie no longer authorizes protected backend requests.
- Confirm the root startup command and Adnan's genuine/look-alike-origin tests.

DPoP protects against remote cookie-only replay only when the server validates and binds proofs; it does not prevent same-origin XSS or complete host compromise. The PDF's path-only `htu` contract is intentionally documented as a project protocol rather than full OAuth RFC 9449 compliance. See [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html).

AI UI and PQC remain Swayam's work; `src/features/agent/` is untouched.
