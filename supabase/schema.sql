-- ============================================================
-- BioMol Lab — esquema de la base de datos (Supabase / PostgreSQL)
-- Generado desde la introspección del proyecto de origen.
-- Aplicar en el SQL Editor del proyecto NUEVO (pegar y Run).
-- NO contiene datos de pacientes (solo estructura).
-- ============================================================

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rol text default 'biologo_molecular'::text,
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.pruebas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre_corto text,
  nombre_largo text,
  nombre_labcore text,
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.ingresos (
  id uuid primary key default gen_random_uuid(),
  od_id text unique,
  o_id text,
  nro_muestra text,
  identificacion text,
  apellidos text,
  nombres text,
  estudio_codigo text,
  estudio_nombre text,
  tipo_muestra text,
  sede text,
  fecha_solicitud timestamptz,
  fecha_ingreso timestamptz,
  subido_por text,
  created_at timestamptz default now()
);

create table if not exists public.recepciones (
  id uuid primary key default gen_random_uuid(),
  nro_muestra text,
  fecha_recepcion timestamptz default now(),
  recibido_por text,
  sin_ingreso boolean default false,
  es_tb boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.validaciones (
  id uuid primary key default gen_random_uuid(),
  od_id text unique,
  fecha_validacion timestamptz,
  hasta_fecha timestamptz,
  importado_por text,
  created_at timestamptz default now()
);

create table if not exists public.reprocesos (
  id uuid primary key default gen_random_uuid(),
  od_id text,
  nro_muestra text,
  estudio_nombre text,
  codigo_motivo text,
  desc_motivo text,
  registrado_por text,
  fecha timestamptz default now(),
  created_at timestamptz default now(),
  estado_final text
);

create table if not exists public.nuevas_muestras (
  id uuid primary key default gen_random_uuid(),
  od_id text,
  nro_muestra text,
  estudio_nombre text,
  motivo text,
  registrado_por text,
  fecha timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.anulados (
  id uuid primary key default gen_random_uuid(),
  od_id text unique,
  motivo text,
  anulado_por text,
  fecha timestamptz default now(),
  nro_muestra text,
  motivo_anulacion text,
  registrado_por text,
  created_at timestamptz default now()
);

create table if not exists public.gestiones (
  id uuid primary key default gen_random_uuid(),
  od_id text unique,
  nro_muestra text,
  descripcion text,
  gestionado_por text,
  gestionada boolean default false,
  fecha timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.cambios_estado_manual (
  id uuid primary key default gen_random_uuid(),
  od_id text,
  estado_anterior text,
  estado_nuevo text,
  cambiado_por text,
  created_at timestamptz default now()
);

create table if not exists public.importaciones_validados (
  id uuid primary key default gen_random_uuid(),
  hasta_fecha timestamptz,
  total_filas integer,
  validadas integer,
  no_encontradas integer,
  importado_por text,
  created_at timestamptz default now(),
  total_validados integer
);

create table if not exists public.cierres_turno (
  id uuid primary key default gen_random_uuid(),
  cerrado_por text,
  fecha_cierre date,
  total_escaneadas integer,
  total_pruebas integer,
  conteo_cervix integer,
  conteo_plasma integer,
  conteo_sangre integer,
  conteo_otros integer,
  observaciones text,
  created_at timestamptz default now()
);

create table if not exists public.checklist_turno (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  items jsonb default '{}'::jsonb,
  mantenimiento_mensual_fecha date,
  validacion_gestor_desde timestamptz,
  validacion_gestor_hasta timestamptz,
  validacion_labcore_desde timestamptz,
  validacion_labcore_hasta timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  cerrado boolean default false,
  cerrado_por text,
  cerrado_fecha timestamptz,
  obs_entrega_tarde text
);

create table if not exists public.registros_descarte (
  id uuid primary key default gen_random_uuid(),
  fecha_descarte date not null,
  descarto_hasta date not null,
  observaciones text,
  registrado_por text,
  created_at timestamptz default now()
);

create table if not exists public.seguimiento_manuales (
  id uuid primary key default gen_random_uuid(),
  od_id text,
  nro_muestra text not null,
  estudio_nombre text,
  observacion text,
  estado text default 'pendiente'::text,
  gestionado_por text,
  fecha timestamptz default now(),
  revision_fecha date,
  tipo text default 'pendiente'::text,
  busqueda_hasta timestamptz,
  area text default 'manuales'::text
);

create table if not exists public.corridas_tb (
  id uuid primary key default gen_random_uuid(),
  corr_id text,
  estado text default 'abierta'::text,
  creada_por text,
  created_at timestamptz default now(),
  cerrada_por text,
  updated_at timestamptz default now()
);

create table if not exists public.matriculas (
  id uuid primary key default gen_random_uuid(),
  mat_id text,
  estado text default 'abierta'::text,
  creada_por text,
  created_at timestamptz default now(),
  cerrada_por text,
  updated_at timestamptz default now()
);

create table if not exists public.remisiones (
  id uuid primary key default gen_random_uuid(),
  codigo_remision text not null,
  estado text default 'abierta'::text,
  creada_por text,
  created_at timestamptz default now()
);

create table if not exists public.corrida_tb_posiciones (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid references corridas_tb(id),
  posicion integer,
  nro_muestra text,
  tipo_muestra text,
  paciente text,
  cedula text,
  sede text,
  od_id text,
  resultado text,
  estado_muestra text default 'sin-validar'::text,
  es_control boolean default false,
  nombre_control text,
  registrado_por text,
  created_at timestamptz default now()
);

create table if not exists public.matricula_posiciones (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid references matriculas(id),
  posicion integer,
  nro_muestra text,
  paciente text,
  estudio_nombre text,
  prueba_corta text,
  alerta_tipo text,
  es_control boolean default false,
  nombre_control text,
  registrado_por text,
  created_at timestamptz default now(),
  od_id text,
  estado_muestra text default 'sin-validar'::text
);

create table if not exists public.remision_posiciones (
  id uuid primary key default gen_random_uuid(),
  remision_id uuid references remisiones(id),
  nro_muestra text not null,
  od_id text,
  estudio_nombre text,
  observacion text,
  identificacion text,
  apellidos text,
  nombres text,
  created_at timestamptz default now(),
  codigo_colcan text,
  edad integer
);

-- ============================================================
-- VISTA v_muestras — unifica el estado de cada muestra.
-- SECURITY INVOKER para que respete el RLS de las tablas base.
-- Jerarquía: anulado > validado > nueva-muestra > remitida > reproceso > sin-validar > pendiente
-- ============================================================
create or replace view public.v_muestras with (security_invoker = true) as
 SELECT i.od_id,
    i.o_id,
    i.nro_muestra,
    i.identificacion,
    i.apellidos,
    i.nombres,
    (i.apellidos || ', '::text) || i.nombres AS paciente,
    i.estudio_codigo,
    i.estudio_nombre,
    i.tipo_muestra,
    i.sede,
    i.fecha_solicitud,
    i.fecha_ingreso,
    i.subido_por,
    r.fecha_recepcion,
    r.recibido_por,
        CASE
            WHEN a.od_id IS NOT NULL THEN 'anulado'::text
            WHEN v.od_id IS NOT NULL THEN 'validado'::text
            WHEN nm.od_id IS NOT NULL THEN 'nueva-muestra'::text
            WHEN rp.nro_muestra IS NOT NULL THEN 'remitida'::text
            WHEN rep.od_id IS NOT NULL THEN 'reproceso'::text
            WHEN r.nro_muestra IS NOT NULL THEN 'sin-validar'::text
            ELSE 'pendiente'::text
        END AS estado,
    v.fecha_validacion,
    v.importado_por AS validado_por,
    rep.fecha AS fecha_reproceso,
    rep.codigo_motivo,
    rep.desc_motivo,
    g.descripcion AS gestion,
    g.gestionado_por,
    g.fecha AS fecha_gestion
   FROM ingresos i
     LEFT JOIN LATERAL ( SELECT recepciones.nro_muestra,
            recepciones.fecha_recepcion,
            recepciones.recibido_por
           FROM recepciones
          WHERE recepciones.nro_muestra = i.nro_muestra
          ORDER BY recepciones.fecha_recepcion DESC
         LIMIT 1) r ON true
     LEFT JOIN validaciones v ON v.od_id = i.od_id
     LEFT JOIN reprocesos rep ON rep.od_id = i.od_id
     LEFT JOIN nuevas_muestras nm ON nm.od_id = i.od_id
     LEFT JOIN anulados a ON a.od_id = i.od_id
     LEFT JOIN gestiones g ON g.od_id = i.od_id
     LEFT JOIN remision_posiciones rp ON rp.nro_muestra = i.nro_muestra;

-- ============================================================
-- RLS — reproduce el estado ACTUAL (acceso abierto vía anon key).
-- OJO: 'using (true)' se endurecerá al implementar auth + RLS por usuario.
-- ============================================================
alter table public.usuarios enable row level security;
drop policy if exists acceso_app on public.usuarios;
create policy acceso_app on public.usuarios for all to public using (true);
alter table public.pruebas enable row level security;
drop policy if exists acceso_app on public.pruebas;
create policy acceso_app on public.pruebas for all to public using (true);
alter table public.ingresos enable row level security;
drop policy if exists acceso_app on public.ingresos;
create policy acceso_app on public.ingresos for all to public using (true);
alter table public.recepciones enable row level security;
drop policy if exists acceso_app on public.recepciones;
create policy acceso_app on public.recepciones for all to public using (true);
alter table public.validaciones enable row level security;
drop policy if exists acceso_app on public.validaciones;
create policy acceso_app on public.validaciones for all to public using (true);
alter table public.reprocesos enable row level security;
drop policy if exists acceso_app on public.reprocesos;
create policy acceso_app on public.reprocesos for all to public using (true);
alter table public.nuevas_muestras enable row level security;
drop policy if exists acceso_app on public.nuevas_muestras;
create policy acceso_app on public.nuevas_muestras for all to public using (true);
alter table public.anulados enable row level security;
drop policy if exists acceso_app on public.anulados;
create policy acceso_app on public.anulados for all to public using (true);
alter table public.gestiones enable row level security;
drop policy if exists acceso_app on public.gestiones;
create policy acceso_app on public.gestiones for all to public using (true);
alter table public.cambios_estado_manual enable row level security;
drop policy if exists acceso_app on public.cambios_estado_manual;
create policy acceso_app on public.cambios_estado_manual for all to public using (true);
alter table public.importaciones_validados enable row level security;
drop policy if exists acceso_app on public.importaciones_validados;
create policy acceso_app on public.importaciones_validados for all to public using (true);
alter table public.cierres_turno enable row level security;
drop policy if exists acceso_app on public.cierres_turno;
create policy acceso_app on public.cierres_turno for all to public using (true);
alter table public.checklist_turno enable row level security;
drop policy if exists acceso_app on public.checklist_turno;
create policy acceso_app on public.checklist_turno for all to public using (true);
alter table public.registros_descarte enable row level security;
drop policy if exists acceso_app on public.registros_descarte;
create policy acceso_app on public.registros_descarte for all to public using (true);
alter table public.seguimiento_manuales enable row level security;
drop policy if exists acceso_app on public.seguimiento_manuales;
create policy acceso_app on public.seguimiento_manuales for all to public using (true);
alter table public.corridas_tb enable row level security;
drop policy if exists acceso_app on public.corridas_tb;
create policy acceso_app on public.corridas_tb for all to public using (true);
alter table public.matriculas enable row level security;
drop policy if exists acceso_app on public.matriculas;
create policy acceso_app on public.matriculas for all to public using (true);
alter table public.remisiones enable row level security;
drop policy if exists acceso_app on public.remisiones;
create policy acceso_app on public.remisiones for all to public using (true);
alter table public.corrida_tb_posiciones enable row level security;
drop policy if exists acceso_app on public.corrida_tb_posiciones;
create policy acceso_app on public.corrida_tb_posiciones for all to public using (true);
alter table public.matricula_posiciones enable row level security;
drop policy if exists acceso_app on public.matricula_posiciones;
create policy acceso_app on public.matricula_posiciones for all to public using (true);
alter table public.remision_posiciones enable row level security;
drop policy if exists acceso_app on public.remision_posiciones;
create policy acceso_app on public.remision_posiciones for all to public using (true);

-- Permisos para los roles de Supabase (igual que el proyecto actual)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant select on public.v_muestras to anon, authenticated, service_role;

-- ============================================================
-- ÍNDICES — críticos para el rendimiento de v_muestras y de la app.
-- Sin ellos, v_muestras hace seq-scans y el SQL Editor da timeout.
-- (Las columnas UNIQUE y PK ya vienen indexadas; aquí van las demás.)
-- ============================================================
-- Join lateral de v_muestras: recepciones más reciente por nro_muestra
create index if not exists idx_recepciones_nro_fecha on public.recepciones (nro_muestra, fecha_recepcion desc);
create index if not exists idx_recepciones_fecha on public.recepciones (fecha_recepcion);
-- Joins de v_muestras por od_id / nro_muestra
create index if not exists idx_ingresos_nro_muestra on public.ingresos (nro_muestra);
create index if not exists idx_reprocesos_od_id on public.reprocesos (od_id);
create index if not exists idx_nuevas_muestras_od_id on public.nuevas_muestras (od_id);
create index if not exists idx_remision_posiciones_nro_muestra on public.remision_posiciones (nro_muestra);
-- Lookups por tabla padre (posiciones)
create index if not exists idx_matricula_posiciones_matricula_id on public.matricula_posiciones (matricula_id);
create index if not exists idx_corrida_tb_posiciones_corrida_id on public.corrida_tb_posiciones (corrida_id);
create index if not exists idx_remision_posiciones_remision_id on public.remision_posiciones (remision_id);
-- Lookups por nro_muestra en posiciones (cargarEnMatriculaGlobal / TB / seguimiento)
create index if not exists idx_matricula_posiciones_nro on public.matricula_posiciones (nro_muestra);
create index if not exists idx_corrida_tb_posiciones_nro on public.corrida_tb_posiciones (nro_muestra);
create index if not exists idx_seguimiento_manuales_nro on public.seguimiento_manuales (nro_muestra);
