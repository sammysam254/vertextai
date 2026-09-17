// ==============================================
// Voice Billing & Depletion Disconnect Verification Test
// ==============================================

import {
  getCallBillingRate,
  calculateCallLimit,
  billIncrementalCallUsage,
  billCallUsage,
  creditWallet,
  getWalletSummary,
  KENYA_TWILIO_CARRIER_COST_PER_MIN,
  KENYA_PLATFORM_PROFIT_PER_MIN,
  KENYA_BILLED_RATE_PER_MIN,
} from '../services/database/wallet.service';
import { normalizePhoneNumber } from '../lib/phone';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING CALLPULSE VOICE BILLING VERIFICATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // TEST 1: Phone Normalization for 0706499848
  console.log('--- TEST 1: Phone Normalization ---');
  const normalizedTestNumber = normalizePhoneNumber('0706499848');
  assert(normalizedTestNumber === '+254706499848', `0706499848 normalizes to +254706499848 (Got: ${normalizedTestNumber})`);

  // TEST 2: Rate Math Verification ($5 profit on 49 voice minutes)
  console.log('\n--- TEST 2: Rate Math Verification ---');
  const rateInfo = getCallBillingRate(normalizedTestNumber);
  console.log('Detected rate info for Kenya number:', rateInfo);

  assert(rateInfo.country === 'KE', `Country detected as Kenya (Got: ${rateInfo.country})`);
  assert(
    Math.abs(rateInfo.baseCarrierRatePerMin - KENYA_TWILIO_CARRIER_COST_PER_MIN) < 0.0001,
    `Twilio Carrier Cost is ~$0.215102/min (Got: $${rateInfo.baseCarrierRatePerMin})`
  );
  assert(
    Math.abs(rateInfo.profitMarginPerMin - KENYA_PLATFORM_PROFIT_PER_MIN) < 0.0001,
    `Platform Profit is ~$0.102041/min (Got: $${rateInfo.profitMarginPerMin})`
  );

  // Math check for 49 minutes
  const mins = 49;
  const totalTwilioCarrierCost = mins * rateInfo.baseCarrierRatePerMin;
  const totalPlatformProfit = mins * rateInfo.profitMarginPerMin;
  const totalChargedToUser = mins * rateInfo.billedRatePerMin;

  console.log(`\n  49 Minutes Breakdown:`);
  console.log(`  - Twilio Carrier Cost: $${totalTwilioCarrierCost.toFixed(2)} (Target: $10.54)`);
  console.log(`  - Platform Profit:     $${totalPlatformProfit.toFixed(2)} (Target: $5.00)`);
  console.log(`  - Total Charged:       $${totalChargedToUser.toFixed(2)} (Target: $15.54)`);
  console.log(`  - Net Margin:          ${((totalPlatformProfit / totalTwilioCarrierCost) * 100).toFixed(2)}%`);

  assert(Math.abs(totalTwilioCarrierCost - 10.54) < 0.01, `Twilio Cost for 49 mins is exactly $10.54`);
  assert(Math.abs(totalPlatformProfit - 5.00) < 0.01, `Platform Profit for 49 mins is exactly $5.00`);
  assert(Math.abs(totalChargedToUser - 15.54) < 0.01, `Customer Charged for 49 mins is exactly $15.54`);

  // TEST 3: Call Limit & Duration Safety (Hard Carrier Disconnect)
  console.log('\n--- TEST 3: Call Limit & Carrier TimeLimit ---');
  const testOrgId = 'test-org-' + Date.now();

  // 3a. When balance = $0 and free minutes = 0
  const limit = await calculateCallLimit(testOrgId, '0706499848');
  assert(limit.allowed === true && limit.remainingFreeMinutes === 3, 'New org gets 3 monthly free minutes');
  assert(limit.maxDurationSeconds >= 180, 'Max duration allows at least 180s (3 free minutes)');

  // TEST 4: Simulated Mid-Call Billing & Depletion Disconnect
  console.log('\n--- TEST 4: Mid-Call Billing & Depletion Disconnect ---');
  const simCallSid = 'CA_TEST_' + Date.now();

  // Tick at 30 seconds (within minute 1)
  const tick1 = await billIncrementalCallUsage({
    organizationId: testOrgId,
    callSid: simCallSid,
    elapsedSeconds: 30,
    previouslyBilledMinutes: 0,
    destinationPhone: '0706499848',
  });
  assert(tick1.newBilledMinutes === 1, `At 30s, call is in minute 1`);
  assert(tick1.shouldDisconnect === false, `Call should continue during minute 1`);

  // Tick at 45 seconds (still minute 1, no new charge)
  const tick2 = await billIncrementalCallUsage({
    organizationId: testOrgId,
    callSid: simCallSid,
    elapsedSeconds: 45,
    previouslyBilledMinutes: 1,
    destinationPhone: '0706499848',
  });
  assert(tick2.incrementalMinutesBilled === 0, `No new minutes billed at 45s (previously 1)`);

  // TEST 5: Final Call Settlement
  console.log('\n--- TEST 5: Final Call Settlement ---');
  const settlement = await billCallUsage({
    organizationId: testOrgId,
    durationSeconds: 125, // 2 mins 5 secs -> 3 minutes
    callSid: simCallSid,
    destinationPhone: '0706499848',
  });
  console.log('Final settlement result:', settlement);
  assert(settlement.totalMinutes === 3, `125s duration rounds up to 3 billable minutes on Twilio`);

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
