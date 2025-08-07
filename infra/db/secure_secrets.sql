-- Secure secrets table (server-side only)
create table if not exists public.secure_secrets (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  key_name text not null,
  value_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists secure_secrets_provider_keyname_idx
  on public.secure_secrets (provider, key_name);

-- RLS: only service role can read/write
alter table public.secure_secrets enable row level security;
drop policy if exists "secure_secrets_no_access" on public.secure_secrets;
create policy "secure_secrets_no_access"
  on public.secure_secrets for all
  using (false)
  with check (false);

