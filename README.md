# Insertos 3D · Tienda web

> **Tus Accesorios en 3D** — catálogo con carrito sin registro, pedidos por WhatsApp,
> panel de administrador y métricas por producto y por publicación.

- **Web pública:** https://insertos3d.com
- **Panel de administrador:** https://insertos3d.com/admin.html
- **Hosting:** GitHub Pages (estático, gratis) · **Datos:** Supabase (Postgres + Auth + Storage)

---

## Arquitectura

```
 Cliente (celular/PC)                         Administrador
        │                                           │
        ▼                                           ▼
 index.html + js/app.js                      admin.html + js/admin.js
   │  lee productos activos                    │  login (Supabase Auth)
   │  registra eventos (métricas)              │  CRUD productos, fotos, métricas
   ▼                                           ▼
 ┌──────────────────── Supabase (proyecto insertos3d) ────────────────────┐
 │  public.productos   public.eventos   public.admins   storage:productos │
 │  Row Level Security en todas las tablas · migraciones versionadas      │
 └────────────────────────────────────────────────────────────────────────┘
        │ si Supabase no responde (4 s)
        ▼
 js/productos.js  → catálogo de respaldo (PRODUCTOS) + configuración (CONFIG)
```

- La web **no tiene servidor propio**: es HTML/CSS/JS estático servido por GitHub Pages.
- La seguridad está en la **base de datos** (RLS), no en el navegador. La llave en
  `js/productos.js` es la *publishable key* (pública por diseño).
- El pedido se arma en el navegador y se envía como texto a WhatsApp (`wa.me`).

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `index.html` | Tienda pública |
| `admin.html` | Panel de administrador (no indexado por buscadores) |
| `css/estilos.css` | Estilos y paleta (tokens en `:root`) |
| `js/productos.js` | **Configuración** (WhatsApp, distritos, Supabase) + categorías + catálogo de respaldo |
| `js/app.js` | Lógica de la tienda: catálogo, carrito, WhatsApp, galería, métricas |
| `js/admin.js` | Lógica del panel |
| `img/marca/` | Logo y favicon |
| `img/productos/<categoría>/` | Fotos versionadas en el repo (las nuevas se suben a Supabase Storage desde el panel) |
| `supabase/migrations/` | Esquema de base de datos versionado (`<versión>_<nombre>.sql`) |
| `supabase/seed/` | Scripts manuales (p. ej. agregar un administrador) |
| `docs/` | Documentación técnica y de operación |
| `scripts/catalogo_meta.py` | Genera el catálogo de Meta desde Supabase |
| `catalogo/` | Catálogo para Facebook/Instagram (generado automáticamente, no editar a mano) |
| `.github/workflows/` | Tareas automáticas (catálogo de Meta cada 6 h) |

## Documentación

- [docs/BASE-DE-DATOS.md](docs/BASE-DE-DATOS.md) — esquema, seguridad (RLS), migraciones, escalabilidad y respaldos.
- [docs/OPERACION.md](docs/OPERACION.md) — uso diario del panel, administradores, mantenimiento.
- [CHANGELOG.md](CHANGELOG.md) — historial de cambios.

## Despliegue

Cada `git push` a `main` publica automáticamente en GitHub Pages (≈1 min).
Para cambios de base de datos ver *Flujo de migraciones* en [docs/BASE-DE-DATOS.md](docs/BASE-DE-DATOS.md).

## Convenciones

- **Idioma:** español en UI, código de negocio, tablas y columnas (`productos`, `precio`, `activo`).
- **Identificadores:** `snake_case` en la base de datos; `camelCase` en JavaScript.
- **IDs de producto:** slug en minúsculas con guiones (`portapapel-galleta`); se usan en links `?p=<id>`.
- **Precios:** en soles, **sin IGV** (el 18 % se suma solo si el cliente pide factura).
- **Fotos:** máx. 1200 px, WebP/JPG < 200 KB; el panel las optimiza automáticamente.
- **Commits:** mensaje en español, en imperativo (“Agrega…”, “Corrige…”).

## Secretos — nunca en el repositorio

| Valor | ¿Público? |
|---|---|
| Project URL y *publishable key* | ✅ Sí (están en `js/productos.js`) |
| *Secret key* / *service_role* | ⛔ No |
| Contraseña de la base de datos | ⛔ No |
| Contraseña del panel | ⛔ No |
| Tokens de acceso personal (`sbp_…`) | ⛔ No (crear con vencimiento y revocar al terminar) |
