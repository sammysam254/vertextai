import { supabase } from '../lib/supabase';

async function main() {
  console.log('=== 1. RESET ALL WALLET BALANCES TO $0.00 ===');
  const { data: orgs, error: fetchErr } = await supabase
    .from('organizations')
    .select('id, name, wallet_balance');

  if (fetchErr) {
    console.error('Error fetching organizations:', fetchErr.message);
  } else {
    console.log(`Found ${orgs?.length || 0} organizations. Resetting balances...`);
    for (const org of orgs || []) {
      const { error: updErr } = await supabase
        .from('organizations')
        .update({ wallet_balance: 0.00 })
        .eq('id', org.id);

      if (updErr) {
        console.error(`Failed to reset org ${org.id} (${org.name}):`, updErr.message);
      } else {
        console.log(`✓ Reset org ${org.name} (${org.id}) from $${org.wallet_balance} to $0.00`);
      }
    }
  }

  // Clear wallet_transactions or add reset record
  console.log('Wallet balances reset complete.');

  console.log('\n=== 2. FIND AND PROMOTE sammyseth260 TO SUPER ADMIN ===');
  const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) {
    console.error('Error listing auth users:', uErr.message);
    return;
  }

  console.log(`Scanning ${usersData.users.length} registered users...`);
  let targetUser = usersData.users.find(u => 
    (u.email && u.email.toLowerCase().includes('sammyseth260')) ||
    (u.user_metadata?.username && String(u.user_metadata.username).toLowerCase().includes('sammyseth260')) ||
    (u.user_metadata?.name && String(u.user_metadata.name).toLowerCase().includes('sammyseth260'))
  );

  if (!targetUser) {
    console.log('Could not find user with "sammyseth260" in email/metadata. Listing all registered emails:');
    for (const u of usersData.users) {
      console.log(`- ID: ${u.id}, Email: ${u.email}`);
    }
  } else {
    console.log(`Found target user: ${targetUser.email} (ID: ${targetUser.id})`);
    
    // Update app_metadata and user_metadata
    const { data: updatedUser, error: updateAuthErr } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      {
        app_metadata: {
          ...targetUser.app_metadata,
          role: 'super_admin',
          is_super_admin: true,
        },
        user_metadata: {
          ...targetUser.user_metadata,
          role: 'super_admin',
          is_super_admin: true,
        },
      }
    );

    if (updateAuthErr) {
      console.error('Failed to update auth user metadata:', updateAuthErr.message);
    } else {
      console.log(`✓ User ${targetUser.email} metadata updated to role: 'super_admin'`);
    }

    // Update organization_members role
    const { error: memErr } = await supabase
      .from('organization_members')
      .update({ role: 'super_admin' })
      .eq('user_id', targetUser.id);

    if (memErr) {
      console.error('Failed to update organization_members role:', memErr.message);
    } else {
      console.log(`✓ Updated organization_members for user ${targetUser.id} to role: 'super_admin'`);
    }
  }
}

main().catch(console.error);
