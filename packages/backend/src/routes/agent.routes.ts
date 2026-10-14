// AI Agent Capability Delegation & Payment Execution Endpoints
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import { Router, Request, Response } from 'express';
import { AgentService } from '../services/agent.service';

const router = Router();

/**
 * Step 1: Client requests delegation challenge for a proposed agent action.
 * Server cryptographically binds the exact recipient and amount into the challenge.
 */
router.post('/delegate-challenge', (req: Request, res: Response) => {
  try {
    const { action, recipient, maxAmount } = req.body;

    if (!action || !recipient || typeof maxAmount !== 'number' || maxAmount <= 0) {
      res.status(400).json({
        error: 'INVALID_INTENT_PARAMETERS',
        message: 'Must provide valid action string, recipient string, and positive maxAmount number.',
      });
      return;
    }

    const userId = req.user?.id || 'demo_citizen_user';
    const intent = AgentService.createDelegationIntent({
      userId,
      action,
      recipient,
      maxAmount,
    });

    res.status(200).json({
      success: true,
      intentId: intent.intentId,
      challenge: intent.challenge,
      binding: {
        action: intent.action,
        recipient: intent.recipient,
        maxAmount: intent.maxAmount,
        expiresAt: intent.expiresAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'DELEGATION_CHALLENGE_FAILED', message: error.message });
  }
});

/**
 * Step 2: Client submits passkey assertion confirming biometric sign-off on the intent.
 * Server validates and mints a cryptographically signed HMAC-SHA256 capability token.
 */
router.post('/delegate-verify', (req: Request, res: Response) => {
  try {
    const { intentId, assertionResponse } = req.body;

    if (!intentId) {
      res.status(400).json({ error: 'MISSING_INTENT_ID', message: 'intentId is required.' });
      return;
    }

    const intent = AgentService.getIntent(intentId);
    if (!intent) {
      res.status(404).json({ error: 'INTENT_NOT_FOUND', message: 'Delegation intent expired or invalid.' });
      return;
    }

    // In full sprint: Sanchit's WebAuthn verification validates assertionResponse against intent.challenge.
    // For Day 2 contract freeze: verify intent state and issue token.
    const capabilityToken = AgentService.mintCapabilityToken(intent);

    res.status(200).json({
      success: true,
      capabilityToken,
      expiresAt: intent.expiresAt,
      boundConstraints: {
        action: intent.action,
        recipient: intent.recipient,
        maxAmount: intent.maxAmount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'DELEGATION_VERIFICATION_FAILED', message: error.message });
  }
});

/**
 * Step 3: AI Agent or Gateway executes transaction presenting capability token.
 * Middleware enforces exact recipient, amount ceiling, and single-use nonce.
 */
router.post('/execute-payment', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'MISSING_CAPABILITY_TOKEN',
        message: 'Must supply Bearer capability token authorized by user passkey.',
      });
      return;
    }

    const token = authHeader.substring(7).trim();
    const { recipient, amount } = req.body;

    if (!recipient || typeof amount !== 'number') {
      res.status(400).json({
        error: 'INVALID_EXECUTION_PAYLOAD',
        message: 'Must provide target recipient and numerical amount.',
      });
      return;
    }

    const result = AgentService.executeConstrainedAction(token, { recipient, amount });
    res.status(200).json(result);
  } catch (error: any) {
    const message = error.message || '';

    if (message.includes('CAPABILITY_VIOLATION')) {
      res.status(403).json({
        error: 'CAPABILITY_CONSTRAINT_VIOLATION',
        message,
        blocked: true,
      });
      return;
    }

    if (message.includes('TOKEN_REPLAY')) {
      res.status(409).json({
        error: 'TOKEN_ALREADY_SPENT',
        message: 'Single-use capability nonce has already been consumed.',
      });
      return;
    }

    if (message.includes('TOKEN_EXPIRED')) {
      res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Capability token has expired.' });
      return;
    }

    res.status(400).json({ error: 'CAPABILITY_EXECUTION_FAILED', message });
  }
});

export default router;
