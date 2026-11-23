-- =========================================================
-- FT TRAINING — Plataforma de alunos (Supabase só como banco)
-- O login é o "Entrar com Google" do próprio site (api/google).
-- Quem lê e grava é só o servidor do site (funções da Vercel, com a
-- chave secreta do Supabase). As permissões (coach só mexe nos alunos
-- dele, aluno só vê o que é dele) ficam no código de api/.
-- As chaves públicas (anon/authenticated) não enxergam nada: RLS ligado,
-- sem políticas e sem permissão nas tabelas.
--
-- Rodar uma vez, num banco vazio, no SQL Editor do Supabase.
-- =========================================================

create schema if not exists privado;
revoke all on schema privado from public;

create type public.papel as enum ('admin', 'coach', 'aluno');
create type public.modalidade as enum ('musculacao', 'corrida', 'hyrox', 'outro');
create type public.status_plano as enum ('ativo', 'congelado', 'cancelado');

create function privado.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- ---------- Perfis (uma linha por conta Google que entrou ou foi convidada) ----------
create table public.perfis (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email like '%@%'),
  nome text not null default '',
  telefone text,
  papel public.papel not null default 'aluno',
  coach_id uuid references public.perfis (id) on delete set null,
  ativo boolean not null default false,
  consentimento_saude_em timestamptz,
  ultimo_acesso_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index perfis_email_idx on public.perfis (email);
create index perfis_coach_id_idx on public.perfis (coach_id);
create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function privado.tocar_atualizado_em();

