import { supabase } from '../lib/supabase';

async function resetAllWalletBalances() {
  console.log('Resetting all wallet balances and test deposits in Supabase...');

  // 1. Reset organizations wallet_balance to 0.00
  const { data: orgs, error: fetchErr } = await supabase
    .from('organizations')
    .select('id, name, wallet_balance, metadata');

  if (fetchErr) {
    console.error('Error fetching organizations:', fetchErr.message);
    return;
  }

  console.log(`Found ${orgs?.length || 0} organizations`);

  for (const org of orgs || []) {
    const meta = org.metadata || {};
    const updatedMeta = {
      ...meta,
      wallet_balance: 0.00,
      monthly_free_minutes_used: 0,
    };

    const { error: updateErr } = await supabase
      .from('organizations')
      .update({
        wallet_balance: 0.00,
        monthly_free_minutes_used: 0,
        metadata: updatedMeta,
      })
      .eq('id', org.id);

    if (updateErr) {
      console.error(`Failed to reset org ${org.id}:`, updateErr.message);
    } else {
      console.log(`Reset wallet balance for org ${org.id} (${org.name || 'Unnamed'}) to $0.00`);
    }
  }

  // 2. Clean up fast_topup / test transactions
  const { error: txErr } = await supabase
    .from('wallet_transactions')
    .delete()
    .or('payment_gateway.eq.fast_topup,payment_gateway.eq.direct_deposit');

  if (txErr) {
    console.log('Note deleting test transactions:', txErr.message);
  } else {
    console.log('Deleted test wallet transactions');
  }

  console.log('All wallet balances have been reset to $0.00.');
}

resetAllWalletBalances().catch(console.error);
