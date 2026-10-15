// WebAuthn Relying Party (RP) Configuration
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

export const rpName: string = process.env.RP_NAME || 'TrustX SovereignPass Bank';
export const rpID: string = process.env.RP_ID || 'bank.local';
export const origin: string = process.env.ORIGIN || 'https://bank.local:3000';