-- ---------- Convites ----------
-- O coach cadastra o e-mail Google do aluno; no primeiro "Entrar com Google"
-- o perfil já nasce liberado e ligado ao coach.
create table public.convites (
  email text primary key check (email = lower(email) and email like '%@%'),
  nome text not null default '',
  papel public.papel not null default 'aluno',
  coach_id uuid references public.perfis (id) on delete set null,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index convites_coach_id_idx on public.convites (coach_id);
create index convites_criado_por_idx on public.convites (criado_por);

-- Se a pessoa já tem perfil, o convite libera na hora e não fica guardado.
create function privado.aplicar_convite() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  update public.perfis
     set papel = new.papel,
         coach_id = new.coach_id,
         ativo = true,
         nome = case when nome = '' then new.nome else nome end
   where email = new.email;
  if found then
    return null;
  end if;
  return new;
end $$;
create trigger convites_aplicar before insert on public.convites
  for each row execute function privado.aplicar_convite();

-- Chamada pelo servidor depois que o Google confirma o e-mail.
-- Devolve o perfil; quem entra sem convite fica com ativo = false
-- (aparece para o admin como pedido de acesso).
create function public.entrar_com_google(p_email text, p_nome text)
returns public.perfis
language plpgsql set search_path = '' as $$
declare
  e text := lower(trim(p_email));
  p public.perfis%rowtype;
  c public.convites%rowtype;
begin
  if e is null or e not like '%@%' then
    raise exception 'E-mail inválido';
  end if;

  update public.perfis
     set ultimo_acesso_em = now(),
         nome = case when nome = '' then coalesce(p_nome, '') else nome end
   where email = e
  returning * into p;
  if found then
    return p;
  end if;

  select * into c from public.convites where email = e;
  insert into public.perfis (email, nome, papel, coach_id, ativo, ultimo_acesso_em)
  values (e, coalesce(nullif(c.nome, ''), p_nome, ''), coalesce(c.papel, 'aluno'),
          c.coach_id, c.email is not null, now())
  returning * into p;
  delete from public.convites where email = e;
  return p;
end $$;

-- ---------- Planos ----------
create table public.planos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  nome text not null,
  inicio date not null default current_date,
  fim date,
  status public.status_plano not null default 'ativo',
  observacoes text,
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index planos_aluno_id_idx on public.planos (aluno_id);

-- ---------- Biblioteca de exercícios ----------
create table public.exercicios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  modalidade public.modalidade not null default 'musculacao',
  medida text,
  video_url text,
  orientacoes text,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create unique index exercicios_nome_idx on public.exercicios (lower(nome));
create index exercicios_criado_por_idx on public.exercicios (criado_por);

-- ---------- Templates de treino ----------
-- estrutura: { aquecimento_min, desaquecimento_min,
--   blocos: [{ repetir, atividades: [{ exercicio_id, nome, equipamento,
--     series, reps, carga, tempo_s, distancia_m, descanso_s, obs }] }] }
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_tecnico text,
  modalidade public.modalidade not null,
  tipo text,
  estrutura jsonb not null default '{"blocos": []}'::jsonb
    check (jsonb_typeof(estrutura) = 'object'),
  observacoes text,
  ativo boolean not null default true,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index templates_criado_por_idx on public.templates (criado_por);
create trigger templates_atualizado_em before update on public.templates
  for each row execute function privado.tocar_atualizado_em();

-- ---------- Treinos do aluno (um por dia, ou mais com "ordem") ----------
-- Guarda uma cópia da estrutura: mudar o template depois não altera treinos já passados.
create table public.treinos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  data date not null,
  ordem smallint not null default 0,
  template_id uuid references public.templates (id) on delete set null,
  nome text not null,
  modalidade public.modalidade not null,
  tipo text,
  estrutura jsonb not null default '{"blocos": []}'::jsonb
    check (jsonb_typeof(estrutura) = 'object'),
  observacoes text,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index treinos_aluno_data_idx on public.treinos (aluno_id, data);
create index treinos_template_id_idx on public.treinos (template_id);
create index treinos_criado_por_idx on public.treinos (criado_por);
create trigger treinos_atualizado_em before update on public.treinos
  for each row execute function privado.tocar_atualizado_em();

-- ---------- Registro do aluno (treino feito) ----------
create table public.registros (
  treino_id uuid primary key references public.treinos (id) on delete cascade,
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  concluido_em timestamptz not null default now(),
  duracao_min smallint check (duracao_min between 0 and 1440),
  distancia_km numeric(6, 2) check (distancia_km >= 0),
  esforco smallint check (esforco between 1 and 10),
  comentario text check (char_length(comentario) <= 2000),
  atualizado_em timestamptz not null default now()
);
create index registros_aluno_id_idx on public.registros (aluno_id);
create trigger registros_atualizado_em before update on public.registros
  for each row execute function privado.tocar_atualizado_em();

-- ---------- Comentários no treino (coach e aluno) ----------
create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  treino_id uuid not null references public.treinos (id) on delete cascade,
  autor_id uuid not null references public.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  criado_em timestamptz not null default now()
);
create index comentarios_treino_idx on public.comentarios (treino_id, criado_em);
create index comentarios_autor_id_idx on public.comentarios (autor_id);

-- ---------- Acesso: só o servidor (service_role) ----------
alter table public.perfis enable row level security;
alter table public.convites enable row level security;
alter table public.planos enable row level security;
alter table public.exercicios enable row level security;
alter table public.templates enable row level security;
alter table public.treinos enable row level security;
alter table public.registros enable row level security;
alter table public.comentarios enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema privado from public, anon, authenticated;
grant execute on function public.entrar_com_google(text, text) to service_role;

-- Tabelas e funções criadas no futuro também nascem fechadas para as chaves públicas
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- Dados iniciais: estações da prova Hyrox ----------
insert into public.exercicios (nome, modalidade, medida) values
  ('SkiErg', 'hyrox', '1000 m'),
  ('Sled Push', 'hyrox', '50 m'),
  ('Sled Pull', 'hyrox', '50 m'),
  ('Burpee Broad Jump', 'hyrox', '80 m'),
  ('Remo', 'hyrox', '1000 m'),
  ('Farmers Carry', 'hyrox', '200 m'),
  ('Sandbag Lunges', 'hyrox', '100 m'),
  ('Wall Balls', 'hyrox', '100 reps');
