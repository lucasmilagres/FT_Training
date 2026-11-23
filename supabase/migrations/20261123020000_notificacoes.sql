-- =========================================================
-- FT TRAINING — Notificações (Web Push)
-- Uma linha por aparelho em que a pessoa tocou em "Ativar notificações".
-- endpoint/p256dh/auth vêm do navegador (serviço de push da Apple, Google ou Mozilla).
-- Só o servidor acessa.
-- =========================================================

create table public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  aparelho text,
  criado_em timestamptz not null default now(),
  ultimo_envio_em timestamptz
);
create index push_inscricoes_perfil_id_idx on public.push_inscricoes (perfil_id);

alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from anon, authenticated;
grant select, insert, update, delete on public.push_inscricoes to service_role;
