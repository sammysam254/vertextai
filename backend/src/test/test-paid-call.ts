import { billCallUsage, getCallBillingRate } from '../services/database/wallet.service';

async function testPaidCall() {
  const phone = '+254706499848';
  const durationSeconds = 18; // 1 min increment

  console.log('Testing paid call deduction for 18 seconds call (1 min rounded)...');
  const rateInfo = getCallBillingRate(phone);
  console.log('Rate info:', rateInfo);

  // Math check
  const minutes = Math.ceil(durationSeconds / 60);
  const userCharge = minutes * rateInfo.billedRatePerMin;
  const carrierCost = minutes * rateInfo.baseCarrierRatePerMin;
  const platformProfit = minutes * rateInfo.profitMarginPerMin;

  console.log(`Duration: ${durationSeconds}s -> ${minutes} billed minute(s)`);
  console.log(`User Deducted: $${userCharge.toFixed(4)}`);
  console.log(`Carrier Cost: $${carrierCost.toFixed(4)}`);
  console.log(`Net Profit: $${platformProfit.toFixed(4)}`);
  console.log(`Markup %: ${((platformProfit / carrierCost) * 100).toFixed(2)}%`);
}

testPaidCall();
