/**
 * Seed a DSWD (super) admin Auth user for local/dev.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   SEED_DSWD_EMAIL (default: dswd@demo.local)
 *   SEED_DSWD_PASSWORD (default: DswdAdmin123!)
 *   SEED_DSWD_NAME (default: Demo DSWD Admin)
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-dswd-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminEmail = process.env.SEED_DSWD_EMAIL ?? "dswd@demo.local";
const adminPassword = process.env.SEED_DSWD_PASSWORD ?? "DswdAdmin123!";
const adminName = process.env.SEED_DSWD_NAME ?? "Demo DSWD Admin";

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listError) throw listError;

let user = listed.users.find(
  (u) => u.email?.toLowerCase() === adminEmail.toLowerCase(),
);

if (!user) {
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminName,
        role: "dswd_admin",
      },
    });
  if (createError) throw createError;
  user = created.user;
  console.log(`Auth user created: ${user.email} (${user.id})`);
} else {
  console.log(`Auth user exists: ${user.email} (${user.id})`);
}

const { error: profileError } = await admin
  .from("profiles")
  .update({
    email: adminEmail,
    full_name: adminName,
    role: "dswd_admin",
    region_id: null,
    validation_status: "validated",
    is_active: true,
  })
  .eq("id", user.id);

if (profileError) throw profileError;

console.log("\nDone. Sign in at /signin with:");
console.log(`  email:    ${adminEmail}`);
console.log(`  password: ${adminPassword}`);
console.log(`  home:     /admin`);
console.log(`  role:     dswd_admin`);
