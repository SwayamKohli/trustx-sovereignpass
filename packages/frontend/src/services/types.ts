import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
export type User = { id: string; username: string; role: 'USER' | 'ADMIN' };
export type Session = { user: User; isKiosk?: boolean; expiresAt?: number; isDeviceBound?: boolean; risk?: { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH'; reasons: string[]; ipAddress?: string; userAgent?: string } };
export type Device = { id: string; name: string; status: 'ACTIVE' | 'REVOKED'; lastUsed: string };
export type Credential = { id: string; username: string; deviceName: string; status: 'ACTIVE' | 'REVOKED'; createdAt: string; lastUsedAt: string };
export type ActiveSession = { sessionId: string; username: string; isKiosk: boolean; ipAddress: string; userAgent: string; createdAt: string; expiresAt: number; isCurrent?: boolean };
export type AuditEvent = { id: string; timestamp: string; eventType: string; userId: string | null; ipAddress?: string; details: Record<string, unknown> };
export type RecoveryTicket = { success: true; recoveryTicket: string; registrationOptions: PublicKeyCredentialCreationOptionsJSON; expiresAt: number };
export type KioskChallenge = { kioskSessionId: string; kioskClientSecret: string; qrData: string; displayCode: number; expiresAt: number };
export type KioskPoll = { status: 'PENDING' | 'EXPIRED' } | ({ status: 'AUTHORIZED' } & Session);
export type PhoneChallenge = PublicKeyCredentialRequestOptionsJSON & { displayCode: number };
export type Probe = { id: string; name: string; status: 'PASS' | 'FAIL' | 'SKIPPED'; detail: string };
export type AttackReport = { runId: string; timestamp: string; probes: Probe[] };
export type ChainReport = { intact: boolean; checkedEvents: number; verifiedAt: string };
export function expiryMilliseconds(value: number): number { return value < 1e12 ? value * 1000 : value; }
