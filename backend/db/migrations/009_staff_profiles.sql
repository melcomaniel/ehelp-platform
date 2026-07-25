-- Staff display identity (separate from beneficiaries / PhilSys).

CREATE TABLE IF NOT EXISTS staff_profiles (
  user_account_id UUID PRIMARY KEY REFERENCES user_accounts (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
