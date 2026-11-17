-- =====================================================================
-- Migración 0003 · Nuevo tipo de evento "enlace"
-- Registra clics a enlaces externos (p. ej. "Explorar MakerWorld").
-- producto_id guarda el destino: 'makerworld'.
-- =====================================================================
alter table public.eventos drop constraint if exists eventos_tipo_valido;
alter table public.eventos add  constraint eventos_tipo_valido
  check (tipo in ('visita','vista','fotos','carrito','whatsapp','cotizar','enlace'));

drop policy if exists "publico registra eventos" on public.eventos;
create policy "publico registra eventos" on public.eventos
  for insert to anon, authenticated
  with check (tipo in ('visita','vista','fotos','carrito','whatsapp','cotizar','enlace'));

comment on column public.eventos.tipo is
  'visita | vista (tarjeta en pantalla) | fotos | carrito | whatsapp (enviar/copiar pedido) | cotizar | enlace (clic a sitio externo)';
