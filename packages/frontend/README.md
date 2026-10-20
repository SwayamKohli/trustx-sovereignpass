# TrustX SovereignPass — Frontend (`@trustx/frontend`)

The Frontend is an accessible, modern React 18 single-page application providing citizen authentication views, the Admin Security Operations Center (SOC) dashboard, multi-window live attack/defense arenas, and cryptographic security visualization labs.

---

## Technical Stack & Design System

* **Framework:** React 18 with TypeScript and Vite
* **Styling & Theme:** Tailwind CSS with high-contrast accessibility palette (dark mode primary)
* **Icons:** [Lucide React](https://lucide.dev) (accessible SVG icons, zero generic emojis)
* **Animation & Visual Flow:** Framer Motion (animated attack graphs, state transitions, and evidence playback)
* **WebAuthn Client:** `@simplewebauthn/browser` (Touch ID, Windows Hello, Face ID, FIDO2 NFC/USB keys)
* **In-Browser Cryptography:** Web Crypto API (`SubtleCrypto` for ECDSA P-256 key generation, export, and DPoP proof signing)
* **Accessibility Standard:** Aligned with WCAG 2.1 AA targets (contrast ratio >= 4.5:1, visible focus indicators, full keyboard navigation)
* **Localization:** English and Hindi dual-language support (`i18n.ts`) with spoken local voice guidance (`AudioHelp.tsx`)

---

## Application Structure

```text
packages/frontend/
├── src/
│   ├── components/                    # Reusable UI components
│   │   ├── AudioHelp.tsx              # Local browser speech synthesizer & voice guidance
│   │   ├── AuditFeed.tsx              # Real-time append-only security event list
│   │   ├── AuthForm.tsx               # Unified username input & ceremony initiation
│   │   ├── DeviceTable.tsx            # Registered passkeys list with status & 1-click revoke
│   │   ├── Dialog.tsx                 # Accessible modal dialog container
│   │   ├── KioskQRModal.tsx           # Dynamic QR code renderer with polling countdown
│   │   ├── LoginHistory.tsx           # User-facing recent login history & risk flags
│   │   ├── PasskeyModal.tsx           # Biometric prompt instruction modal
│   │   ├── PersistenceFlow.tsx        # Framer Motion animated credential firewall flow
│   │   ├── PersonaGuide.tsx           # 4 demographic Indian user persona selector
│   │   ├── RecoveryModal.tsx          # 8 emergency recovery codes modal with copy/download
│   │   ├── RecoveryReadiness.tsx      # Account recovery readiness checklist & health score
│   │   └── SecurityNotifications.tsx  # Dynamic security alerts banner
│   ├── pages/                         # Route views
│   │   ├── AccessHelpPage.tsx         # Guided accessibility assistance & persona walkthrough
│   │   ├── AdminSOCPage.tsx           # Administrator Security Operations Center dashboard
│   │   ├── AgentShieldPage.tsx        # IntentLock challenge-bound AI delegation gateway
│   │   ├── CryptoLabPage.tsx          # In-browser PQC studio (ECDSA P-256 vs ML-DSA-44)
│   │   ├── DashboardPage.tsx          # Citizen banking portal, device manager & step-up transfer
│   │   ├── DemoArenaPage.tsx          # Multi-window live attack/defense demonstration cockpit
│   │   ├── KioskAuthPage.tsx          # Mobile QR authentication scanner & pairing view
│   │   ├── LoginPage.tsx              # Passkey biometric sign-in view
│   │   ├── PersistenceGuardPage.tsx   # Credential Persistence Firewall lab & Ollama red-teamer
│   │   ├── PhishingLabPage.tsx        # Adversary look-alike site & RP ID isolation test
│   │   ├── RecoveryPage.tsx           # Two-phase lockout-safe emergency recovery flow
│   │   └── RegisterPage.tsx           # Citizen passkey onboarding & credential generation
│   ├── services/
│   │   ├── api.ts                     # Strongly-typed HTTP client with DPoP proof injection
│   │   ├── api.test.ts                # Vitest unit test suite for API contracts (18 tests)
│   │   ├── dpop.ts                    # IndexedDB CryptoKey storage & ES256 proof generator
│   │   ├── i18n.ts                    # English and Hindi localization dictionaries
│   │   ├── mock.ts                    # Tab-local mock fixtures for standalone offline preview
│   │   ├── types.ts                   # TypeScript interfaces for API requests and models
│   │   └── usePolling.ts              # Non-overlapping resilient polling hook for SOC/Kiosk
│   ├── styles/
│   │   └── index.css                  # Tailwind directives and custom animation styles
│   ├── App.tsx                        # Main application layout, routing & persona state
│   └── main.tsx                       # React DOM entrypoint
├── index.html
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── README.md
```

---

## Interactive Pages & Live Demonstration Views

### 1. Citizen Banking Portal (`/dashboard`)
* Accessible balance ledger with sovereign transfer capability.
* Performing a transfer above threshold triggers a cryptographic biometric step-up prompt (`requireBiometricElevation`).
* Enrolled device manager showing authenticator model, enrollment date, and immediate revocation.

### 2. Multi-Window Demo Arena (`/demo`)
* Cockpit for running the live attack/defense demonstration on the same laptop.
* Spawns links to the genuine bank (`localhost:3000`) and the attacker lab (`127.0.0.1:3001`).
* Shows live real-time event feed synchronized between bank and attacker interactions.

### 3. Admin SOC Dashboard (`/admin`)
* Real-time Security Operations Center view restricted to `ADMIN` accounts.
* Credentials inventory: list of all registered passkeys across all users with active/revoked states.
* Active sessions monitor: live session list with 1-click immediate server-side revocation.
* Append-only incident audit stream with tamper-evident SHA-256 hash chaining verification.

### 4. Credential Persistence Firewall (`/persistence`)
* Interactive laboratory demonstrating the **PersistenceGuard** firewall against session cookie theft.
* Allows executing live automated attacks using a local Ollama AI model (`qwen3:1.7b` or `llama3.2:1b`).
* Side-by-side comparison: shows an attacker taking over a weak-baseline account (HTTP 200) vs being completely blocked by TrustX (HTTP 401/403).
* Framer Motion visual timeline replays captured forensic evidence.

### 5. IntentLock / AgentShield (`/agent`)
* Capability delegation gateway allowing AI assistants to execute constrained financial actions.
* Step 1: User signs an exact recipient and amount limit using their physical passkey.
* Step 2: The system compares the unconstrained sandbox (which gets hijacked by prompt injection) against the TrustX gateway (which enforces single-use capability constraints).

### 6. Controlled Phishing Lab (`/phishing` on port 3001)
* Hosted on adversary origin `https://b4nk-secure.local:3001` (or `http://127.0.0.1:3001`).
* Demonstrates browser-layer Relying Party ID (RP ID) isolation: the browser discovers zero matching credentials for the fake domain and refuses to prompt for Touch ID/Face ID.
* Side-by-side legacy form captures dummy passwords in red to highlight the vulnerability of traditional authentication.

---

## Client-Side Security Controls

1. **In-Browser Device-Bound Keys (DPoP):**
   * Upon first load, the client generates a non-extractable ECDSA P-256 keypair via the Web Crypto API, persisted in IndexedDB.
   * Every protected mutation signs an ephemeral JWT proof (`typ: dpop+jwt`) containing the HTTP method, destination path, and timestamp.
2. **Memory-Only Recovery Code Exposure:**
   * During onboarding, 8 single-use emergency codes are shown to the user once with copy/download options.
   * Emergency codes and recovery tickets are never persisted in `localStorage` or `sessionStorage`.
3. **Graceful Error Mapping:**
   * Raw cryptographic exceptions or browser WebAuthn DOMExceptions (`NotAllowedError`, `InvalidStateError`) are intercepted and translated into human-readable citizen guidance.

---

## Development Scripts

From the monorepo root or within `packages/frontend`:

```bash
# Start Vite development server (:5173 internal)
npm run dev --workspace=@trustx/frontend

# Start standalone offline preview mode with tab-local mocks
npm run dev:mock --workspace=@trustx/frontend

# Run Vitest unit tests (18 tests covering API contracts and error mapping)
npm test --workspace=@trustx/frontend

# Build for production
npm run build --workspace=@trustx/frontend
```

---

## Primary Contributors

* **Ananya Robinson** ([@ananya411-robinson](https://github.com/ananya411-robinson)) — Full frontend application architecture, UI/UX design, accessible component library, Admin SOC dashboard, Lucide icon migration, and Demo Arena layout.
* **Swayam Kohli** ([@SwayamKohli](https://github.com/SwayamKohli)) — Web Crypto DPoP proof generation (`dpop.ts`), Indian demographic persona guide (`PersonaGuide.tsx`), bilingual audio accessibility (`AudioHelp.tsx`), and IntentLock UI integration.
