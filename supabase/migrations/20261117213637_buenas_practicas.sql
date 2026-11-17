-- =====================================================================
-- Migración 0002 · Buenas prácticas (seguridad, rendimiento, integridad)
-- Corrige los avisos del Security/Performance Advisor de Supabase y
-- agrega validaciones, auditoría de cambios y documentación en la BD.
-- Es idempotente: se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ADMINS: sin SECURITY DEFINER. Cada usuario solo puede ver SU fila,
--    así es_admin() funciona como SECURITY INVOKER (advisor 0028/0029).
-- ---------------------------------------------------------------------
alter table public.admins add column if not exists creado timestamptz not null default now();
comment on table  public.admins is 'Usuarios (auth.users) con permiso de administrar el catálogo y ver métricas.';
comment on column public.admins.user_id is 'FK a auth.users.id. Borrar el usuario lo quita de aquí (cascade).';

drop policy if exists "admin ve su propio registro" on public.admins;
create policy "admin ve su propio registro" on public.admins
  for select to anon, authenticated
  using (user_id = (select auth.uid()));

revoke all on public.admins from anon, authenticated;
grant select on public.admins to anon, authenticated;   -- RLS limita a la propia fila (anon: ninguna)

create or replace function public.es_admin()
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
comment on function public.es_admin() is 'true si el usuario autenticado está en public.admins. SECURITY INVOKER: respeta RLS.';
revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) PRODUCTOS: integridad, auditoría y políticas sin solapamiento
-- ---------------------------------------------------------------------
alter table public.productos drop constraint if exists productos_id_formato;
alter table public.productos add  constraint productos_id_formato        check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 80);
alter table public.productos drop constraint if exists productos_categoria_formato;
alter table public.productos add  constraint productos_categoria_formato check (categoria ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.productos drop constraint if exists productos_nombre_no_vacio;
alter table public.productos add  constraint productos_nombre_no_vacio   check (length(btrim(nombre)) between 1 and 160);
alter table public.productos drop constraint if exists productos_precio_valido;
alter table public.productos add  constraint productos_precio_valido     check (precio >= 0);
alter table public.productos drop constraint if exists productos_mayor_completo;
alter table public.productos add  constraint productos_mayor_completo    check (
  (mayor_desde is null and mayor_precio is null)
  or (mayor_desde >= 2 and mayor_precio >= 0)
);
alter table public.productos drop constraint if exists productos_mayor_consultar_valido;
alter table public.productos add  constraint productos_mayor_consultar_valido check (mayor_consultar is null or mayor_consultar >= 2);
alter table public.productos drop constraint if exists productos_descripcion_largo;
alter table public.productos add  constraint productos_descripcion_largo check (descripcion is null or length(descripcion) <= 1000);
alter table public.productos drop constraint if exists productos_fotos_max;
alter table public.productos add  constraint productos_fotos_max         check (cardinality(fotos) <= 12);

-- Fecha de actualización automática (no depende del cliente)
create or replace function public.tocar_actualizado()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.actualizado := now();
  return new;
end;
$$;
revoke all on function public.tocar_actualizado() from public, anon, authenticated;
drop trigger if exists productos_actualizado on public.productos;
create trigger productos_actualizado before update on public.productos
  for each row execute function public.tocar_actualizado();

-- Índice para el listado público (solo productos activos, en orden)
create index if not exists productos_activos_orden_idx on public.productos (orden, nombre) where activo;

-- Políticas: UNA por rol y acción (advisor 0006 multiple_permissive_policies)
drop policy if exists "publico ve productos activos" on public.productos;
drop policy if exists "admin edita productos"        on public.productos;
drop policy if exists "leer productos"               on public.productos;
drop policy if exists "admin crea productos"         on public.productos;
drop policy if exists "admin actualiza productos"    on public.productos;
drop policy if exists "admin borra productos"        on public.productos;

create policy "leer productos" on public.productos
  for select to anon, authenticated
  using (activo or (select public.es_admin()));
create policy "admin crea productos" on public.productos
  for insert to authenticated with check ((select public.es_admin()));
create policy "admin actualiza productos" on public.productos
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "admin borra productos" on public.productos
  for delete to authenticated using ((select public.es_admin()));

comment on table  public.productos is 'Catálogo de la tienda. La web pública solo ve filas con activo = true.';
comment on column public.productos.id              is 'Slug único (minúsculas, números y guiones). Se usa en links: ?p=<id>.';
comment on column public.productos.categoria       is 'Slug de categoría; la lista visible está en js/productos.js (CATEGORIAS).';
comment on column public.productos.precio          is 'Precio unitario en soles, SIN IGV.';
comment on column public.productos.mayor_desde     is 'Precio por mayor automático: cantidad mínima (va junto con mayor_precio).';
comment on column public.productos.mayor_precio    is 'Precio por mayor automático en soles, sin IGV.';
comment on column public.productos.mayor_consultar is 'Precio especial “a consultar” desde esta cantidad (sin precio fijo).';
comment on column public.productos.cotizar         is 'Muestra el botón “Cotizar tamaño o cantidad”.';
comment on column public.productos.img             is 'Foto principal: ruta relativa del repo (img/...) o URL pública de Storage.';
comment on column public.productos.fotos           is 'Fotos adicionales de la galería (máx. 12).';
comment on column public.productos.activo          is 'false = oculto en la web (no se borra).';
comment on column public.productos.orden           is 'Menor número = aparece primero.';
comment on column public.productos.actualizado     is 'Se actualiza solo con un trigger en cada UPDATE.';

-- ---------------------------------------------------------------------
-- 3) EVENTOS (métricas): restricción en la tabla + índices escalables
-- ---------------------------------------------------------------------
alter table public.eventos drop constraint if exists eventos_tipo_valido;
alter table public.eventos add  constraint eventos_tipo_valido check (tipo in ('visita','vista','fotos','carrito','whatsapp','cotizar'));
alter table public.eventos drop constraint if exists eventos_largos_validos;
alter table public.eventos add  constraint eventos_largos_validos check (
  coalesce(length(producto_id), 0) <= 80 and coalesce(length(origen), 0) <= 60 and coalesce(length(sesion), 0) <= 40
);

