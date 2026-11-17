-- =====================================================================
-- Migración 0004 · Reordenar productos en una sola operación
-- El panel envía la lista completa de IDs en el orden deseado
-- (arrastrar y soltar) y se asigna orden = posición × 10.
-- =====================================================================
create or replace function public.reordenar_productos(ids text[])
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not (select public.es_admin()) then
    raise exception 'solo administradores' using errcode = '42501';
  end if;
  if ids is null or cardinality(ids) = 0 then
    return;
  end if;
  update public.productos p
  set orden = o.n * 10
  from unnest(ids) with ordinality as o(id, n)
  where p.id = o.id
    and p.orden is distinct from (o.n * 10)::int;   -- solo toca las filas que cambian
end;
$$;

comment on function public.reordenar_productos(text[]) is
  'Asigna orden = posición × 10 según el arreglo de IDs (arrastrar y soltar del panel). Solo admin.';

revoke all on function public.reordenar_productos(text[]) from public, anon;
grant execute on function public.reordenar_productos(text[]) to authenticated;
