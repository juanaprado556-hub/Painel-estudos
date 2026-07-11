-- Execute este script no SQL Editor do seu projeto Supabase
-- (painel do projeto → SQL Editor → New query → colar e rodar)

create table if not exists painel_dados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table painel_dados enable row level security;

create policy "usuario_ve_apenas_seus_dados"
  on painel_dados for select
  using (auth.uid() = user_id);

create policy "usuario_insere_apenas_seus_dados"
  on painel_dados for insert
  with check (auth.uid() = user_id);

create policy "usuario_atualiza_apenas_seus_dados"
  on painel_dados for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
