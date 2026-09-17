import { supabase } from '../lib/supabase';

async function listAll() {
  console.log('--- SUPABASE AUTH USERS ---');
  const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) {
    console.error('Error listing auth users:', uErr.message);
  } else {
    console.log(`Found ${usersData.users.length} auth users:`);
    for (const u of usersData.users) {
      console.log(`- ID: ${u.id}, Email: ${u.email}, Created: ${u.created_at}, Metadata:`, u.user_metadata, 'App Metadata:', u.app_metadata);
    }
  }

  console.log('\n--- ORGANIZATIONS & MEMBERS ---');
  const { data: orgs, error: oErr } = await supabase
    .from('organizations')
    .select('id, name, wallet_balance, metadata');
  if (oErr) {
    console.error('Error listing orgs:', oErr.message);
  } else {
    console.log(`Found ${orgs?.length || 0} organizations:`);
    for (const org of orgs || []) {
      console.log(`- Org ID: ${org.id}, Name: ${org.name}, Balance: $${org.wallet_balance}, Meta:`, org.metadata);
    }
  }

  const { data: members, error: mErr } = await supabase
    .from('organization_members')
    .select('*');
  if (mErr) {
    console.error('Error listing members:', mErr.message);
  } else {
    console.log(`Found ${members?.length || 0} members:`);
    for (const m of members || []) {
      console.log(`- User: ${m.user_id}, Org: ${m.organization_id}, Role: ${m.role}`);
    }
  }
}

listAll().catch(console.error);
