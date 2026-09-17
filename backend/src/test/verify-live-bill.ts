import { billCallUsage, getWalletSummary, getCallBillingRate } from '../services/database/wallet.service';

async function main() {
  const orgId = '00000000-0000-0000-0000-000000000000';
  const phone = '+254706499848';
  const durationSeconds = 18;

  console.log('--- 1. RATE LOOKUP ---');
  const rateInfo = getCallBillingRate(phone);
  console.log('Destination rate:', rateInfo);

  console.log('\n--- 2. WALLET BEFORE CALL ---');
  const walletBefore = await getWalletSummary(orgId);
  console.log('Wallet before:', walletBefore);

  console.log('\n--- 3. EXECUTING BILL CALL USAGE ---');
  const billResult = await billCallUsage({
    organizationId: orgId,
    callSid: 'CAb9ca7e2bdb01dbb8545ef63b820500e1',
    durationSeconds,
    destinationPhone: phone,
    carrierCost: 0.3933,
  });
  console.log('Bill result:', billResult);

  console.log('\n--- 4. WALLET AFTER CALL ---');
  const walletAfter = await getWalletSummary(orgId);
  console.log('Wallet after:', walletAfter);
}

main().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
