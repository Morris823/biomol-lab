# Base de datos — Supabase

Documentación y runbook de la base de datos de BioMol Lab. El objetivo de esta
carpeta es **versionar el esquema** (tablas, la vista `v_muestras`, funciones y
políticas RLS) para que no viva solo en el historial de chat y las migraciones
futuras sean copiar-pegar, no reconstruir de memoria.

## Archivos

- `schema.sql` — esquema completo del `public` (SIN datos). **Sí se versiona.**
- `data.sql` / cualquier volcado de datos — **NUNCA se versiona** (lleva datos de
  pacientes). Está en `.gitignore`.

---

## Runbook: migrar a otro proyecto Supabase (escenario "egress/cuota")

Migración Supabase → Supabase preservando esquema, vista `v_muestras`, funciones
y políticas RLS. La app solo necesita repuntar `SUPA_URL` + `SUPA_KEY` al final.

### Requisitos
Cliente de PostgreSQL instalado (`pg_dump`, `psql`). En Mac: `brew install libpq`.
En Windows/Linux: instalar PostgreSQL client tools.
Las connection strings salen del Dashboard → *Project Settings → Database →
Connection string* (usa la **direct connection**, puerto 5432).

> ⚠️ Si el proyecto viejo ya está **bloqueado por cuota de egress**, el `pg_dump`
> (que descarga datos) puede fallar. Espera el reset mensual o sube el plan un
> día solo para migrar.

### Paso 1 — Crear el proyecto NUEVO
En supabase.com → New project. Anota su `SUPA_URL` (`https://NUEVO.supabase.co`)
y su **anon key** (Settings → API).

### Paso 2 — Esquema (estructura, vista, RLS, funciones)
```bash
# Volcar SOLO el esquema del proyecto VIEJO
pg_dump "postgresql://postgres:[PWD_VIEJO]@db.VIEJO.supabase.co:5432/postgres" \
  --schema-only --no-owner --no-privileges --schema=public \
  > supabase/schema.sql

# Aplicarlo al proyecto NUEVO
psql "postgresql://postgres:[PWD_NUEVO]@db.NUEVO.supabase.co:5432/postgres" \
  -f supabase/schema.sql
```

### Paso 3 — Datos
```bash
# Volcar SOLO los datos del VIEJO (NO se versiona — datos de pacientes)
pg_dump "postgresql://postgres:[PWD_VIEJO]@db.VIEJO.supabase.co:5432/postgres" \
  --data-only --no-owner --schema=public \
  > supabase/data.sql

# Cargarlos en el NUEVO
psql "postgresql://postgres:[PWD_NUEVO]@db.NUEVO.supabase.co:5432/postgres" \
  -f supabase/data.sql
```

### Paso 4 — Repuntar la app
Cambiar en `js/config.js` (o en las variables de entorno de Netlify al desplegar):
```js
SUPA_URL: 'https://NUEVO.supabase.co',
SUPA_KEY: '<anon key del NUEVO>',
```

### Paso 5 — Verificar (crítico)
Correr en el SQL Editor del proyecto NUEVO:
```sql
-- 1. La vista existe y devuelve filas
select count(*) from v_muestras;

-- 2. La jerarquía de estados es correcta (validado ANTES que reproceso/nueva-muestra)
--    Revisar la definición del CASE en la vista:
select pg_get_viewdef('v_muestras', true);

-- 3. v_muestras es SECURITY INVOKER (no DEFINER)
select relname, reloptions from pg_class where relname = 'v_muestras';

-- 4. RLS activo y políticas presentes en las tablas
select tablename, policyname, cmd, qual
from pg_policies where schemaname = 'public' order by tablename;

-- 5. Conteos por tabla — comparar con el proyecto VIEJO
select 'ingresos' t, count(*) from ingresos
union all select 'recepciones', count(*) from recepciones
union all select 'validaciones', count(*) from validaciones;
```

Comparar los conteos del paso 5 contra los mismos queries en el proyecto VIEJO.
Si cuadran y `v_muestras` devuelve filas con estados correctos → migración OK.

---

## Modelo de datos

Ver el `README.md` raíz del repo (sección "Modelo de datos (Supabase)") para la
descripción de cada tabla, la vista `v_muestras` y la jerarquía de estados
`anulado > validado > nueva-muestra > remitida > reproceso > sin-validar > pendiente`.
