# Real iPhone QR rehearsal

Use this after the localhost checks in [the main runbook](final-evaluation.md). The prepared phone profile is separate: it does not change your localhost credentials or delete accounts. Node 24 is recommended for the launcher and its system-CA support.

## 1. Trust the demo certificate

The local certificate was generated, but installing its CA on the Mac needs your administrator password in your own terminal:

```sh
mkcert -install
```

Do not send anyone your password. If this fails, stop here; do not disable browser certificate checks.

AirDrop **only** `certs/phone-rootCA.cer` to your iPhone. Never share `phone-key.pem` or mkcert's `rootCA-key.pem`. Install the downloaded profile under **Settings → General → VPN & Device Management** (or **Profile Downloaded**). Then open **Settings → General → About → Certificate Trust Settings** and explicitly enable full trust for this mkcert root. Installing a profile alone does not enable SSL trust. See [Apple's certificate instructions](https://support.apple.com/en-au/102390).

The prepared public CA SHA-256 fingerprint is:

```text
DD:70:28:88:E5:55:CB:1F:EE:CC:F6:E0:2D:43:20:B8:AE:AE:51:B3:B6:D7:80:46:07:14:A5:C7:E7:05:B0:7E
```

This is a local development CA, not a public production certificate. Trust only the certificate you transferred from your own Mac. Remove the iPhone profile after the demonstration if no longer needed. See [mkcert's security notes](https://github.com/FiloSottile/mkcert).

## 2. Start the phone profile

Connect the Mac and iPhone to the same trusted Wi-Fi. Stop the existing TrustX stack using **Ctrl+C in the terminal that started it**. Do not kill unrelated programs using the same ports.

```sh
cd /Users/ananyarobinson/cybercup-a
npm run dev:phone
```

The ignored `.env.phone` is already prepared for this Mac. For another machine, copy `.env.phone.example` and generate a certificate for that machine's reachable hostname. Never commit local private keys, `.env.phone`, recovery codes or session cookies.

Open this exact URL on **both Mac Chrome and iPhone Safari**, with no certificate warning:

```text
https://ananyas-macbook-air-3.local:3000
```

Do not use the Mac's `localhost` URL on the phone. Do not replace the hostname with a bare IP: the RP ID, certificate and application origin must agree. The attacker window on the Mac is `https://127.0.0.1:3001/phishing`.

If the phone cannot reach the Mac, first check both are on the same network and macOS allows Node's incoming connection. Campus/guest Wi-Fi can isolate devices; use a trusted private network or hotspot instead. Do not bypass TLS or expose the development server publicly.

## 3. Create the phone's real passkey

1. In iPhone Safari at the HTTPS URL, register a **new username**, for example `ananya-phone-demo`.
2. Complete Apple's native passkey prompt using the phone's available authentication. Save all eight recovery codes privately, confirm they are saved, and sign in.
3. Confirm the account shows an active authenticator. A localhost passkey cannot simply be reused for the new `.local` RP ID; use the newly registered account for this profile.

Your Mac Touch ID account can be tested separately at the same HTTPS origin. To make a registered account the SOC observer, run `npm run admin:grant -- exact-username`, then refresh that account. Do not use a different person's identity to approve someone else's kiosk session.

## 4. Test the actual QR flow

1. On the Mac, open a **private/separate browser context** at the same HTTPS URL. Choose shared-terminal QR access.
2. On the iPhone, scan the fresh QR using Camera and open its bank link in Safari.
3. Enter the phone account's username. Compare the displayed short code with the Mac's code. If it differs or you did not initiate the request, do not approve.
4. Approve with the phone's native passkey prompt. No password, SMS OTP or recovery code is needed.
5. On the Mac, check the terminal signs into that same account, shows its limited 15-minute session and does **not** allow adding an authenticator or rotating recovery codes.
6. Sign out on the terminal. Refresh and check that account data is no longer available there. Never claim this erases all forensic browser traces.
7. Generate another QR and leave it unapproved: it must not sign in. An expired QR requires a new request.

Record actual results: Mac Touch ID registration/login, iPhone registration/login, QR matching-code approval, terminal restrictions and logout. Automated virtual-authenticator tests do not count as these physical checks.

## Return to the laptop-only profile

Stop the phone stack with Ctrl+C, then run `npm run dev` and return to `http://localhost:3000`. The two RP IDs use separate passkeys. Keep recovery codes with their corresponding account and origin.
