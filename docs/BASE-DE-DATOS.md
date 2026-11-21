# Base de datos (Supabase)

- **Proyecto:** `insertos3d` · ref `ijqhkpbxvkwnysoepgms` · región `us-east-2` · plan Free
- **Motor:** PostgreSQL (Supabase) · API REST autogenerada (PostgREST) · Auth · Storage

## Modelo de datos

```
auth.users (Supabase Auth)
     │ 1
     │
     │ 0..1
public.admins ── user_id (PK, FK → auth.users, on delete cascade), creado

public.productos                         public.eventos (append-only)
├─ id               text PK (slug)       ├─ id           bigserial PK
├─ nombre           text                 ├─ tipo         text  (visita|vista|fotos|carrito|whatsapp|cotizar|enlace)
├─ categoria        text (slug)          ├─ producto_id  text  (sin FK, ver nota)
├─ precio           numeric(10,2) ≥ 0    ├─ origen       text  (?src= o red social)
├─ mayor_desde      int  ┐ ambos o       ├─ sesion       text  (aleatorio por pestaña)
├─ mayor_precio     num  ┘ ninguno       └─ creado       timestamptz
├─ mayor_consultar  int ≥ 2
├─ cotizar          bool                 storage.buckets: productos
├─ img              text                 └─ público, solo imágenes, máx. 5 MB
├─ fotos            text[] (≤ 12)
├─ descripcion      text (≤ 1000)
├─ tendencia | temporada | nuevo | agotado | activo   bool
├─ orden            int
└─ actualizado      timestamptz (trigger)
```

**Decisiones de diseño**

- `productos.id` es un *slug* legible (no UUID) porque se usa en links públicos (`?p=portapapel-galleta`).
- `eventos.producto_id` **no tiene FK** a propósito: el historial de métricas se conserva aunque se borre el producto,
  y admite valores generales (`por-mayor`, `personalizado`).
- Las **categorías** se validan por formato (slug) en la BD; su nombre, ícono y orden visibles viven en
  `js/productos.js → CATEGORIAS` (cambian poco y así no requieren consulta extra).
- **Sin datos personales** en `eventos`: no se guarda IP, nombre ni teléfono. `sesion` es aleatorio por pestaña.
- Los pedidos **no se guardan** en la BD: viajan como texto a WhatsApp. (Ver *Evolución* abajo.)

## Seguridad (Row Level Security)

RLS está activo en **todas** las tablas. Roles: `anon` (visitante) y `authenticated` (usuario con sesión).
`public.es_admin()` (SECURITY INVOKER) devuelve `true` si `auth.uid()` está en `public.admins`.

| Tabla | anon | authenticated (no admin) | admin |
|---|---|---|---|
| `productos` | SELECT solo `activo` | SELECT solo `activo` | SELECT, INSERT, UPDATE, DELETE |
| `eventos` | INSERT (tipo validado) | INSERT | + SELECT, DELETE |
| `admins` | — | SELECT su propia fila | SELECT su propia fila |
| `storage.objects` (bucket `productos`) | lectura pública | lectura pública | + INSERT, UPDATE, DELETE |

| Función | anon | authenticated | Uso |
|---|---|---|---|
| `es_admin()` | ✅ (devuelve false) | ✅ | Políticas RLS y verificación del panel |
| `metricas(dias)` | ⛔ | ✅ (RLS: solo admin ve filas) | Pestaña Métricas |
| `purgar_eventos(meses)` | ⛔ | ✅ (lanza error si no es admin) | Mantenimiento manual |
| `reordenar_productos(ids)` | ⛔ | ✅ (lanza error si no es admin) | Arrastrar y soltar en el panel |

Otras medidas:
- Registro público de usuarios **desactivado** (`disable_signup = true`); los admins se crean desde el dashboard.
- Intentos de inicio de sesión: Supabase limita por IP (no bloquea la cuenta). El panel añade una espera
  progresiva en el navegador tras 3 fallos (30 s, 1, 2, 4… hasta 15 min). Es un freno, no la defensa principal:
  la defensa es la contraseña fuerte + registro cerrado + RLS (y 2FA si se activa).
- La URL `/admin.html` no es secreta a propósito: ocultarla no aporta seguridad real.
- Contraseñas: mínimo 10 caracteres con minúscula, mayúscula y número. La protección contra contraseñas filtradas
  (HaveIBeenPwned) requiere plan Pro: es el único aviso del Security Advisor y es esperado en plan Free.
- Políticas con `(select auth.uid())` / `(select public.es_admin())` para que Postgres las evalúe **una vez por consulta**
  y no por fila (recomendación oficial de rendimiento RLS).
- Una sola política por rol y acción (evita `multiple_permissive_policies`).
- Funciones con `set search_path = ''` y nombres calificados (evita *search_path hijacking*).
- `EXECUTE` revocado de `PUBLIC` en todas las funciones; se concede explícitamente.
- “Automatically expose new tables” desactivado: cada tabla nueva requiere `GRANT` explícito.

