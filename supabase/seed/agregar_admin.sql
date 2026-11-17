-- =====================================================================
-- Dar permiso de administrador a un usuario EXISTENTE.
-- 1) Crea el usuario en Supabase → Authentication → Users → Add user
-- 2) Reemplaza el correo de abajo y ejecuta en SQL Editor.
-- (Para quitar el permiso: delete from public.admins where user_id = ...)
-- =====================================================================
insert into public.admins (user_id)
select id from auth.users where email = 'CORREO_DEL_ADMIN@ejemplo.com'
on conflict do nothing;

-- Comprobación: lista de administradores actuales
select u.email, a.creado
from public.admins a
join auth.users u on u.id = a.user_id;
