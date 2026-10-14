# Ananya — Day 2 frontend

This package implements the preparation work described in the root README and team task breakdown. It does not implement the 24-hour sprint features.

## Run and verify

From the repository root:

```sh
npm --prefix packages/frontend install
npm --prefix packages/frontend run dev:mock
```

Open http://127.0.0.1:5173. Create an account, copy/download the eight demo codes, confirm they are saved, sign in with the same username, sign out, and sign in again. Preview accounts exist only in this tab and reset on refresh. No real passkeys or server sessions are created. Mock mode is explicit; normal builds use the real API.

```sh
npm --prefix packages/frontend run build
npm --prefix packages/frontend test
npm --prefix packages/frontend run dev
```

For real integration, browse **https://bank.local:3000**, not the internal Vite port. Sanchit's HTTPS server must serve `/api/*` and proxy frontend traffic, including Vite's development resources, to port 5173. Use RP ID `bank.local` and expected origin `https://bank.local:3000`. Certificate generation and host configuration belong to Adnan/Swayam. No certificate verification bypass is configured here.

## Delivered frontend work

- React 18, TypeScript, Vite, and Tailwind package-local setup.
- Registration/login forms with loading, cancellation, error, and browser-support guidance.
- Four documented authentication endpoints, using `startRegistration({ optionsJSON })` and `startAuthentication({ optionsJSON })`.
- Native modal dialog with keyboard focus containment, eight server-issued recovery codes, Copy/Download, and saved-code confirmation. Codes remain in memory until dismissed; no secrets or session tokens are written to browser storage.
- Basic signed-in view and logout request; clearly labelled mock journey for independent UI work.
- Typed device/audit fixtures and existing sprint placeholders retained.
- API tests for success, cancellation, malformed responses, failure handling, and mock isolation.

Registration verification does not document a session cookie, so onboarding ends at sign-in rather than assuming the user is authenticated.

## Team handoff — contracts still to confirm

**Sanchit:** implement the four authentication endpoints from Section 4.1 of `TEAM_TASK_BREAKDOWN.md`, return valid SimpleWebAuthn JSON options (the sample strings are illustrative, not usable cryptographic values), and issue the secure HttpOnly cookie on login. Proposed missing logout contract: `POST /api/auth/logout`, body `{}`, response `200 { "success": true }` or `204`, atomically invalidating the server session and clearing its cookie. The UI must keep the signed-in view on logout failure. No session-restoration endpoint is specified; after a page refresh the UI asks the citizen to sign in again. Agree a current-user endpoint before adding restoration.

**Swayam:** integrate this package into root workspace/dependencies and root `npm run dev`. Root files have not been changed. The current branch is `cybercup-ananya`; agree naming with the team before merging. Use peer review before merging to `main`.

**Adnan:** help verify real registration/login and both origin-defense layers on the presentation machine. Mock preview is not security evidence.

Use the detailed task-breakdown contracts: `recoveryCode`, `credentialId`, and no `is_master`. The roadmap contains older spellings/schema fields. Actual API agreement and real hardware/HTTPS tests require teammate integration; they are not completed by frontend fixtures.

## Presentation-machine checklist (pending)

- Open `https://bank.local:3000` without certificate warnings.
- Register with Touch ID/Windows Hello/security key; confirm the credential exists server-side.
- Save the real recovery codes, then log in; verify the server session cookie.
- Cancel a passkey prompt and confirm readable feedback and no false success.
- Use only Tab/Shift+Tab/Enter/Space through registration, the recovery dialog, login, and logout. Check responsive layout and readable contrast.
- Log out and confirm the old cookie no longer authorizes protected backend requests.
- Confirm the root startup command and Adnan's genuine/look-alike-origin tests.

Full recovery, device actions, kiosk QR, SOC, AI UI, and PQC remain sprint work. `src/features/agent/` belongs to Swayam.
