# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Fechas en AAAA-MM-DD.

## [1.4.0] - 2026-11-17
### Agregado
- Panel: ordenar productos arrastrando (mouse y mantener-presionado en celular) y botón ⤒ primer lugar.
- Panel: filtros por estado y etiquetas (combinables), contador y “Limpiar filtros”.
- Migración `reordenar_productos` (función solo admin).
### Cambiado
- Productos nuevos se crean en primer lugar; miniaturas rotas muestran 📦.
- Marca de agua: miniatura arriba a la derecha en tarjetas; sobre la foto en galería y zoom.
### Seguridad
- Contraseñas: mínimo 10 caracteres con minúscula, mayúscula y número.

## [1.3.0] - 2026-11-17
### Agregado
- Sección “Explora modelos” con MakerWorld (casi 3 millones de modelos) y cotización por WhatsApp.
- Logo flotante (marca de agua) sobre fotos en tarjetas, galería y zoom.
- Panel: ID visible y editable (con validación y aviso), marca de agua incrustada al subir fotos, métricas de MakerWorld.
- Migración `evento_enlace` (nuevo tipo de evento).

## [1.2.0] - 2026-11-17
### Agregado
- Panel de administrador (`admin.html`) con login Supabase: productos, fotos, etiquetas, métricas y links por publicación.
- Base de datos Supabase con migraciones versionadas (`supabase/migrations/`), RLS y bucket de fotos.
- Métricas anónimas: visitas, vistas, fotos, carrito, clics a WhatsApp y cotizar, por producto y por origen (`?src=`).
- Link directo a producto `?p=<id>`.
- Galería: flechas circulares, foto ampliada a pantalla completa, deslizar y teclado.
- Producto: Papa León XIV (Mini).
- Documentación: README, `docs/BASE-DE-DATOS.md`, `docs/OPERACION.md`.
### Cambiado
- El catálogo se lee de Supabase; `js/productos.js` queda como respaldo.
- Productos de ejemplo ocultos (no eliminados).
### Seguridad
- Security Advisor en 0 avisos; registro público desactivado.

## [1.1.0] - 2026-11-16
### Agregado
- Porta papel toalla navideños (Papá Noel y Galleta), Misterio Nacimiento 3D con galería.
- Factura con IGV 18 %, sección de ventas por mayor, aviso de tiempo de preparación.
### Cambiado
- Tema oscuro: fondo negro, botones verdes, botón de WhatsApp rosado.

## [1.0.0] - 2026-11-16
### Agregado
- Tienda estática en GitHub Pages: catálogo por categorías, tendencias, carrito sin cuenta,
  pedido por WhatsApp / copiar mensaje, adelanto 50 %, Yape / transferencia, entregas semanales.
