create table if not exists public.vault_metadata (
  user_id text primary key,
  linked_accounts_count integer not null default 0,
  categories_count integer not null default 0,
  family_members_count integer not null default 0,
  shard_count integer not null default 0,
  encrypted_envelope jsonb not null,
  encrypted_shards jsonb not null,
  last_sync_at timestamptz not null default now()
);

alter table public.vault_metadata enable row level security;

create policy "vault owner can read metadata"
on public.vault_metadata
for select
using (auth.uid()::text = user_id);

create policy "vault owner can write metadata"
on public.vault_metadata
for all
using (auth.uid()::text = user_id)
with check (auth.uid()::text = user_id);
