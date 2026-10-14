// Illustrative UI fixtures only; never evidence of a live security result.
export type Device = { id: string; name: string; status: 'ACTIVE' | 'REVOKED'; lastUsed: string };
export type AuditEvent = { id: string; timestamp: string; eventType: string; userId: string; ipAddress: string; details: Record<string, unknown> };
export const deviceFixture: { devices: Device[] } = {
  devices: [{ id: 'demo-credential', name: 'Demo laptop', status: 'ACTIVE', lastUsed: '2026-10-14T08:30:00Z' }],
};
export const auditFixture: { logs: AuditEvent[] } = {
  logs: [{ id: 'demo-event', timestamp: '2026-10-14T08:30:00Z', eventType: 'USER_LOGIN_SUCCESS', userId: 'demo-user', ipAddress: '127.0.0.1', details: { demo: true } }],
};
