# Operación diaria

## Entrar al panel
https://insertos3d.github.io/admin.html → correo y contraseña del administrador.

## Productos
| Quiero… | Cómo |
|---|---|
| Ocultar / mostrar un producto | Toca **Visible** (no se borra, solo se oculta) |
| Marcar Tendencia, Temporada, Nuevo, Agotado | Un toque en la etiqueta |
| Cambiar precio, descripción, precio por mayor | **Editar** → Guardar |
| Cambiar fotos | **Editar** → 📷 Subir fotos · ★ = foto principal · ✕ = quitar |
| Crear producto | **+ Nuevo producto** |
| Cambiar el orden | **Editar** → *Orden* (menor = primero) |
| Borrar definitivamente | **Editar** → Eliminar (preferir ocultar) |

Precios **sin IGV**. Precio por mayor: llenar *desde* y *precio* juntos, o usar *Precio especial desde* (a consultar).

## Métricas
- 👁 **Vistas**: la tarjeta del producto apareció en pantalla (1 vez por visita).
- 📷 **Fotos**: abrieron la galería.
- 🛒 **Carrito**: lo agregaron.
- 💬 **Pedido / Cotizar**: clic en *Enviar pedido por WhatsApp*, *Copiar mensaje* o *Cotizar*.
  WhatsApp no confirma si el mensaje se envió: compáralo con tus chats.
- **% interés** = (Pedido + Cotizar) ÷ Vistas.
- **Origen**: el `?src=` del link o la red social de donde llegaron.

## Links para publicaciones
Pestaña **Links** → nombre de la publicación (`red-tipo-producto`, ej. `ig-reel-galleta`) → destino → Copiar.
Usa un link distinto por publicación o anuncio para comparar resultados en *Métricas → Por origen*.

## Administradores
**Agregar uno:**
1. Supabase → Authentication → Users → **Add user** (correo + contraseña, ✅ Auto Confirm User).
2. SQL Editor → pegar `supabase/seed/agregar_admin.sql` con su correo → Run.

**Quitar uno:** Authentication → Users → `···` → Delete user (se quita de `admins` automáticamente).

**Olvidé la contraseña:** Authentication → Users → `···` → *Send password recovery*.

## Mantenimiento
| Frecuencia | Tarea |
|---|---|
| Mensual | Exportar `productos` a CSV (Table Editor → Export) como respaldo |
| Mensual | Revisar *Advisors* (Security y Performance) en el dashboard |
| Si pasan 7 días sin visitas | El proyecto Free se pausa: Dashboard → *Restore project* |
| Anual | Si la BD crece: `select public.purgar_eventos(12);` en SQL Editor |
| Después de usar un token `sbp_…` | **Revocar** en supabase.com/dashboard/account/tokens |

## Configuración de la web (`js/productos.js → CONFIG`)
WhatsApp, distritos de entrega, día de entrega, redes sociales, IGV, adelanto (50 %), texto de tiempo de preparación
y conexión a Supabase. Cambios aquí requieren `git push` (se publica en ~1 min).
