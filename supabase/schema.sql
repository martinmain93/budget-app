-- Vault data table: stores only encrypted blobs, never plaintext.
-- user_id references Supabase Auth's auth.uid() (uuid).
create table if not exists public.vault_data (
  user_id uuid primary key,
  encrypted_envelope jsonb not null,
  encrypted_shards jsonb not null default '[]'::jsonb,
  encrypted_metadata jsonb,
  shard_count integer not null default 0,
  last_sync_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.vault_data enable row level security;

create policy "vault owner can read own data"
on public.vault_data
for select
using (auth.uid() = user_id);

create policy "vault owner can insert own data"
on public.vault_data
for insert
with check (auth.uid() = user_id);

create policy "vault owner can update own data"
on public.vault_data
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "vault owner can delete own data"
on public.vault_data
for delete
using (auth.uid() = user_id);
