/**
 * Seed a tenant (regions row) + satellite_admin Auth user for local/dev.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional overrides via env:
 *   SEED_REGION_CODE (default: DEMO)
 *   SEED_REGION_NAME (default: Demo Tenant)
 *   SEED_ADMIN_EMAIL (default: admin@demo.local)
 *   SEED_ADMIN_PASSWORD (default: DemoAdmin123!)
 *   SEED_ADMIN_NAME (default: Demo Satellite Admin)
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-tenant-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const regionCode = process.env.SEED_REGION_CODE ?? "DEMO";
const regionName = process.env.SEED_REGION_NAME ?? "Demo Tenant";
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@demo.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "DemoAdmin123!";
const adminName = process.env.SEED_ADMIN_NAME ?? "Demo Satellite Admin";

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureRegion() {
  const { data: existing, error: findError } = await admin
    .from("regions")
    .select("id, code, name, is_active")
    .eq("code", regionCode)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    if (!existing.is_active) {
      const { error } = await admin
        .from("regions")
        .update({ is_active: true, name: regionName })
        .eq("id", existing.id);
      if (error) throw error;
    }
    console.log(`Region ready: ${existing.code} (${existing.id})`);
    return existing.id;
  }

  const { data: created, error: insertError } = await admin
    .from("regions")
    .insert({ code: regionCode, name: regionName, is_active: true })
    .select("id, code")
    .single();

  if (insertError) throw insertError;
  console.log(`Region created: ${created.code} (${created.id})`);
  return created.id;
}

async function ensureAdmin(regionId) {
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
          role: "satellite_admin",
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
      role: "satellite_admin",
      region_id: regionId,
      validation_status: "validated",
      is_active: true,
    })
    .eq("id", user.id);

  if (profileError) throw profileError;
  console.log(
    `Profile set: role=satellite_admin region_id=${regionId} validated`,
  );

  return user.id;
}

const regionId = await ensureRegion();
const userId = await ensureAdmin(regionId);

console.log("\nDone. Sign in at /signin with:");
console.log(`  email:    ${adminEmail}`);
console.log(`  password: ${adminPassword}`);
console.log(`  home:     /admin`);
console.log(`  user_id:  ${userId}`);
console.log(`  region:   ${regionCode} (${regionId})`);
