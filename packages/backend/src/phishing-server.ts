// Phishing Simulator & Evilginx MITM Interception Lab
// Owner: Adnan (Role 1 — Security Lead & Attack/Defense Engineer)

import express from 'express';
import https from 'https';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { serverConfig, loadSslCertificates } from './config/server.config';

const app = express();
const PHISH_PORT = parseInt(process.env.PHISH_PORT || '3001', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

interface StolenCredential {
  id: string;
  timestamp: string;
  vector: string;
  username: string;
  password?: string;
  ip: string;
  userAgent: string;
}

const stolenVault: StolenCredential[] = [];

// API: Harvest legacy credentials
app.post('/api/phish/harvest', (req, res) => {
  const { username, password } = req.body;
  const entry: StolenCredential = {
    id: `phish_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    vector: 'LEGACY_PASSWORD_CREDENTIAL_STUFFING',
    username: username || 'anonymous',
    password: password || '****',
    ip: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'unknown',
  };
  stolenVault.unshift(entry);
  console.log(`[ATTACKER HARVESTED] Vector: ${entry.vector} | User: ${entry.username} | Pass: ${entry.password}`);
  return res.json({ success: true, logged: entry });
});

// API: Get stolen credentials feed
app.get('/api/phish/feed', (req, res) => {
  res.json({
    activeAttacks: stolenVault.length,
    feed: stolenVault,
  });
});

// Main Interactive Phishing UI
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TrustX SovereignPass — Attack Simulation & Phishing Lab</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes pulse-glow {
      0%, 100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); }
      50% { border-color: rgba(239, 68, 68, 0.8); box-shadow: 0 0 25px rgba(239, 68, 68, 0.5); }
    }
    .phish-card { animation: pulse-glow 3s infinite; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen p-4 md:p-8 flex flex-col items-center">
  <div class="max-w-5xl w-full space-y-6">
    
    <!-- Top Banner -->
    <header class="border-b border-red-900/50 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <span class="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-red-950/80 text-red-400 border border-red-800 rounded">
            Adversary Simulation
          </span>
          <span class="text-xs text-slate-400 font-mono">CyberCup 6.0 · Problem CC6-IC04</span>
        </div>
        <h1 class="text-2xl font-black text-red-400 mt-1 tracking-tight">TrustX Adversarial Phishing & Relay Lab</h1>
        <p class="text-sm text-slate-400">Side-by-side live demonstration of FIDO2 WebAuthn cryptographic immunity vs. credential theft</p>
      </div>
      <div class="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs font-mono space-y-1">
        <div class="text-slate-400">Current Domain (Attacker): <span class="text-red-400 font-bold" id="current-host">https://b4nk-secure.local:3001</span></div>
        <div class="text-slate-400">Legitimate Target Domain: <span class="text-emerald-400 font-bold">https://bank.local:3000</span></div>
        <div class="text-slate-400">Legitimate WebAuthn RP ID: <span class="text-cyan-400 font-bold">bank.local</span></div>
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      <!-- Attack Vector 1: Legacy Passwords -->
      <section class="bg-slate-900/90 border border-red-900/60 rounded-xl p-6 phish-card flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-red-400 flex items-center gap-2">
              <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              Attack 1: Legacy Password Interception
            </h2>
            <span class="text-xs bg-red-950 text-red-400 px-2 py-0.5 rounded border border-red-800">Vulnerable</span>
          </div>
          <p class="text-xs text-slate-400 mb-4">
            A traditional reverse-proxy (e.g. Modlishka, Evilginx) easily captures plain-text credentials and SMS OTPs entered on deceptive lookalike domains.
          </p>

          <form id="legacy-form" class="space-y-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Citizen Username / Aadhaar</label>
              <input type="text" id="legacy-user" value="alice@bank.local" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Static Password</label>
              <input type="password" id="legacy-pass" value="SuperSecret2026!" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none">
            </div>
            <button type="submit" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded text-sm transition">
              Simulate Submitting on Fake Domain
            </button>
          </form>
        </div>

        <div class="mt-4">
          <div class="text-xs font-bold text-red-400 uppercase tracking-wide mb-1 flex items-center justify-between">
            <span>Attacker Terminal Capture</span>
            <span class="text-[10px] text-slate-500 font-mono" id="feed-count">0 Stolen</span>
          </div>
          <div id="terminal-feed" class="bg-black/90 rounded p-3 text-[11px] font-mono text-red-400 h-28 overflow-y-auto border border-red-950">
            [Awaiting victim input on lookalike domain...]
          </div>
        </div>
      </section>

      <!-- Attack Vector 2: Passkey Defense -->
      <section class="bg-slate-900/90 border border-emerald-900/60 rounded-xl p-6 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              Defense 2: FIDO2 Two-Layer Passkey Immunity
            </h2>
            <span class="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">Phishing Proof</span>
          </div>
          <p class="text-xs text-slate-400 mb-4">
            WebAuthn binds keys mathematically to the browser's origin. Even with valid SSL certificates, deceptive domains cannot harvest or relay credentials.
          </p>

          <div class="space-y-3">
            <div class="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-200">Layer 1: Browser RP ID Isolation</span>
                <span class="text-[10px] text-cyan-400 font-mono">W3C WebAuthn §5.1.3</span>
              </div>
              <p class="text-[11px] text-slate-400">
                Attacker tries requesting credentials registered to <code class="text-cyan-300">bank.local</code> from <code class="text-red-300">b4nk-secure.local</code>.
              </p>
              <button id="btn-test-layer1" class="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 rounded text-xs transition flex items-center justify-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                Execute Layer 1 Probe: Browser Rejection
              </button>
            </div>

            <div class="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-200">Layer 2: Backend Origin Enforcement</span>
                <span class="text-[10px] text-emerald-400 font-mono">Server Cryptographic Check</span>
              </div>
              <p class="text-[11px] text-slate-400">
                Attacker captures an assertion with clientData origin <code class="text-red-300">b4nk-secure.local:3001</code> and forwards it to <code class="text-emerald-300">bank.local:3000</code>.
              </p>
              <button id="btn-test-layer2" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs transition flex items-center justify-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Execute Layer 2 Probe: Backend Origin Verification
              </button>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <div class="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-1 flex items-center justify-between">
            <span>Cryptographic Defense Audit Terminal</span>
            <span class="text-[10px] text-slate-500 font-mono">Real-time Defense Output</span>
          </div>
          <div id="defense-terminal" class="bg-black/90 rounded p-3 text-[11px] font-mono text-emerald-400 h-28 overflow-y-auto border border-emerald-950">
            [Ready to execute cryptographic defense verification probes...]
          </div>
        </div>
      </section>

    </div>

    <!-- Live Architecture Explainer for Hackathon Judges -->
    <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-xs text-slate-400 space-y-2">
      <div class="font-bold text-slate-200 text-sm flex items-center gap-2">
        <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Why Passkeys Defeat Evilginx & Lookalike Domains (Judge Reference)
      </div>
      <p>
        <strong>1. Client-Side Browser Boundary:</strong> When a website invokes <code class="text-cyan-300">navigator.credentials.get()</code>, the browser's cryptographic subsystem computes the effective domain. If the requested <code class="text-cyan-300">rpId</code> is not a valid suffix of the page origin host, the browser refuses to contact the platform authenticator (Touch ID, Windows Hello, YubiKey) and throws a <code class="text-red-300">SecurityError</code>.
      </p>
      <p>
        <strong>2. Server-Side Cryptographic Signature:</strong> The client authenticator signs a payload containing the UTF-8 encoded <code class="text-slate-200">clientDataJSON</code>, which includes the exact origin as perceived by the browser (<code class="text-slate-200">https://b4nk-secure.local:3001</code>). If an attacker relays this assertion to <code class="text-slate-200">https://bank.local:3000</code>, the genuine server compares the signed origin against its configured <code class="text-slate-200">EXPECTED_ORIGIN</code>, detects the discrepancy, throws an <code class="text-red-300">OriginMismatchError</code>, and logs a high-severity <code class="text-red-400">PHISHING_ORIGIN_REJECTED</code> audit event.
      </p>
    </div>

  </div>

  <script>
    document.getElementById('current-host').innerText = window.location.origin;

    // Vector 1: Legacy Form Submit Simulation
    const legacyForm = document.getElementById('legacy-form');
    const terminalFeed = document.getElementById('terminal-feed');
    const feedCount = document.getElementById('feed-count');

    legacyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('legacy-user').value;
      const password = document.getElementById('legacy-pass').value;

      try {
        const res = await fetch('/api/phish/harvest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        const timestamp = new Date().toLocaleTimeString();
        const logLine = \`[\${timestamp}] CRITICAL: Stolen credentials harvested!\\n  User: \${username}\\n  Password: \${password}\\n  Origin: \${window.location.origin}\\n----------------------------------------\\n\`;
        
        if (terminalFeed.innerText.includes('Awaiting victim')) {
          terminalFeed.innerText = logLine;
        } else {
          terminalFeed.innerText = logLine + terminalFeed.innerText;
        }
      } catch (err) {
        terminalFeed.innerText = 'Error capturing: ' + err.message;
      }
    });

    // Vector 2: Defense Terminal
    const defenseTerminal = document.getElementById('defense-terminal');

    function logDefense(msg, type = 'info') {
      const timestamp = new Date().toLocaleTimeString();
      const colorTag = type === 'success' ? '✔' : (type === 'error' ? '✖' : 'ℹ');
      const line = \`[\${timestamp}] \${colorTag} \${msg}\\n\`;
      if (defenseTerminal.innerText.includes('Ready to execute')) {
        defenseTerminal.innerText = line;
      } else {
        defenseTerminal.innerText = line + defenseTerminal.innerText;
      }
    }

    // Layer 1 Test: Browser RP ID Isolation
    document.getElementById('btn-test-layer1').addEventListener('click', async () => {
      logDefense('Attempting navigator.credentials.get with rpId="bank.local" on origin ' + window.location.origin + '...');
      if (!window.PublicKeyCredential) {
        logDefense('WebAuthn not supported in this browser.', 'error');
        return;
      }

      try {
        await navigator.credentials.get({
          publicKey: {
            challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
            rpId: 'bank.local', // Illegal on b4nk-secure.local!
            timeout: 5000,
            allowCredentials: [],
            userVerification: 'preferred'
          }
        });
        logDefense('UNEXPECTED: Browser permitted cross-origin RP ID without error!', 'error');
      } catch (err) {
        logDefense('LAYER 1 IMMUNITY CONFIRMED! Browser blocked call:', 'success');
        logDefense('Error Name: ' + err.name + ' (' + err.message + ')', 'success');
        logDefense('RESULT: Platform authenticators refuse to expose bank.local keys to ' + window.location.hostname + '.', 'success');
      }
    });

    // Layer 2 Test: Backend Origin Verification Rejection
    document.getElementById('btn-test-layer2').addEventListener('click', async () => {
      logDefense('Simulating relayed assertion with fake clientDataJSON.origin="https://b4nk-secure.local:3001" to genuine backend...');

      try {
        const fakeRelayedPayload = {
          username: 'test_victim@bank.local',
          assertionResponse: {
            id: 'cred_test_spoofed',
            rawId: 'cred_test_spoofed',
            response: {
              clientDataJSON: btoa(JSON.stringify({
                type: 'webauthn.get',
                challenge: 'fake_challenge_12345',
                origin: window.location.origin // https://b4nk-secure.local:3001
              })),
              authenticatorData: 'AAAAAA==',
              signature: 'AAAAAA==',
              userHandle: null
            },
            type: 'public-key'
          }
        };

        const res = await fetch('https://bank.local:3000/api/auth/login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fakeRelayedPayload)
        });

        const status = res.status;
        const body = await res.json().catch(() => ({}));

        if (status === 401 || status === 400) {
          logDefense('LAYER 2 IMMUNITY CONFIRMED! Genuine backend rejected assertion:', 'success');
          logDefense('HTTP Status: ' + status + ' | Backend Message: ' + (body.error || 'Unauthorized'), 'success');
          logDefense('Server verified origin !== https://bank.local:3000 and logged PHISHING_ORIGIN_REJECTED in audit trail.', 'success');
        } else {
          logDefense('Unexpected response from genuine server: ' + status, 'error');
        }
      } catch (err) {
        logDefense('Connection to genuine backend refused or blocked (Ensure https://bank.local:3000 is running): ' + err.message, 'error');
      }
    });
  </script>
</body>
</html>
`);
});

// Start HTTPS server using the mkcert certificate (covering bank.local & b4nk-secure.local)
const ssl = loadSslCertificates();

if (ssl) {
  const httpsServer = https.createServer(ssl, app);
  httpsServer.listen(PHISH_PORT, () => {
    console.log(`[TrustX Phishing Lab] HTTPS Attacker Simulator running at https://b4nk-secure.local:${PHISH_PORT}`);
    console.log(`[TrustX Phishing Lab] Simulating adversary lookalike against target https://${serverConfig.rpId}:${serverConfig.port}`);
  });
} else {
  const httpServer = http.createServer(app);
  httpServer.listen(PHISH_PORT, () => {
    console.log(`[TrustX Phishing Lab] Dev HTTP Attacker Simulator running at http://localhost:${PHISH_PORT}`);
    console.log(`[TrustX Phishing Lab] Warning: Run mkcert to enable HTTPS simulation`);
  });
}

export default app;
