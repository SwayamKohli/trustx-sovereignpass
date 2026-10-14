// AI Intent Binding & HMAC Capability Token Verification Service
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import crypto from 'crypto';

export interface DelegationIntent {
  intentId: string;
  userId: string;
  action: string;
  recipient: string;
  maxAmount: number;
  nonce: string;
  challenge: string;
  expiresAt: number; // Unix timestamp ms
  status: 'PENDING' | 'AUTHORIZED' | 'CONSUMED' | 'EXPIRED';
}

export interface CapabilityPayload {
  intentId: string;
  userId: string;
  action: string;
  recipient: string;
  maxAmount: number;
  nonce: string;
  expiresAt: number;
}

export class AgentService {
  private static readonly SECRET_KEY =
    process.env.AGENT_CAPABILITY_SECRET || 'trustx-sovereignpass-agent-secret-key-2026';

  // In-memory intent and spent nonce store for Day 2 contract freeze (SQLite schema integration in Sprint 3)
  private static pendingIntents = new Map<string, DelegationIntent>();
  private static spentNonces = new Set<string>();

  /**
   * Creates a structured intent and generates a single-use WebAuthn challenge
   * cryptographically bound to the exact approved transaction parameters.
   */
  public static createDelegationIntent(params: {
    userId: string;
    action: string;
    recipient: string;
    maxAmount: number;
  }): DelegationIntent {
    const intentId = `intent_${crypto.randomBytes(16).toString('hex')}`;
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5-minute validity window

    // Cryptographically bind parameters into WebAuthn challenge
    const canonicalBinding = `${intentId}:${params.action}:${params.recipient}:${params.maxAmount}:${nonce}:${expiresAt}`;
    const challenge = crypto.createHash('sha256').update(canonicalBinding).digest('hex');

    const intent: DelegationIntent = {
      intentId,
      userId: params.userId,
      action: params.action,
      recipient: params.recipient,
      maxAmount: params.maxAmount,
      nonce,
      challenge,
      expiresAt,
      status: 'PENDING',
    };

    this.pendingIntents.set(intentId, intent);
    return intent;
  }

  /**
   * Retrieves a pending intent by ID, verifying expiration.
   */
  public static getIntent(intentId: string): DelegationIntent | null {
    const intent = this.pendingIntents.get(intentId);
    if (!intent) return null;
    if (Date.now() > intent.expiresAt) {
      intent.status = 'EXPIRED';
      return null;
    }
    return intent;
  }

  /**
   * Mints an HMAC-SHA256 signed capability token upon successful biometric assertion.
   */
  public static mintCapabilityToken(intent: DelegationIntent): string {
    intent.status = 'AUTHORIZED';

    const payload: CapabilityPayload = {
      intentId: intent.intentId,
      userId: intent.userId,
      action: intent.action,
      recipient: intent.recipient,
      maxAmount: intent.maxAmount,
      nonce: intent.nonce,
      expiresAt: intent.expiresAt,
    };

    const payloadJson = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', this.SECRET_KEY).update(payloadJson).digest('hex');

    return `${Buffer.from(payloadJson).toString('base64url')}.${signature}`;
  }

  /**
   * Validates capability token, verifies HMAC signature, checks expiry, and enforces
   * single-use nonce freshness.
   */
  public static verifyCapabilityToken(token: string): CapabilityPayload {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new Error('MALFORMED_CAPABILITY_TOKEN: Token must have 2 dot-separated parts');
    }

    const [payloadB64, signature] = parts;
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');

    const expectedSignature = crypto.createHmac('sha256', this.SECRET_KEY).update(payloadJson).digest('hex');

    const sigA = Buffer.from(signature);
    const sigB = Buffer.from(expectedSignature);

    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      throw new Error('INVALID_SIGNATURE: Capability token signature mismatch');
    }

    const payload = JSON.parse(payloadJson) as CapabilityPayload;

    if (Date.now() > payload.expiresAt) {
      throw new Error('TOKEN_EXPIRED: Capability token has expired');
    }

    if (this.spentNonces.has(payload.nonce)) {
      throw new Error('TOKEN_REPLAY: Single-use capability token nonce already spent');
    }

    return payload;
  }

  /**
   * Enforces parameter bounds on execution. Atomically burns the nonce if validation passes.
   */
  public static executeConstrainedAction(
    token: string,
    execution: { recipient: string; amount: number }
  ): { success: true; txId: string; executedAmount: number; recipient: string } {
    const capability = this.verifyCapabilityToken(token);

    // 1. Recipient Constraint Check (Defense against prompt injection)
    if (execution.recipient !== capability.recipient) {
      throw new Error(
        `CAPABILITY_VIOLATION_RECIPIENT: Target recipient '${execution.recipient}' does not match authorized '${capability.recipient}'`
      );
    }

    // 2. Maximum Amount Constraint Check
    if (execution.amount > capability.maxAmount) {
      throw new Error(
        `CAPABILITY_VIOLATION_AMOUNT: Requested amount ${execution.amount} exceeds authorized ceiling ${capability.maxAmount}`
      );
    }

    // 3. Atomically consume single-use nonce
    this.spentNonces.add(capability.nonce);
    const intent = this.pendingIntents.get(capability.intentId);
    if (intent) intent.status = 'CONSUMED';

    return {
      success: true,
      txId: `tx_${crypto.randomBytes(12).toString('hex')}`,
      executedAmount: execution.amount,
      recipient: execution.recipient,
    };
  }
}