-- BRIN: ideal para tablas que solo crecen ordenadas por fecha (mínimo espacio)
drop index if exists public.eventos_creado_idx;
create index if not exists eventos_creado_brin on public.eventos using brin (creado);
create index if not exists eventos_producto_idx on public.eventos (producto_id, creado) where producto_id is not null;

drop policy if exists "publico registra eventos" on public.eventos;
drop policy if exists "admin lee eventos"        on public.eventos;
drop policy if exists "admin borra eventos"      on public.eventos;
create policy "publico registra eventos" on public.eventos
  for insert to anon, authenticated
  with check (tipo in ('visita','vista','fotos','carrito','whatsapp','cotizar'));   -- + constraints de la tabla
create policy "admin lee eventos" on public.eventos
  for select to authenticated using ((select public.es_admin()));
create policy "admin borra eventos" on public.eventos
  for delete to authenticated using ((select public.es_admin()));

comment on table  public.eventos is 'Métricas anónimas (sin datos personales). Solo INSERT público; lectura solo admin.';
comment on column public.eventos.tipo        is 'visita | vista (tarjeta en pantalla) | fotos | carrito | whatsapp (enviar/copiar pedido) | cotizar';
comment on column public.eventos.producto_id is 'Sin FK a propósito: conserva el historial aunque el producto se borre. También: por-mayor, personalizado.';
comment on column public.eventos.origen      is 'Parámetro ?src= del link o red social de referencia (facebook, instagram, tiktok, directo...).';
comment on column public.eventos.sesion      is 'Id aleatorio por pestaña del navegador (no identifica a la persona).';

-- Función de reporte: solo admins (RLS de eventos) y nunca anon
create or replace function public.metricas(dias int default 30)
returns table (producto_id text, tipo text, origen text, total bigint)
language sql stable security invoker set search_path = '' as $$
  select e.producto_id, e.tipo, coalesce(e.origen, 'directo'), count(*)
  from public.eventos e
  where dias = 0 or e.creado >= now() - make_interval(days => dias)
  group by 1, 2, 3;
$$;
comment on function public.metricas(int) is 'Resumen de eventos por producto/tipo/origen. dias = 0 → todo el historial.';
revoke all on function public.metricas(int) from public, anon;
grant execute on function public.metricas(int) to authenticated;

-- Limpieza opcional de historial antiguo (ejecutar a mano si la BD crece)
create or replace function public.purgar_eventos(meses int default 12)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare n bigint;
begin
  if not (select public.es_admin()) then raise exception 'solo administradores'; end if;
  delete from public.eventos where creado < now() - make_interval(months => meses);
  get diagnostics n = row_count;
  return n;
end;
$$;
comment on function public.purgar_eventos(int) is 'Borra eventos más antiguos que N meses. Solo admin.';
revoke all on function public.purgar_eventos(int) from public, anon;
grant execute on function public.purgar_eventos(int) to authenticated;

-- ---------------------------------------------------------------------
-- 4) STORAGE: solo imágenes, máx. 5 MB por archivo
-- ---------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
where id = 'productos';

drop policy if exists "admin sube fotos"   on storage.objects;
drop policy if exists "admin cambia fotos" on storage.objects;
drop policy if exists "admin borra fotos"  on storage.objects;
create policy "admin sube fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos' and (select public.es_admin()));
create policy "admin cambia fotos" on storage.objects
  for update to authenticated using (bucket_id = 'productos' and (select public.es_admin()));
create policy "admin borra fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'productos' and (select public.es_admin()));
