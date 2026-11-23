-- =========================================================
-- FT TRAINING — Treinos da TV organizados pela IA (Gemini)
-- Um registro por dia. "fonte" é o que o leitor tirou da planilha e "hash" é a
-- assinatura dela: se a planilha mudar depois, a versão da IA deixa de valer e a
-- TV volta a mostrar a leitura direta da planilha até alguém ler e aprovar de novo.
-- Só o servidor acessa (mesmas regras das outras tabelas).
-- =========================================================

create table public.tv_dias (
  data date primary key,
  hash text not null,
  fonte jsonb not null,
  ia jsonb,
  alertas jsonb not null default '[]'::jsonb,
  modelo text,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado')),
  gerado_em timestamptz not null default now(),
  aprovado_em timestamptz,
  aprovado_por uuid references public.perfis (id) on delete set null
);
create index tv_dias_aprovado_por_idx on public.tv_dias (aprovado_por);

alter table public.tv_dias enable row level security;
revoke all on public.tv_dias from anon, authenticated;
grant select, insert, update, delete on public.tv_dias to service_role;
