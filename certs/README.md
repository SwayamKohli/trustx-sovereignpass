# Local SSL / TLS Certificates (`certs/`)

This directory houses the local TLS/SSL certificates and private keys required for secure WebAuthn biometric ceremonies and cross-origin security testing in local environments.

---

## Purpose & Architectural Role

The WebAuthn (FIDO2 / W3C) browser standard enforces a **Secure Context** constraint: authenticators will strictly refuse to register credentials or sign authentication challenges over unencrypted HTTP (except for `localhost` loopback exceptions).

In **TrustX SovereignPass**, these certificates serve three critical purposes:

1. **Production-Parity HTTPS Termination:** The Express backend (`server.ts`) terminates SSL directly on port `3000` (`https://bank.local:3000`), reverse-proxying frontend client traffic to the internal Vite dev server (`http://127.0.0.1:5173`).
2. **Multi-Domain Adversary Simulation:** Enables realistic cross-origin phishing simulations between:
   * Legitimate Banking Origin: `https://bank.local:3000` (RP ID: `bank.local`)
   * Controlled Adversary Lab: `https://b4nk-secure.local:3001` (RP ID: `b4nk-secure.local`)
3. **Cross-Device Mobile Onboarding:** Allows testing WebAuthn biometric ceremonies on real physical devices (such as iPhones and Android devices) connected over the local network via `npm run dev:phone`.

---

## File Manifest

| File | Type | Description |
| :--- | :--- | :--- |
| `cert.pem` | X.509 Certificate | Local certificate signed by a local Root Certificate Authority (mkcert). |
| `key.pem` | RSA/EC Private Key | Matching private key used by the backend HTTPS server. |
| `.gitkeep` | Git placeholder | Ensures directory persistence in version control. |

---

## Generation & Setup Instructions

To generate or refresh certificates on a new development machine using [`mkcert`](https://github.com/FiloSottile/mkcert):

```bash
# 1. Install mkcert and set up local CA
brew install mkcert
mkcert -install

# 2. Add local hostnames to /etc/hosts
sudo tee -a /etc/hosts <<EOF
127.0.0.1 bank.local
127.0.0.1 b4nk-secure.local
EOF

# 3. Generate trusted certificates for development domains
cd certs
mkcert -cert-file cert.pem -key-file key.pem bank.local b4nk-secure.local localhost 127.0.0.1 ::1
```

> **Note:** For zero-config same-laptop demonstrations, TrustX also provides an unauthenticated HTTP fallback using browser loopback exceptions (`http://localhost:3000/demo` and `http://127.0.0.1:3001/phishing`) by setting `LOCAL_HTTP=1`.

---

## Primary Contributors

* **Syed Adnan Ahmed Hanfi** ([@Theshyguy01](https://github.com/Theshyguy01)) — Local CA setup, multi-domain certificate provisioning, adversary origin isolation.
* **Swayam Kohli** ([@SwayamKohli](https://github.com/SwayamKohli)) — Express HTTPS server integration, mobile phone CA distribution workflow, and reverse-proxy binding.
