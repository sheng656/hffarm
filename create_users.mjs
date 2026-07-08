// Create initial users via Supabase Admin API
// Run: node create_users.mjs

const SUPABASE_URL = 'https://dcafcfiqyfzoqwpmvpyj.supabase.co';
// We need the service role key - read from env or pass as arg
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node create_users.mjs <service_role_key>');
  process.exit(1);
}

const users = [
  { email: 'ichsh48@gmail.com', role: 'admin', display_name: 'Admin (ichsh48)' },
  { email: 'betty.huforwork@gmail.com', role: 'admin', display_name: 'Betty' },
  { email: 'vivianshe2011@gmail.com', role: 'editor', display_name: 'Vivian' },
  { email: 'hfkaraka2022@gmail.com', role: 'editor', display_name: 'HF Karaka' },
  { email: 'ruiwang1974@gmail.com', role: 'editor', display_name: 'Rui Wang' },
  { email: 'tszfungfan76@gmail.com', role: 'editor', display_name: 'Tszfung Fan' },
  { email: 'why121257353@gmail.com', role: 'editor', display_name: 'Staff (why)' },
  { email: 'wy380567211@gmail.com', role: 'editor', display_name: 'Staff (wy)' },
];

const INITIAL_PASSWORD = 'HFfarm2026';

async function createUser(user) {
  // Create auth user
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email: user.email,
      password: INITIAL_PASSWORD,
      email_confirm: true,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (data.msg && data.msg.includes('already been registered')) {
      console.log(`⚠️  User already exists: ${user.email}`);
      // Try to get existing user id
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(user.email)}`, {
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
      });
      const listData = await listRes.json();
      const existingUser = listData.users?.[0];
      if (existingUser) {
        return { id: existingUser.id, email: user.email, role: user.role, display_name: user.display_name };
      }
      return null;
    }
    console.error(`❌ Failed to create ${user.email}:`, data);
    return null;
  }

  console.log(`✅ Created user: ${user.email} (id: ${data.id})`);
  return { id: data.id, email: user.email, role: user.role, display_name: user.display_name };
}

async function upsertProfile(user) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    console.error(`❌ Failed to create profile for ${user.email}:`, data);
  } else {
    console.log(`✅ Profile upserted for: ${user.email} (role: ${user.role})`);
  }
}

async function main() {
  console.log('Creating initial users...\n');
  for (const user of users) {
    const created = await createUser(user);
    if (created) {
      await upsertProfile(created);
    }
  }
  console.log('\nDone!');
}

main().catch(console.error);
