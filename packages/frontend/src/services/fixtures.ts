// Illustrative UI fixtures only; never evidence of a live security result.
import type { Device, AuditEvent } from './types';
export const deviceFixture: { devices: Device[] } = {
  devices: [{ id: 'demo-credential', name: 'Demo laptop', status: 'ACTIVE', lastUsed: '2026-10-14T08:30:00Z' }],
};
export const auditFixture: { logs: AuditEvent[] } = {
  logs: [{ id: 'demo-event', timestamp: '2026-10-14T08:30:00Z', eventType: 'USER_LOGIN_SUCCESS', userId: 'demo-user', ipAddress: '127.0.0.1', details: { demo: true } }],
};
