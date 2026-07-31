-- Login liveness audit (user-owned; not dumped onto user_accounts).
CREATE TABLE IF NOT EXISTS user_login_liveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  liveness_session_id UUID REFERENCES liveness_sessions(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_login_liveness_user_idx
  ON user_login_liveness (user_account_id, verified_at DESC);
