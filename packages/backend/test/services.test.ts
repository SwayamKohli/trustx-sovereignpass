// Backend Unit Tests: Risk Engine & AI Agent Constrained Delegation
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import assert from 'assert';
import { RiskService } from '../src/services/risk.service';
import { AgentService } from '../src/services/agent.service';

async function runTests() {
  console.log('[TEST] Starting Risk Engine & Agent Delegation unit tests...');

  // ==========================================
  // 1. Risk Engine Tests
  // ==========================================
  // Test baseline risk
  const baseline = RiskService.evaluateRisk({
    currentIp: '127.0.0.1',
    sessionIp: '127.0.0.1',
    currentUserAgent: 'Mozilla/5.0 Chrome/130',
    sessionUserAgent: 'Mozilla/5.0 Chrome/130',
    method: 'GET',
    route: '/api/devices/list',
  });
  assert.strictEqual(baseline.level, 'LOW');
  assert.strictEqual(baseline.stepUpRequired, false);

  // Test IP divergence triggering high risk / step-up
  const ipDivergence = RiskService.evaluateRisk({
    currentIp: '198.51.100.42', // New IP
    sessionIp: '127.0.0.1',
    currentUserAgent: 'Mozilla/5.0 Chrome/130',
    sessionUserAgent: 'Mozilla/5.0 Chrome/130',
    method: 'GET',
    route: '/api/devices/list',
  });
  assert.strictEqual(ipDivergence.score >= 50, true);

  // Test sensitive route triggering step-up
  const sensitiveAction = RiskService.evaluateRisk({
    currentIp: '127.0.0.1',
    sessionIp: '127.0.0.1',
    currentUserAgent: 'Mozilla/5.0 Chrome/130',
    sessionUserAgent: 'Mozilla/5.0 Chrome/130',
    method: 'POST',
    route: '/api/devices/revoke',
  });
  assert.strictEqual(sensitiveAction.stepUpRequired, false); // baseline (10) + sensitive (40) = 50 (MEDIUM)

  // Test combined IP change + sensitive route
  const criticalAction = RiskService.evaluateRisk({
    currentIp: '203.0.113.1',
    sessionIp: '127.0.0.1',
    currentUserAgent: 'Mozilla/5.0 Chrome/130',
    sessionUserAgent: 'Mozilla/5.0 Chrome/130',
    method: 'POST',
    route: '/api/devices/revoke',
  });
  assert.strictEqual(criticalAction.level, 'HIGH');
  assert.strictEqual(criticalAction.stepUpRequired, true);

  // Test Intent Hash canonical generation
  const hash1 = RiskService.computeIntentHash('POST', '/api/devices/revoke', { credentialId: 'cred-1' });
  const hash2 = RiskService.computeIntentHash('POST', '/api/devices/revoke', { credentialId: 'cred-1' });
  const hashTampered = RiskService.computeIntentHash('POST', '/api/devices/revoke', { credentialId: 'cred-2' });
  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, hashTampered);
  console.log('✓ Risk Engine: Contextual anomaly scoring & intent hashing verified.');

  // ==========================================
  // 2. AI Agent Delegation Tests
  // ==========================================
  const intent = AgentService.createDelegationIntent({
    userId: 'user_alice',
    action: 'POST /api/v1/payments',
    recipient: 'TataPower',
    maxAmount: 2000,
  });
  assert.ok(intent.intentId.startsWith('intent_'));
  assert.strictEqual(intent.recipient, 'TataPower');
  assert.strictEqual(intent.maxAmount, 2000);

  // Mint capability token
  const token = AgentService.mintCapabilityToken(intent);
  assert.ok(token.includes('.'));

  // Test authorized execution within bounds
  const exec1 = AgentService.executeConstrainedAction(token, {
    recipient: 'TataPower',
    amount: 1450,
  });
  assert.strictEqual(exec1.success, true);
  assert.strictEqual(exec1.executedAmount, 1450);

  // Test Replay Prevention (same token executed twice must fail)
  assert.throws(
    () => {
      AgentService.executeConstrainedAction(token, {
        recipient: 'TataPower',
        amount: 200,
      });
    },
    /TOKEN_REPLAY/,
    'Replay attack was not blocked!'
  );

  // Test Prompt-Injection / Recipient Tampering Defense
  const intent2 = AgentService.createDelegationIntent({
    userId: 'user_alice',
    action: 'POST /api/v1/payments',
    recipient: 'BSES_Delhi',
    maxAmount: 3000,
  });
  const token2 = AgentService.mintCapabilityToken(intent2);

  assert.throws(
    () => {
      // Attacker attempts to divert funds to attacker wallet
      AgentService.executeConstrainedAction(token2, {
        recipient: 'Attacker_Evil_Wallet',
        amount: 3000,
      });
    },
    /CAPABILITY_VIOLATION_RECIPIENT/,
    'Recipient divergence was not blocked!'
  );

  // Test Amount Ceiling Breach Defense
  const intent3 = AgentService.createDelegationIntent({
    userId: 'user_alice',
    action: 'POST /api/v1/payments',
    recipient: 'CollegeTuition',
    maxAmount: 15000,
  });
  const token3 = AgentService.mintCapabilityToken(intent3);

  assert.throws(
    () => {
      // Attacker attempts to execute 50,000 when approved limit is 15,000
      AgentService.executeConstrainedAction(token3, {
        recipient: 'CollegeTuition',
        amount: 50000,
      });
    },
    /CAPABILITY_VIOLATION_AMOUNT/,
    'Amount ceiling breach was not blocked!'
  );

  console.log('✓ AI Agent Delegation: Prompt-injection defense, bound limits & replay prevention verified.');
  console.log('\n[PASS] All Risk Engine & AI Agent Delegation tests passed successfully!\n');
}

runTests().catch(err => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});
