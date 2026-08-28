-- ============================================================
-- AUTH + RLS — endurecer el acceso (usuario + PIN sobre Supabase Auth)
-- Aplicar en el proyecto NUEVO. Ejecutar los pasos EN ORDEN.
-- ============================================================

-- PASO 1 — columna email en usuarios (mapea usuario -> cuenta de Auth)
alter table public.usuarios add column if not exists email text;

-- PASO 2 — crear las cuentas en Authentication (panel de Supabase):
--   Authentication -> Users -> Add user -> "Auto Confirm User" activado
--   Email: <nombre>@biomol.local   Password: el PIN (mínimo 6 dígitos)
-- Luego enlazar cada usuario con su correo (ajusta nombres/correos):
--   update public.usuarios set email='mateo@biomol.local'    where nombre='Mateo';
--   update public.usuarios set email='didier@biomol.local'   where nombre='Didier';
--   ... (uno por cada usuario)
-- Verifica que no quede ninguno sin correo:
--   select nombre from public.usuarios where activo and (email is null or email='');

-- PASO 3 — RLS: 'usuarios' legible por anon (para el selector de login);
--          todo lo demás SOLO con sesión iniciada (authenticated).

-- usuarios: lectura anon (selector) + gestión con sesión
drop policy if exists acceso_app on public.usuarios;
drop policy if exists usuarios_select_anon on public.usuarios;
drop policy if exists usuarios_all_auth on public.usuarios;
create policy usuarios_select_anon on public.usuarios for select to anon using (true);
create policy usuarios_all_auth on public.usuarios for all to authenticated using (true) with check (true);

-- Resto de tablas: solo authenticated
drop policy if exists acceso_app on public.pruebas;
create policy acceso_app on public.pruebas for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.ingresos;
create policy acceso_app on public.ingresos for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.recepciones;
create policy acceso_app on public.recepciones for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.validaciones;
create policy acceso_app on public.validaciones for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.reprocesos;
create policy acceso_app on public.reprocesos for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.nuevas_muestras;
create policy acceso_app on public.nuevas_muestras for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.anulados;
create policy acceso_app on public.anulados for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.gestiones;
create policy acceso_app on public.gestiones for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.cambios_estado_manual;
create policy acceso_app on public.cambios_estado_manual for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.importaciones_validados;
create policy acceso_app on public.importaciones_validados for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.cierres_turno;
create policy acceso_app on public.cierres_turno for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.checklist_turno;
create policy acceso_app on public.checklist_turno for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.registros_descarte;
create policy acceso_app on public.registros_descarte for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.seguimiento_manuales;
create policy acceso_app on public.seguimiento_manuales for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.corridas_tb;
create policy acceso_app on public.corridas_tb for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.matriculas;
create policy acceso_app on public.matriculas for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.remisiones;
create policy acceso_app on public.remisiones for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.corrida_tb_posiciones;
create policy acceso_app on public.corrida_tb_posiciones for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.matricula_posiciones;
create policy acceso_app on public.matricula_posiciones for all to authenticated using (true) with check (true);
drop policy if exists acceso_app on public.remision_posiciones;
create policy acceso_app on public.remision_posiciones for all to authenticated using (true) with check (true);

-- NOTA: v_muestras es SECURITY INVOKER, así que al consultarla un usuario
-- autenticado se aplican estas políticas sobre las tablas base. Un anónimo
-- (sin login) no verá filas de datos: solo puede leer 'usuarios' para el selector.
