// ============================================================
// INIT
// ============================================================
let codigosPruebas = new Set();
let pruebasData = [];

async function initApp() {
  await loadPruebas();
  // Cargar gestiones marcadas para preservarlas en memoria.
  // Paginar: Supabase devuelve máx. 1000 filas por consulta. Sin este loop,
  // con >1000 gestionadas las que sobran no se cargaban y aparecían como
  // "sin gestionar" al recargar, aunque en la base sí estuvieran marcadas.
  let fromG = 0;
  while (true) {
    const {data: gest, error} = await sb.from('gestiones')
      .select('od_id').eq('gestionada', true).range(fromG, fromG + 999);
    if (error || !gest || gest.length === 0) break;
    gest.forEach(g => gestionadasLocal.add(g.od_id));
    if (gest.length < 1000) break;
    fromG += 1000;
  }
  await loadMuestras({force:true});
  setupRealtime();
  nav('dashboard', document.querySelector('.nav-item'));
  const {count} = await sb.from('recepciones').select('*',{count:'exact',head:true}).eq('sin_ingreso',true);
  const badge = document.getElementById('badge-sin-ingreso');
  if (badge && count > 0) { badge.textContent = count; badge.style.display = 'inline'; }
}

async function loadPruebas() {
  const {data} = await sb.from('pruebas').select('*').eq('activo', true).order('nombre_corto');
  pruebasData = data || [];
  codigosPruebas = new Set(pruebasData.map(p => p.codigo));
  const cortos = [...new Set(pruebasData.map(p => p.nombre_corto))].sort();
  const chipsEl = document.getElementById('chips-prueba');
  if (chipsEl) {
    chipsEl.innerHTML = '<span class="chip-prueba active" onclick="chipPrueba(this,\'todas\')">Todas</span>' +
      cortos.map(c => '<span class="chip-prueba" onclick="chipPrueba(this,\'' + c + '\')">' + c + '</span>').join('');
  }
}

const COLS_MUESTRAS = 'od_id,o_id,nro_muestra,identificacion,apellidos,nombres,paciente,estudio_codigo,estudio_nombre,tipo_muestra,sede,fecha_ingreso,fecha_recepcion,recibido_por,estado,fecha_validacion,validado_por,gestion,gestionado_por';
const ESTADOS_ACTIVOS = ['pendiente','recibido','sin-validar','reproceso','nueva-muestra','remitida','anulado'];
let validadasCargadas = false;

async function loadMuestras({ force = false, incluirValidadas = false } = {}) {
  const ahora = Date.now();
  if (!force && allMuestras.length > 0 && (ahora - lastMuestrasLoad) < 60000) return;
  if (incluirValidadas && validadasCargadas && !force) return;

  let all = [];
  let from = 0;
  const PAGE = 1000;

  // Siempre cargar estados activos
  while (true) {
    const res = await sb.from('v_muestras')
      .select(COLS_MUESTRAS)
      .in('estado', ESTADOS_ACTIVOS)
      .order('fecha_ingreso', { ascending: false })
      .range(from, from + PAGE - 1);

    if (res.error) {
      console.error('Error cargando muestras:', res.error);
      if (all.length > 0) { toast(`Datos parciales: ${all.length} muestras.`, 'info'); break; }
      toast('Error cargando muestras: ' + res.error.message, 'err');
      return;
    }
    if (!res.data || res.data.length === 0) break;
    all = all.concat(res.data);
    if (res.data.length < PAGE) break;
    from += PAGE;
  }

  // Cargar validadas solo si se piden explícitamente
  if (incluirValidadas) {
    let fromV = 0;
    while (true) {
      const res = await sb.from('v_muestras')
        .select(COLS_MUESTRAS)
        .eq('estado', 'validado')
        .order('fecha_ingreso', { ascending: false })
        .range(fromV, fromV + PAGE - 1);
      if (res.error || !res.data || res.data.length === 0) break;
      all = all.concat(res.data);
      if (res.data.length < PAGE) break;
      fromV += PAGE;
    }
    validadasCargadas = true;
  } else if (validadasCargadas) {
    // Mantener las validadas que ya estaban en memoria
    const validadasExistentes = allMuestras.filter(m => m.estado === 'validado');
    all = all.concat(validadasExistentes);
  }

  allMuestras = all;

  // Preservar campos que viven solo en memoria local (no en v_muestras)
  // como 'gestionada' que viene de la tabla gestiones y puede no estar en la vista
  if (gestionadasLocal.size > 0) {
    allMuestras.forEach(m => {
      if (gestionadasLocal.has(m.od_id)) m.gestionada = true;
    });
  }

  lastMuestrasLoad = Date.now();
  updateBadge();
}

function updateBadge() {
  const pend = allMuestras.filter(m => m.estado === 'pendiente' && !m.gestionada).length;
  document.getElementById('badge-pend').textContent = pend;
  // Actualizar badge de sin ingreso si la sección está cargada
  const badge = document.getElementById('badge-sin-ingreso');
  if (badge && badge.style.display !== 'none') loadSinIngreso();
}

// ============================================================
// REALTIME
// ============================================================
function setupRealtime() {
  // Reemplazamos realtime (WebSocket permanente = mucho egress) por polling cada 2 minutos.
  // Solo recarga si el usuario estuvo activo en el último minuto.
  let lastActivity = Date.now();
  document.addEventListener('mousemove', () => { lastActivity = Date.now(); });
  document.addEventListener('keydown',   () => { lastActivity = Date.now(); });

  setInterval(async () => {
    // Si el usuario lleva más de 5 min inactivo, no recargar
    if (Date.now() - lastActivity > 300000) return;
    await loadMuestras({ force: true });
    if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
    if (document.getElementById('page-muestras').classList.contains('active')) applyFilters();
    if (document.getElementById('page-pendientes').classList.contains('active')) loadPendientes();
  }, 120000); // cada 2 minutos

  // Indicador visual
  const ind = document.getElementById('realtime-indicator');
  if (ind) { ind.innerHTML = '<i class="ti ti-refresh"></i> Actualización automática'; ind.style.display = 'inline-flex'; }
}

