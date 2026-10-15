import { generateRegistrationOptions, generateAuthenticationOptions } from '@simplewebauthn/server';
import { rpName, rpID } from '../webauthn/config';

async function testChallenges() {
  console.log('=== WebAuthn Challenge Generation Test ===');
  console.log(`Using RP Name: ${rpName}`);
  console.log(`Using RP ID:   ${rpID}`);

  // 1. Generate Registration Options
  const regOptions = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from('test-user-id-001')),
    userName: 'sanchit@bank.local',
    userDisplayName: 'Sanchit Mishra',
    attestationType: 'none',
  });

  console.log('\n[1/2] Registration Options generated:');
  console.log('Challenge:', regOptions.challenge);
  if (!regOptions.challenge || typeof regOptions.challenge !== 'string' || regOptions.challenge.trim().length === 0) {
    throw new Error('ASSERTION FAILED: Registration challenge is empty or invalid!');
  }
  console.log('✔ Assertion PASSED: Registration challenge is non-empty.');

  // 2. Generate Authentication Options
  const authOptions = await generateAuthenticationOptions({
    rpID,
  });

  console.log('\n[2/2] Authentication Options generated:');
  console.log('Challenge:', authOptions.challenge);
  if (!authOptions.challenge || typeof authOptions.challenge !== 'string' || authOptions.challenge.trim().length === 0) {
    throw new Error('ASSERTION FAILED: Authentication challenge is empty or invalid!');
  }
  console.log('✔ Assertion PASSED: Authentication challenge is non-empty.');

  console.log('\n===========================================');
  console.log('ALL WEBAUTHN CHALLENGE TESTS PASSED (100%)');
  console.log('===========================================');
}

testChallenges().catch((err) => {
  console.error('\n❌ WebAuthn challenge test error:', err);
  process.exit(1);
});
