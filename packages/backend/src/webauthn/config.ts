// WebAuthn Relying Party (RP) Configuration
// Owner: Sanchit (Role 3 — Core Backend & Identity Lifecycle Lead)

import { serverConfig } from '../config/server.config';
if (process.env.ORIGIN && process.env.EXPECTED_ORIGIN && process.env.ORIGIN !== process.env.EXPECTED_ORIGIN) throw new Error('ORIGIN and EXPECTED_ORIGIN must match exactly; use EXPECTED_ORIGIN as the single source.');
export const rpName: string = serverConfig.rpName;
export const rpID: string = serverConfig.rpId;
export const origin: string = serverConfig.expectedOrigin;
