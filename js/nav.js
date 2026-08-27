// ============================================================
// NAVEGACIÓN
// ============================================================
const PAGE_TITLES = {
  dashboard:'Dashboard', ingresos:'Importar ingresos', recepcion:'Recepción de muestras',
  cierre:'Cierre de turno', validacion:'Importar validados', reprocesos:'Reprocesos',
  pendientes:'Pendientes y gestionadas', 'sin-ingreso':'Recibidas sin ingreso', anulados:'Anulados',
  muestras:'Todas las muestras', matriculas:'Pruebas manuales — Matrículas',
  tuberculosis:'Tuberculosis — Corridas', correo:'Generar correo',
  'revision-manuales':'Revisión de pendientes — Manuales', 'revision-tb':'Revisión de pendientes — TB',
  checklist:'Cierre de turno — Bacteriólogos', descarte:'Descarte de muestras',
  remisiones:'Remisiones'
};

function nav(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el && el.classList && el.classList.contains('nav-item')) el.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[name] || name;
  closeD();
  if (name === 'dashboard') initDashboard();
  if (name === 'muestras') applyFilters(false);
  if (name === 'pendientes') loadPendientes();
  if (name === 'reprocesos') loadReprocesos();
  if (name === 'validacion') loadValHist();
  if (name === 'sin-ingreso') loadSinIngreso();
  if (name === 'anulados') loadAnulados();
  if (name === 'matriculas') initMatriculas();
  if (name === 'tuberculosis') initTB();
  if (name === 'recepcion') loadRecepciones();
  if (name === 'correo') initCorreo();
  if (name === 'revision-manuales') cargarSeguimiento('manuales');
  if (name === 'revision-tb') cargarSeguimiento('tb');
  if (name === 'checklist') initChecklist();
  if (name === 'descarte') initDescarte();
  if (name === 'estadistica') initEstadistica();
  if (name === 'cierre') initCierre();
  if (name === 'remisiones') initRemisiones();
}

