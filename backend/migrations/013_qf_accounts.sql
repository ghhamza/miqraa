-- Link a Miqraa user to their Quran Foundation account.
CREATE TABLE IF NOT EXISTS qf_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    qf_sub TEXT NOT NULL UNIQUE,
    qf_email TEXT,
    qf_name TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qf_accounts_user_id ON qf_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_qf_accounts_qf_sub ON qf_accounts(qf_sub);

-- Short-lived state for the OAuth authorization request (CSRF + PKCE + nonce).
CREATE TABLE IF NOT EXISTS qf_oauth_states (
    state TEXT PRIMARY KEY,
    code_verifier TEXT NOT NULL,
    nonce TEXT NOT NULL,
    redirect_after TEXT,
    link_to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qf_oauth_states_expires_at ON qf_oauth_states(expires_at);