**Verificación:** *Security Advisor* = 1 aviso esperado (`auth_leaked_password_protection`, solo Pro) (17/11/2026). Pruebas como `anon`: lee 4 productos visibles,
no lee `admins` ni `eventos`, no puede ejecutar `metricas()`, no puede editar productos, rechaza eventos inválidos
y rechaza registros nuevos (`signup_disabled`).

## Integridad (CHECK constraints)

| Constraint | Regla |
|---|---|
| `productos_id_formato` | slug `a-z0-9` con guiones, ≤ 80 |
| `productos_categoria_formato` | slug |
| `productos_nombre_no_vacio` | 1–160 caracteres |
| `productos_precio_valido` | `precio ≥ 0` |
| `productos_mayor_completo` | `mayor_desde ≥ 2` y `mayor_precio ≥ 0`, o ambos nulos |
| `productos_mayor_consultar_valido` | nulo o ≥ 2 |
| `productos_descripcion_largo` | ≤ 1000 |
| `productos_fotos_max` | ≤ 12 fotos |
| `eventos_tipo_valido` | tipo en la lista permitida |
| `eventos_largos_validos` | producto_id ≤ 80, origen ≤ 60, sesion ≤ 40 |

## Índices

| Índice | Tipo | Para |
|---|---|---|
| `productos_pkey` | btree | búsqueda por id |
| `productos_activos_orden_idx` | btree parcial (`where activo`) | listado público ordenado |
| `eventos_creado_brin` | **BRIN** | filtros por fecha en una tabla que solo crece (ocupa KB en vez de MB) |
| `eventos_producto_idx` | btree parcial | métricas por producto |

El *Performance Advisor* marca índices nuevos como “unused” hasta que reciben tráfico: es esperado.

## Flujo de migraciones

Todo cambio de esquema es un archivo SQL **nuevo** en `supabase/migrations/` (nunca editar uno ya aplicado):

```
supabase/migrations/<AAAAMMDDhhmmss>_<nombre_en_snake_case>.sql
```

| Versión | Nombre | Contenido |
|---|---|---|
| 20261117213624 | `esquema_inicial` | tablas, RLS, bucket de fotos |
| 20261117213637 | `buenas_practicas` | correcciones de advisors, constraints, trigger, índices, comentarios, límites de Storage |
| 20261117214336 | `evento_enlace` | nuevo tipo de evento `enlace` (clics a sitios externos, p. ej. MakerWorld) |
| 20261117220200 | `reordenar_productos` | función `reordenar_productos(ids text[])` para arrastrar y soltar (solo admin) |

Aplicar una migración (cualquiera de las dos vías; queda registrada en `supabase_migrations.schema_migrations`):
1. **Dashboard:** SQL Editor → pegar → Run (no queda registrada como migración; preferir la vía 2).
2. **Supabase CLI:** `supabase link --project-ref ijqhkpbxvkwnysoepgms` y `supabase db push`.

Las migraciones son **idempotentes** (`if not exists`, `drop … if exists`, `create or replace`).
Después de cada cambio: revisar *Advisors → Security* y *Performance* en el dashboard.

## Escalabilidad y límites (plan Free)

| Recurso | Límite Free | Uso estimado |
|---|---|---|
| Base de datos | 500 MB | 1 evento ≈ 150 B → ~3 millones de eventos |
| Storage | 1 GB | foto optimizada ≈ 100 KB → ~10 000 fotos |
| Transferencia | 5 GB/mes | catálogo ≈ 20 KB por visita |
| Usuarios Auth | 50 000 MAU | 1–3 admins |
| Inactividad | pausa tras 7 días sin actividad | la web cae al catálogo de respaldo; se reactiva desde el dashboard |

Cuándo actuar:
- **Eventos > 1 millón:** ejecutar `select public.purgar_eventos(12);` (borra lo anterior a 12 meses) o crear una tabla
  de resumen diario (`eventos_diarios`) y purgar el detalle.
- **Spam de eventos:** la tabla valida tipo y largos; si aparece abuso, mover el registro a una *Edge Function* con
  límite por IP, o activar *Attack Protection* (captcha).
- **Muchos productos (> 300):** paginar el catálogo (`range` en PostgREST) y cargar imágenes con `loading="lazy"` (ya activo).
- **Plan Pro** (US$25/mes) cuando: haya respaldos diarios obligatorios, se necesite evitar la pausa o se superen límites.

## Respaldos

El plan Free **no ofrece respaldos descargables**. Recomendado mensualmente:
- *Table Editor → productos → Export → CSV* (y guardar en `imagenes-trabajo/` o Drive).
- El catálogo de respaldo en `js/productos.js` y el esquema en `supabase/migrations/` ya están versionados en Git.

## Evolución sugerida

1. Tabla `pedidos` (+ `pedido_items`) si se quiere registrar pedidos confirmados y estados
   (pendiente → adelanto pagado → en impresión → entregado).
2. Tabla `categorias` si las categorías pasan a administrarse desde el panel.
3. Resumen diario de métricas (`eventos_diarios`) para reportes rápidos con mucho tráfico.
