-- =====================================================================
-- INSERTOS 3D · Base de datos del panel de administrador
-- Pega TODO este archivo en Supabase → SQL Editor → New query → Run
-- (Se puede ejecutar más de una vez sin romper nada.)
-- =====================================================================

-- 1) ADMINISTRADORES: solo los usuarios de esta lista pueden editar y ver métricas
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
-- (sin políticas: nadie puede leer ni escribir esta tabla desde la web)

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 2) PRODUCTOS
create table if not exists public.productos (
  id              text primary key,
  nombre          text not null,
  categoria       text not null,
  precio          numeric(10,2) not null default 0,
  mayor_desde     int,
  mayor_precio    numeric(10,2),
  mayor_consultar int,
  cotizar         boolean not null default false,
  img             text,
  fotos           text[] not null default '{}',
  descripcion     text,
  tendencia       boolean not null default false,
  temporada       boolean not null default false,
  nuevo           boolean not null default false,
  agotado         boolean not null default false,
  activo          boolean not null default true,
  orden           int not null default 100,
  actualizado     timestamptz not null default now()
);
alter table public.productos enable row level security;

drop policy if exists "publico ve productos activos" on public.productos;
create policy "publico ve productos activos" on public.productos
  for select to anon, authenticated using (activo or public.es_admin());

drop policy if exists "admin edita productos" on public.productos;
create policy "admin edita productos" on public.productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- 3) EVENTOS (métricas): la web pública solo puede AGREGAR, nunca leer
create table if not exists public.eventos (
  id          bigserial primary key,
  tipo        text not null,
  producto_id text,
  origen      text,
  sesion      text,
  creado      timestamptz not null default now()
);
create index if not exists eventos_creado_idx on public.eventos (creado);
alter table public.eventos enable row level security;

drop policy if exists "publico registra eventos" on public.eventos;
create policy "publico registra eventos" on public.eventos
  for insert to anon, authenticated
  with check (
    tipo in ('visita','vista','fotos','carrito','whatsapp','cotizar')
    and coalesce(length(producto_id), 0) <= 80
    and coalesce(length(origen), 0) <= 60
    and coalesce(length(sesion), 0) <= 40
  );

drop policy if exists "admin lee eventos" on public.eventos;
create policy "admin lee eventos" on public.eventos
  for select to authenticated using (public.es_admin());

drop policy if exists "admin borra eventos" on public.eventos;
create policy "admin borra eventos" on public.eventos
  for delete to authenticated using (public.es_admin());

-- Resumen de métricas (dias = 0 → todo el historial)
create or replace function public.metricas(dias int default 30)
returns table (producto_id text, tipo text, origen text, total bigint)
language sql stable security invoker set search_path = public as $$
  select e.producto_id, e.tipo, coalesce(e.origen, 'directo'), count(*)
  from public.eventos e
  where dias = 0 or e.creado >= now() - make_interval(days => dias)
  group by 1, 2, 3;
$$;

-- Permisos
grant select on public.productos to anon, authenticated;
grant insert, update, delete on public.productos to authenticated;
grant insert on public.eventos to anon, authenticated;
grant select, delete on public.eventos to authenticated;
grant usage, select on sequence public.eventos_id_seq to anon, authenticated;
grant execute on function public.es_admin() to anon, authenticated;
grant execute on function public.metricas(int) to authenticated;

-- 4) FOTOS: carpeta pública "productos" (todos ven, solo admin sube/borra)
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists "admin sube fotos" on storage.objects;
create policy "admin sube fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos' and public.es_admin());

drop policy if exists "admin cambia fotos" on storage.objects;
create policy "admin cambia fotos" on storage.objects
  for update to authenticated using (bucket_id = 'productos' and public.es_admin());

drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin borra fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'productos' and public.es_admin());
