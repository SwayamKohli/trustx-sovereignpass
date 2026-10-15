# TrustX SovereignPass — Backend (`@trustx/backend`)

**Maintainer:** Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)  
**Branch:** `feat/auth-backend`

---

## 1. Overview
The Core Backend provides phishing-resistant WebAuthn passwordless authentication, SQLite persistence via `better-sqlite3`, session management, recovery mechanisms, and identity audit logging.

---

## 2. Prerequisites
- **Node.js** (v18.x or v20.x+)
- **npm** (v9.x or v10.x+)

---

## 3. Installation
From the repository root or from within `packages/backend`:
```bash
# From packages/backend
npm install

# Or from repository root (workspace install)
npm install
```

---

## 4. Scripts & Usage

| Command | Description |
|---|---|
| `npm run dev` | Runs the server in watch mode using `tsx watch src/index.ts` |
| `npm run build` | Compiles TypeScript into the `dist/` directory via `tsc` |
| `npm start` | Runs the compiled production server (`node dist/index.js`) |
| `npm run test:challenges` | Tests WebAuthn challenge generation (`generateRegistrationOptions` and `generateAuthenticationOptions`) |

---

## 5. WebAuthn & Environment Configuration
Configured in `src/webauthn/config.ts`:
- `RP_NAME`: Relying Party Name (Default: `'TrustX SovereignPass Bank'`)
- `RP_ID`: Relying Party Identifier (Default: `'bank.local'`)
- `ORIGIN`: Expected Client Origin (Default: `'https://bank.local:3000'`)
- `PORT`: HTTP Server Port (Default: `3000`)
- `DB_PATH`: SQLite database file path (Default: `trustx.db`)

---

## 6. Database Architecture
The database initializes automatically on server startup via `better-sqlite3` in `src/db/index.ts`:
- **Engine:** SQLite with `PRAGMA foreign_keys = ON;`
- **Tables (Frozen Schema in `src/db/schema.ts`):**
  - `users`: ID, unique username, role (`USER`/`ADMIN`), created_at.
  - `credentials`: Passkey credentials with user foreign key, public key, counter, status (`ACTIVE`/`REVOKED`), device name, timestamps.
  - `recovery_codes`: Salted hash storage, consumption state (`used` 0/1).
  - `sessions`: User session mappings with credential tracking, creation, and expiry timestamps.
  - `audit_events`: Identity lifecycle audit logging with timestamp and user indexing.
