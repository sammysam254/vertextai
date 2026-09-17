import {
  getCallBillingRate,
  calculateCallLimit,
  billIncrementalCallUsage,
  billCallUsage,
  KENYA_BILLED_RATE_PER_MIN,
  USA_BILLED_RATE_PER_MIN,
  USA_TWILIO_CARRIER_COST_PER_MIN,
  USA_PLATFORM_PROFIT_PER_MIN,
} from '../services/database/wallet.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runTests() {
  console.log('============================================================');
  console.log('VERIFYING PER-SECOND BILLING & USA PRICING');
  console.log('============================================================\n');

  // Test 1: Kenya Rate & Per-Second Precision
  console.log('TEST 1: Kenya (+254 / 0706499848) Rate & Per-Second Calculation');
  const kenyaRate = getCallBillingRate('0706499848');
  assert(kenyaRate.country === 'KE', 'Detected country is KE');
  assert(Number(kenyaRate.billedRatePerMin.toFixed(4)) === 0.3171, 'Kenya billed rate is $0.3171/min');
  assert(Number(kenyaRate.ratePerSecond.toFixed(6)) === 0.005286, 'Kenya per-second rate is ~$0.005286/sec');

  // Test 2: 18-second call to Kenya (no minute round-up!)
  console.log('\nTEST 2: Deduct only what is used (18 seconds)');
  const duration18s = 18;
  const expected18sCharge = parseFloat((duration18s * kenyaRate.ratePerSecond).toFixed(4));
  console.log(`18 seconds charge: $${expected18sCharge} (formerly $0.3171 under minute round-up)`);
  assert(expected18sCharge === 0.0951, '18 seconds charges exactly $0.0951, NOT a full minute ($0.3171)');

  // Test 3: 49 Minutes spend maintains exact $5.00 profit
  console.log('\nTEST 3: 49 Minutes (2940s) Target Profit ($10.54 cost + $5.00 profit = $15.54 charged)');
  const duration49m = 49 * 60;
  const charge49m = parseFloat((duration49m * kenyaRate.ratePerSecond).toFixed(2));
  const cost49m = parseFloat((duration49m * kenyaRate.carrierRatePerSecond).toFixed(2));
  const profit49m = parseFloat((duration49m * kenyaRate.profitRatePerSecond).toFixed(2));
  console.log(`Charged: $${charge49m}, Cost: $${cost49m}, Profit: $${profit49m}`);
  assert(charge49m === 15.54, 'Charged for 49 minutes is exactly $15.54');
  assert(cost49m === 10.54, 'Carrier cost for 49 minutes is exactly $10.54');
  assert(profit49m === 5.00, 'Net profit for 49 minutes is exactly $5.00');

  // Test 4: USA Outbound Rate (Twilio cost $0.014/min + platform profit)
  console.log('\nTEST 4: USA (+1 251 357 1708) Twilio Cost + Profit');
  const usRate = getCallBillingRate('+12513571708');
  assert(usRate.country === 'US', 'Detected country is US');
  assert(Number(usRate.baseCarrierRatePerMin.toFixed(4)) === 0.0140, 'Twilio US carrier cost is $0.0140/min');
  assert(Number(usRate.profitMarginPerMin.toFixed(4)) === 0.0070, 'Platform profit markup is $0.0070/min');
  assert(Number(usRate.billedRatePerMin.toFixed(4)) === 0.0210, 'USA billed rate is $0.0210/min');
  assert(Number(usRate.ratePerSecond.toFixed(6)) === 0.000350, 'USA rate per second is $0.000350/sec');

  // Test 5: USA 45-second call
  console.log('\nTEST 5: USA Call for 45 seconds');
  const us45s = 45;
  const us45sCharge = parseFloat((us45s * usRate.ratePerSecond).toFixed(4));
  console.log(`45 seconds to USA: $${us45sCharge}`);
  assert(us45sCharge === 0.0158, '45 seconds to US costs ~$0.0158');

  // Test 6: Mid-Call Incremental Second-by-Second Billing
  console.log('\nTEST 6: Incremental Mid-Call Billing in exact seconds');
  // Mock org with $0.20 balance and 0 free minutes
  // At Kenya rate $0.0052857/sec, $0.20 buys ~37.8 seconds
  const mockOrgId = 'test-org-' + Date.now();
  const res1 = await billIncrementalCallUsage({
    organizationId: '00000000-0000-0000-0000-000000000000',
    callSid: 'CA_test_second_1',
    elapsedSeconds: 10,
    previouslyBilledSeconds: 0,
    destinationPhone: '0706499848',
  });
  console.log('10s incremental result:', res1);
  assert(res1.newBilledSeconds === 10, 'Tracked 10 billed seconds');
  assert(res1.incrementalSecondsBilled === 10, 'Billed 10 incremental seconds');

  // Test 7: Pre-call authorization per second
  console.log('\nTEST 7: Pre-call Authorization per second');
  const auth = await calculateCallLimit('00000000-0000-0000-0000-000000000000', '0706499848');
  assert(auth.ratePerSecond > 0, 'Returns valid ratePerSecond');
  assert(auth.maxDurationSeconds > 0, 'Returns valid maxDurationSeconds');

  console.log('\n============================================================');
  console.log('ALL TESTS PASSED! PER-SECOND BILLING & USA RATES FULLY OPERATIONAL');
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
