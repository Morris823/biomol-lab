// ============================================================
// CHECKLIST CIERRE DE TURNO — BACTERIÓLOGOS
// ============================================================
let checklistActual = null;
let checklistSoloLectura = false;
let semanalManualesInfo = null; // {hecho, dia, por} para la semana actual

const FESTIVOS_CL = new Set([
  '2025-01-01','2025-01-06','2025-03-24','2025-04-17','2025-04-18',
  '2025-05-01','2025-06-02','2025-06-23','2025-06-30','2025-07-20',
  '2025-08-07','2025-08-18','2025-10-13','2025-11-03','2025-11-17',
  '2025-12-08','2025-12-25',
  '2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03',
  '2026-05-01','2026-05-18','2026-06-08','2026-06-15','2026-06-29',
  '2026-07-20','2026-08-07','2026-08-17','2026-10-12','2026-11-02',
  '2026-11-16','2026-12-08','2026-12-25'
]);
function esFestivoCL(fechaISO) { return FESTIVOS_CL.has(fechaISO); }

function rangoSemanaISO(fechaISO) {
  const d = new Date(fechaISO + 'T12:00:00');
  const dow = d.getDay(); // 0=dom
  const diffLunes = dow === 0 ? -6 : 1 - dow;
  const lunes = new Date(d); lunes.setDate(d.getDate() + diffLunes);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  return { inicio: lunes.toISOString().slice(0,10), fin: domingo.toISOString().slice(0,10) };
}

// Definición de ítems por bloque
function getItemsChecklist(fechaISO) {
  const d = new Date(fechaISO + 'T12:00:00');
  const dow = d.getDay();
  const festivo = esFestivoCL(fechaISO);

  // Controles VPH/VIH: se montan y se registran en Greenbelt el MISMO día en la mañana
  const diasControlVPH = festivo ? [2,4,5] : [1,3,5];
  const mostrarControlVPH = diasControlVPH.includes(dow);

  // Controles VHC/VHB/CMV: se montan L-M-V en la TARDE
  const diasControlVHC = [1,3,5];
  const mostrarControlVHC = diasControlVHC.includes(dow);

  // Se registran en Greenbelt al día hábil SIGUIENTE en la mañana
  // Lun monta -> se registra Martes. Mié monta -> se registra Jueves. Vie monta -> se registra Lunes (salta finde)
  const diasRegistroGreenbeltCMV = [2,4,1]; // martes, jueves, lunes
  const mostrarGreenbeltCMV = diasRegistroGreenbeltCMV.includes(dow);

  const mostrarSemanalEquipos = dow === 1;

  const equiposManana = [
    { key: 'mant_diario', label: 'Mantenimiento diario' },
  ];
  if (mostrarSemanalEquipos) equiposManana.push({ key: 'mant_semanal', label: 'Mantenimiento semanal' });
  equiposManana.push({ key: 'mant_mensual', label: 'Mantenimiento mensual', conFecha: true });
  if (mostrarControlVPH) {
    equiposManana.push({ key: 'control_vph_vih', label: `Controles VPH/VIH montados hoy` });
    equiposManana.push({ key: 'greenbelt_hiv_vph', label: 'Registro en Greenbelt — controles HIV/VPH montados hoy en la mañana' });
  }
  if (mostrarGreenbeltCMV) {
    equiposManana.push({ key: 'greenbelt_cmv', label: 'Registro en Greenbelt — controles CMV/VHC/VHB montados el día hábil anterior en la tarde' });
  }
  equiposManana.push({ key: 'formato_calidad', label: 'Formatos de calidad diligenciados (Teams)' });
  equiposManana.push({ key: 'formato_mantenimiento', label: 'Formatos de mantenimiento diligenciados (Teams)' });

  const equiposTarde = [];
  if (mostrarControlVHC) equiposTarde.push({ key: 'control_vhc_vhb_cmv', label: 'Controles VHC/VHB/CMV montados' });
  equiposTarde.push({ key: 'equipo_limpio_tarde', label: 'Equipo limpio al finalizar turno' });

  const validacion = [
    { key: 'val_gestor', label: 'Revisión de pendientes en el gestor', conHoras: true, prefijo: 'validacion_gestor' },
    { key: 'val_labcore', label: 'Revisión de pendientes en LabCore', conHoras: true, prefijo: 'validacion_labcore' },
    { key: 'val_listas', label: 'Cargar listas de validados' },
    { key: 'val_descarte', label: 'Notificación de descarte de muestras (aprox. cada 2 semanas — no es diario)' },
  ];

  const manuales = [
    { key: 'man_pendientes_subidos', label: 'Pendientes descargados de LabCore y subidos al gestor' },
    { key: 'man_gestion', label: 'Gestión de pendientes realizada' },
    { key: 'man_mant_equipo', label: 'Mantenimiento del equipo antes de montar' },
    { key: 'man_limpieza_cabinas', label: 'Limpieza cabina de reactivos y cabina de muestras' },
    { key: 'man_limpio', label: 'Equipo limpio al finalizar turno' },
    { key: 'man_mant_semanal', label: 'Mantenimiento semanal (una vez por semana, cualquier día)', semanal: true },
    { key: 'man_formato_calidad', label: 'Formato de calidad diligenciado' },
    { key: 'man_formato_mantenimiento', label: 'Formato de mantenimiento diligenciado' },
    { key: 'man_formato_estadistica', label: 'Formato de estadística diligenciado' },
  ];

  const tb = [
    { key: 'tb_hay_montaje', label: '¿Hay montaje de TB hoy?', esToggleMaestro: true },
    { key: 'tb_pendientes', label: 'Revisión de pendientes TB', requiereMontaje: true },
    { key: 'tb_resultados_anteriores', label: 'Revisión de resultados anteriores de pacientes a procesar', requiereMontaje: true },
    { key: 'tb_historia_clinica', label: 'Revisión de historia clínica de positivos', requiereMontaje: true },
    { key: 'tb_reporte_correo', label: 'Positivas reportadas por correo', requiereMontaje: true },
    { key: 'tb_discordancia', label: 'Si hay discordancia: contacto con Micobacdin para cultivo + comunicación con área y departamental', requiereMontaje: true },
    { key: 'tb_limpieza_cabina', label: 'Limpieza de la cabina', requiereMontaje: true },
    { key: 'tb_limpieza_bloque_seco', label: 'Limpieza del bloque seco', requiereMontaje: true },
    { key: 'tb_limpieza_microcentrifuga', label: 'Limpieza de la microcentrífuga', requiereMontaje: true },
    { key: 'tb_limpieza_cabina_reactivos_pcr', label: 'Limpieza de la cabina de reactivos y de PCR', requiereMontaje: true },
    { key: 'tb_equipos_apagados', label: 'Verificar que todos los equipos quedan limpios y apagados al final', requiereMontaje: true },
    { key: 'tb_formato_calidad', label: 'Formato de control de calidad diligenciado', requiereMontaje: true },
    { key: 'tb_formato_mantenimiento', label: 'Formato de mantenimiento diligenciado', requiereMontaje: true },
    { key: 'tb_formato_estadistica', label: 'Formato de estadística diligenciado', requiereMontaje: true },
  ];

  return { equiposManana, equiposTarde, validacion, manuales, tb };
}

function initChecklist() {
  const hoy = hoyCO();
  document.getElementById('cl-fecha').value = hoy;
  cargarChecklist(hoy);
  cargarHistorialChecklist();
}

function cambiarFechaChecklist() {
  const fecha = document.getElementById('cl-fecha').value;
  if (fecha) cargarChecklist(fecha);
}

async function cargarChecklist(fechaISO) {
  const hoy = hoyCO();
  const {data} = await sb.from('checklist_turno').select('*').eq('fecha', fechaISO).maybeSingle();
  if (data) {
    checklistActual = data;
  } else {
    const {data: nuevo, error} = await sb.from('checklist_turno').insert({ fecha: fechaISO, items: {} }).select().single();
    if (error) { toast('Error creando checklist: ' + error.message, 'err'); return; }
    checklistActual = nuevo;
  }
  // Solo lectura si no es hoy, o si el día ya se cerró manualmente
  // Solo se edita el día de hoy; cada área se bloquea por separado cuando se cierra
  checklistSoloLectura = fechaISO !== hoy;

  // Cargar info de mantenimiento semanal de manuales para esta semana
  await cargarSemanalManuales(fechaISO);
  if (fechaISO === hoy) { try { await calcularPendientesCierre(); } catch (e) { console.error(e); } }

  renderChecklist(fechaISO);
  renderBotonCerrar();
}

async function cargarSemanalManuales(fechaISO) {
  const { inicio, fin } = rangoSemanaISO(fechaISO);
  const {data} = await sb.from('checklist_turno').select('fecha,items').gte('fecha', inicio).lte('fecha', fin);
  semanalManualesInfo = null;
  (data||[]).forEach(row => {
    const it = row.items?.man_mant_semanal;
    if (it?.checked) semanalManualesInfo = { dia: row.fecha, por: it.por };
  });
}

// ============================================================
// CIERRE POR ÁREA
// ============================================================
// Cada área se cierra por separado (quien esté en ella), o una sola persona
// cierra todas con "Cerrar las que faltan". Si un área no se cierra solo queda
// marcada como "No se cerró": no bloquea nada. Al cerrar se guarda una foto de
// los pendientes de esa área y sus novedades, que salen en la Entrega de turno.
// Se guarda en checklist_turno.cierres_area (jsonb):
//   { recepcion: {por, fecha, novedades, pendientes:[[etiqueta, valor, alerta]], conteo:{fisico, sistema, tb}}, ... }
const AREAS_CIERRE = [
  { id: 'recepcion',  nombre: 'Recepción',             icono: 'ti-scan' },
  { id: 'equipos',    nombre: 'Equipos m2000',         icono: 'ti-device-desktop' },
  { id: 'manuales',   nombre: 'Pruebas manuales',      icono: 'ti-flask-2' },
  { id: 'tb',         nombre: 'Tuberculosis',          icono: 'ti-lungs' },
  { id: 'validacion', nombre: 'Validación y descarte', icono: 'ti-checkbox' },
];
let clPendientes = {};   // área -> [[etiqueta, valor, alerta]] calculados ahora
let clConteo = null;     // {sistema, tb} tubos escaneados hoy
let clScrollA = null;    // área a la que hay que bajar al abrir la página
const escCL = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cierresDe(row) {
  const c = { ...(row?.cierres_area || {}) };
  // Días cerrados antes de existir el cierre por área: todas quedan cerradas por quien cerró el día
  if (row?.cerrado && !AREAS_CIERRE.some(a => c[a.id]?.fecha))
    AREAS_CIERRE.forEach(a => { c[a.id] = { ...(c[a.id] || {}), por: row.cerrado_por, fecha: row.cerrado_fecha, legado: true }; });
  return c;
}
const areaCerrada = (row, id) => !!cierresDe(row)[id]?.fecha;
const bloqCL = id => checklistSoloLectura || areaCerrada(checklistActual, id);

async function calcularPendientesCierre() {
  const M = allMuestras || [];
  const corto = m => nombreCorto(m.estudio_nombre, m.estudio_codigo);
  const tubos = arr => new Set(arr.map(m => m.nro_muestra)).size;
  const manuales = typeof PRUEBAS_MANUALES_SANGRE !== 'undefined' ? PRUEBAS_MANUALES_SANGRE : new Set();
  const hoy = hoyCO(), desde = hoy + 'T00:00:00-05:00', hasta = hoy + 'T23:59:59-05:00';
  const head = { count: 'exact', head: true };
  const contar = async q => { try { const { count, error } = await q; return error ? 0 : (count || 0); } catch (e) { return 0; } };
  const [sinIng, recHoy, tbHoy] = await Promise.all([
    contar(sb.from('recepciones').select('id', head).eq('sin_ingreso', true)),
    contar(sb.from('recepciones').select('id', head).gte('fecha_recepcion', desde).lte('fecha_recepcion', hasta)),
    contar(sb.from('recepciones').select('id', head).gte('fecha_recepcion', desde).lte('fecha_recepcion', hasta).eq('es_tb', true)),
  ]);
  clConteo = { sistema: recHoy - tbHoy, tb: tbHoy };
  const esManual = m => manuales.has(corto(m));
  const esTBm = m => corto(m) === 'TB';
  const pend = M.filter(m => m.estado === 'pendiente' && !m.gestionada);
  const rescate = typeof muestrasRescateHemato === 'function' ? tubos(muestrasRescateHemato().filter(m => !m.gestionada)) : 0;
  const tb = typeof resumenOportunidadTB === 'function' ? resumenOportunidadTB() : { espera: [], vencidas: 0, porVencer: 0 };
  const sv = M.filter(m => m.estado === 'sin-validar');
  clPendientes = {
    recepcion:  [['Pendientes por recibir', tubos(pend) + ' tubos', false], ['Sin ingreso', sinIng, sinIng > 0], ['Por rescatar de hematología', rescate, rescate > 0]],
    equipos:    [['Reprocesos activos', M.filter(m => m.estado === 'reproceso' && !esManual(m) && !esTBm(m)).length, false], ['Sin validar', sv.filter(m => !esManual(m) && !esTBm(m)).length, false]],
    manuales:   [['Recibidas sin validar', sv.filter(esManual).length, false], ['Remitidas sin resultado', M.filter(m => m.estado === 'remitida').length, false]],
    tb:         [['Esperando resultado', tb.espera.length, false], ['Por vencer (36–48 h)', tb.porVencer, tb.porVencer > 0], ['Vencidas (más de 48 h)', tb.vencidas, tb.vencidas > 0]],
    validacion: [['Sin validar (todas)', sv.length, false], ['Reprocesos y nuevas muestras', M.filter(m => m.estado === 'reproceso' || m.estado === 'nueva-muestra').length, false]],
  };
}

const chipsPendientes = pend => (pend || []).length
  ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${pend.map(([l, v, al]) => `<span style="font-size:11px;padding:3px 9px;border-radius:10px;background:${al ? 'var(--yellow-bg)' : 'var(--bg2)'};color:${al ? 'var(--yellow)' : 'var(--text2)'}">${l}: <b>${v}</b></span>`).join('')}</div>` : '';

// Cabecera: cómo va cada área + botón para que una sola persona cierre todo
function renderBotonCerrar() {
  const el = document.getElementById('cl-boton-cerrar-wrap');
  if (!el || !checklistActual) return;
  const esHoy = checklistActual.fecha === hoyCO();
  const c = cierresDe(checklistActual);
  const faltan = AREAS_CIERRE.filter(a => !c[a.id]?.fecha);
  el.innerHTML = !esHoy ? `<span style="font-size:11px;color:var(--text3)"><i class="ti ti-eye"></i> Solo lectura</span>`
    : faltan.length ? `<button class="btn btn-yellow" onclick="cerrarTodasLasAreas()"><i class="ti ti-lock"></i> Cerrar ${faltan.length === AREAS_CIERRE.length ? 'todas las áreas' : 'las ' + faltan.length + ' que faltan'}</button>`
    : `<span class="pill s-val"><span class="dot"></span>Todas las áreas cerradas</span>`;
  document.getElementById('cl-estado-areas').innerHTML = AREAS_CIERRE.map(a => {
    const x = c[a.id], ok = !!x?.fecha;
    return `<div onclick="irACierreArea('${a.id}')" style="cursor:pointer;padding:9px 10px;border-radius:var(--radius);border:0.5px solid ${ok ? 'var(--green-border)' : (esHoy ? 'var(--border2)' : 'var(--red-border)')};background:${ok ? 'var(--green-bg)' : (esHoy ? 'var(--bg2)' : 'var(--red-bg)')}">
      <div style="font-size:11.5px;font-weight:600;display:flex;gap:5px;align-items:center;color:${ok ? 'var(--green)' : 'var(--text)'}"><i class="ti ${ok ? 'ti-lock' : a.icono}"></i> ${a.nombre}</div>
      <div style="font-size:10.5px;color:${ok ? 'var(--green)' : (esHoy ? 'var(--text3)' : 'var(--red)')};margin-top:3px">${ok ? `${escCL((x.por || '—').split(' ')[0])}${x.fecha && !x.legado ? ' · ' + fmtHora(x.fecha) : ''}` : (esHoy ? 'Sin cerrar' : 'No se cerró')}</div>
    </div>`;
  }).join('');
}

function renderConteoRecepcion(x) {
  const cerrado = !!x?.fecha;
  const sistema = cerrado && x.conteo ? x.conteo.sistema : clConteo?.sistema;
  const tb = cerrado && x.conteo ? x.conteo.tb : clConteo?.tb;
  const fisico = x?.conteo?.fisico ?? '';
  return `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;padding:10px 12px;background:var(--bg2);border-radius:var(--radius)">
    <div><div style="font-size:22px;font-weight:600;color:var(--accent)">${sistema ?? '…'}</div><div style="font-size:10px;color:var(--text2)">Tubos escaneados hoy</div></div>
    <div><div style="font-size:22px;font-weight:600;color:#993C1D">${tb ?? '…'}</div><div style="font-size:10px;color:var(--text2)">TB (no cuentan)</div></div>
    <div style="display:flex;align-items:center;gap:8px;margin-left:auto"><span style="font-size:12px">Conteo físico de tubos:</span>
      <input type="number" min="0" id="cl-conteo-fisico" value="${fisico}" ${bloqCL('recepcion') ? 'disabled' : ''} style="width:84px;text-align:center;font-size:18px;font-weight:600" oninput="mostrarCuadreCL(this.value)" /></div>
    <div id="cl-conteo-res" style="width:100%;font-size:12px">${fisico !== '' && fisico !== null ? textoCuadreCL(+fisico, sistema) : ''}</div>
  </div>`;
}
const textoCuadreCL = (f, s) => s == null || isNaN(f) ? '' : f === s
  ? `<span style="color:var(--green)"><i class="ti ti-circle-check"></i> Cuadra: ${f} físico = ${s} sistema</span>`
  : `<span style="color:var(--yellow)"><i class="ti ti-alert-triangle"></i> No cuadra: diferencia de <b>${Math.abs(f - s)}</b> tubo${Math.abs(f - s) !== 1 ? 's' : ''} ${f > s ? 'de más' : 'de menos'}</span>`;
function mostrarCuadreCL(v) { const el = document.getElementById('cl-conteo-res'); if (el) el.innerHTML = v === '' ? '' : textoCuadreCL(parseInt(v), clConteo?.sistema); }

function renderPanelArea(a, x, cuerpo) {
  const ok = !!x?.fecha, esHoy = checklistActual.fecha === hoyCO();
  const pend = ok ? (x.pendientes || []) : (esHoy ? clPendientes[a.id] : []);
  const acciones = !esHoy ? '' : ok
    ? `<span style="font-size:11px;color:var(--green)"><i class="ti ti-lock"></i> Cerrada por <b>${escCL(x.por || '—')}</b>${x.legado ? '' : ' · ' + fmtHora(x.fecha)}</span><button class="btn" style="font-size:11px;margin-left:8px" onclick="reabrirArea('${a.id}')">Reabrir</button>`
    : `<button class="btn btn-primary" style="font-size:11.5px" onclick="cerrarArea('${a.id}')"><i class="ti ti-lock"></i> Cerrar ${a.nombre}</button>`;
  const estadoPasado = esHoy ? '' : `<span style="font-size:11px;margin-left:8px;color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? 'Cerrada por ' + escCL(x.por || '—') + (x.legado ? '' : ' · ' + fmtHora(x.fecha)) : 'No se cerró'}</span>`;
  return `<div class="panel" id="cl-area-${a.id}" style="margin-bottom:14px;${ok ? 'border-color:var(--green-border)' : ''}">
    <div class="panel-header"><span class="panel-title"><i class="ti ${a.icono}"></i> ${a.nombre}</span>${estadoPasado}
      <div style="margin-left:auto;display:flex;align-items:center">${acciones}</div></div>
    <div style="padding:12px 14px">
      ${pend && pend.length ? `<div style="font-size:10.5px;font-weight:600;color:var(--text3);margin-bottom:5px">${ok ? 'PENDIENTES AL CERRAR' : 'PENDIENTES AHORA (los calcula el gestor)'}</div>${chipsPendientes(pend)}<div style="height:10px"></div>` : ''}
      ${cuerpo}
      <div style="margin-top:10px">
        <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px"><i class="ti ti-notes"></i> Novedades del área para el siguiente turno</div>
        <textarea rows="2" style="width:100%;font-size:12px;padding:6px" placeholder="Ej: quedó pendiente…, el equipo presentó…" ${bloqCL(a.id) ? 'disabled' : ''} onblur="guardarNovedadArea('${a.id}', this.value)">${escCL(x?.novedades || '')}</textarea>
      </div>
    </div>
  </div>`;
}

function renderChecklist(fechaISO) {
  const { equiposManana, equiposTarde, validacion, manuales, tb } = getItemsChecklist(fechaISO);
  const tbHay = checklistActual?.items?.tb_hay_montaje?.checked || false;
  const tbVis = tb.filter(it => it.esToggleMaestro || (it.requiereMontaje && tbHay));
  const c = cierresDe(checklistActual);
  const sub = t => `<div style="font-size:10.5px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:6px 0 0">${t}</div>`;
  const cuerpo = {
    recepcion:  renderConteoRecepcion(c.recepcion),
    equipos:    sub('Turno mañana') + renderBloqueItems(equiposManana, bloqCL('equipos')) + sub('Turno tarde') + renderBloqueItems(equiposTarde, bloqCL('equipos')),
    manuales:   renderBloqueItems(manuales, bloqCL('manuales')),
    tb:         renderBloqueItems(tbVis, bloqCL('tb')),
    validacion: renderBloqueItems(validacion, bloqCL('validacion')),
  };
  document.getElementById('cl-areas').innerHTML = AREAS_CIERRE.map(a => renderPanelArea(a, c[a.id], cuerpo[a.id])).join('');
  document.getElementById('cl-obs-general').innerHTML = renderObsEntregaTarde();
  renderBotonCerrar();
  if (clScrollA) {
    const el = document.getElementById('cl-area-' + clScrollA), cont = document.querySelector('#page-checklist > div');
    clScrollA = null;
    if (el && cont) cont.scrollTo({ top: cont.scrollTop + el.getBoundingClientRect().top - cont.getBoundingClientRect().top - 4, behavior: 'smooth' });
  }
}

// Lee el cierre más reciente de la base, aplica el cambio y lo guarda (así dos
// personas cerrando áreas distintas al mismo tiempo no se pisan)
async function guardarCierresArea(fn) {
  const { data: fresco, error: e0 } = await sb.from('checklist_turno').select('cierres_area').eq('id', checklistActual.id).maybeSingle();
  if (e0) { toast('Falta preparar la base para el cierre por áreas (correr cierre_por_area.sql): ' + e0.message, 'err'); return false; }
  const c = { ...(fresco?.cierres_area || {}) };
  fn(c);
  const todas = AREAS_CIERRE.every(a => c[a.id]?.fecha);
  const upd = { cierres_area: c, cerrado: todas, updated_at: new Date().toISOString() };
  if (todas && !checklistActual.cerrado) { upd.cerrado_por = currentUser; upd.cerrado_fecha = new Date().toISOString(); }
  const { error } = await sb.from('checklist_turno').update(upd).eq('id', checklistActual.id);
  if (error) { toast('No se pudo guardar el cierre: ' + error.message, 'err'); return false; }
  Object.assign(checklistActual, upd);
  return true;
}

async function cerrarArea(id, enLote) {
  if (checklistSoloLectura) return false;
  const a = AREAS_CIERRE.find(x => x.id === id);
  let conteo = null;
  if (id === 'recepcion') {
    const v = document.getElementById('cl-conteo-fisico')?.value;
    const fisico = v === '' || v == null ? null : parseInt(v);
    if (fisico === null && !confirm('No escribiste el conteo físico de tubos. ¿Cerrar Recepción sin conteo?')) return false;
    conteo = { fisico, sistema: clConteo?.sistema ?? null, tb: clConteo?.tb ?? null };
  } else if (!enLote && !confirm(`¿Cerrar ${a.nombre}?`)) return false;
  try { await calcularPendientesCierre(); } catch (e) { console.error(e); }
  const nov = document.querySelector(`#cl-area-${id} textarea`)?.value ?? '';
  const ok = await guardarCierresArea(c => {
    c[id] = { ...(c[id] || {}), por: currentUser, fecha: new Date().toISOString(), novedades: nov, pendientes: clPendientes[id] || [], ...(conteo ? { conteo } : {}) };
  });
  if (!ok) return false;
  // El conteo físico sigue quedando también en el historial de cierres de recepción
  if (conteo && conteo.fisico !== null) {
    const { error } = await sb.from('cierres_turno').insert({
      cerrado_por: currentUser, fecha_cierre: checklistActual.fecha,
      total_escaneadas: conteo.sistema, conteo_cervix: conteo.fisico, conteo_plasma: 0, conteo_sangre: 0, conteo_otros: 0,
      observaciones: (nov ? nov + ' | ' : '') + (conteo.fisico === conteo.sistema ? 'Conteo OK' : `No cuadra: físico=${conteo.fisico} sistema=${conteo.sistema}`),
    });
    if (error) console.error('cierres_turno:', error);
  }
  if (!enLote) { renderChecklist(checklistActual.fecha); toast(`${a.nombre} cerrada`, 'ok'); }
  return true;
}

async function cerrarTodasLasAreas() {
  const faltan = AREAS_CIERRE.filter(a => !areaCerrada(checklistActual, a.id));
  if (!faltan.length || checklistSoloLectura) return;
  if (!confirm(`Vas a cerrar a tu nombre: ${faltan.map(a => a.nombre).join(', ')}. ¿Seguir?`)) return;
  let n = 0;
  for (const a of faltan) { if (!(await cerrarArea(a.id, true))) break; n++; }
  renderChecklist(checklistActual.fecha);
  if (n) toast(`${n} área${n > 1 ? 's' : ''} cerrada${n > 1 ? 's' : ''}`, 'ok');
}

async function reabrirArea(id) {
  if (checklistSoloLectura) return;
  const a = AREAS_CIERRE.find(x => x.id === id);
  if (!confirm(`¿Reabrir ${a.nombre}? Quedará otra vez sin cerrar.`)) return;
  const ok = await guardarCierresArea(c => { c[id] = { novedades: c[id]?.novedades || '' }; });
  if (ok) { await calcularPendientesCierre().catch(() => {}); renderChecklist(checklistActual.fecha); toast(`${a.nombre} reabierta`, 'info'); }
}

async function guardarNovedadArea(id, valor) {
  if (bloqCL(id)) return;
  const actual = (checklistActual.cierres_area || {})[id]?.novedades || '';
  if (valor === actual) return;
  await guardarCierresArea(c => { c[id] = { ...(c[id] || {}), novedades: valor }; });
}

// Llevar a la persona directo al cierre de un área (botón "Cerrar turno" de recepción, plano del laboratorio)
function irACierreArea(id) {
  clScrollA = id;
  if (document.getElementById('page-checklist').classList.contains('active') && checklistActual) { renderChecklist(checklistActual.fecha); return; }
  nav('checklist', document.querySelector(".sidebar [onclick*=\"nav('checklist'\"]"));
}

function renderObsEntregaTarde() {
  const obs = checklistActual?.obs_entrega_tarde || '';
  return `<div style="padding:10px;background:var(--yellow-bg);border:0.5px solid var(--yellow-border);border-radius:var(--radius)">
    <div style="font-size:11px;font-weight:600;color:var(--yellow);margin-bottom:4px"><i class="ti ti-notes"></i> Observaciones generales para quien abra el siguiente turno</div>
    <textarea rows="2" placeholder="Algo que deba saber todo el laboratorio mañana..."
      style="width:100%;font-size:12px;padding:6px" ${checklistSoloLectura ? 'disabled' : ''}
      onblur="actualizarObsEntregaTarde(this.value)">${escCL(obs)}</textarea>
  </div>`;
}

async function actualizarObsEntregaTarde(valor) {
  await sb.from('checklist_turno').update({ obs_entrega_tarde: valor, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  checklistActual.obs_entrega_tarde = valor;
}

function renderBloqueItems(items, bloqueado = checklistSoloLectura) {
  const data = checklistActual?.items || {};
  return items.map(item => {
    const it = data[item.key] || {};
    const checked = it.checked || false;
    const por = it.por || null;
    const fechaMarcado = it.fecha_marcado || null;
    const obs = it.observacion || '';
    const disabled = bloqueado ? 'disabled' : '';

    // Ítem semanal: si ya se hizo esta semana en otro día distinto al actual, mostrar como informativo
    if (item.semanal && semanalManualesInfo && semanalManualesInfo.dia !== checklistActual.fecha) {
      return `<div style="padding:8px 0;border-bottom:0.5px solid var(--border);opacity:.7">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <i class="ti ti-circle-check" style="color:var(--green);margin-top:2px"></i>
          <div style="flex:1">
            <div style="font-size:12px;color:var(--green)">${item.label}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Ya realizado esta semana el ${fmt(semanalManualesInfo.dia)} por ${semanalManualesInfo.por}</div>
          </div>
        </div>
      </div>`;
    }

    let extraHTML = '';
    if (item.conFecha) {
      const fechaMant = checklistActual.mantenimiento_mensual_fecha || '';
      extraHTML = `
        <div style="margin-left:26px;margin-top:4px">
          <label style="font-size:10px;color:var(--text3)">Fecha en que se realizó:</label>
          <input type="date" value="${fechaMant}" style="font-size:11px;padding:2px 6px;margin-left:6px" ${disabled}
            onchange="actualizarFechaMantMensual(this.value)" />
        </div>`;
    }
    if (item.conHoras) {
      const desde = checklistActual[`${item.prefijo}_desde`] || '';
      const hasta = checklistActual[`${item.prefijo}_hasta`] || '';
      extraHTML = `
        <div style="margin-left:26px;margin-top:4px;display:flex;gap:8px;align-items:center">
          <label style="font-size:10px;color:var(--text3)">Desde:</label>
          <input type="datetime-local" value="${desde ? desde.slice(0,16) : ''}" style="font-size:11px;padding:2px 6px" ${disabled}
            onchange="actualizarHorasValidacion('${item.prefijo}','desde',this.value)" />
          <label style="font-size:10px;color:var(--text3)">Hasta:</label>
          <input type="datetime-local" value="${hasta ? hasta.slice(0,16) : ''}" style="font-size:11px;padding:2px 6px" ${disabled}
            onchange="actualizarHorasValidacion('${item.prefijo}','hasta',this.value)" />
        </div>`;
    }

    const estiloMaestro = item.esToggleMaestro ? 'font-weight:600' : '';

    return `<div style="padding:8px 0;border-bottom:0.5px solid var(--border)">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <input type="checkbox" ${checked?'checked':''} ${disabled} style="margin-top:3px;cursor:pointer"
          onchange="toggleChecklistItem('${item.key}',this.checked)" />
        <div style="flex:1">
          <div style="font-size:12px;${estiloMaestro};${checked?'color:var(--green)':'color:var(--text)'}">${item.label}</div>
          ${checked && por ? `<div style="font-size:10px;color:var(--text3);margin-top:2px"><i class="ti ti-user"></i> ${por} · ${fechaMarcado ? fmt(fechaMarcado) + ' ' + fmtHora(fechaMarcado) : ''}</div>` : ''}
          ${!item.esToggleMaestro ? `<input placeholder="Observación (opcional — útil si no aplica o no se hizo)..."
            value="${obs.replace(/"/g,'&quot;')}" ${disabled}
            style="width:100%;font-size:11px;padding:3px 6px;margin-top:4px"
            onblur="actualizarObsChecklistItem('${item.key}',this.value)" />` : ''}
          ${extraHTML}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function toggleChecklistItem(key, checked) {
  if (checklistSoloLectura) return;
  const items = { ...(checklistActual.items || {}) };
  items[key] = {
    ...(items[key]||{}),
    checked,
    por: checked ? currentUser : null,
    fecha_marcado: checked ? new Date().toISOString() : null
  };
  const {error} = await sb.from('checklist_turno').update({ items, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  checklistActual.items = items;
  if (key === 'man_mant_semanal' && checked) semanalManualesInfo = { dia: checklistActual.fecha, por: currentUser };
  renderChecklist(checklistActual.fecha);
}

async function actualizarObsChecklistItem(key, obs) {
  if (checklistSoloLectura) return;
  const items = { ...(checklistActual.items || {}) };
  items[key] = { ...(items[key]||{}), observacion: obs };
  await sb.from('checklist_turno').update({ items, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  checklistActual.items = items;
}

async function actualizarFechaMantMensual(fecha) {
  if (checklistSoloLectura) return;
  await sb.from('checklist_turno').update({ mantenimiento_mensual_fecha: fecha || null, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  checklistActual.mantenimiento_mensual_fecha = fecha;
}

async function actualizarHorasValidacion(prefijo, tipo, valor) {
  if (checklistSoloLectura) return;
  const campo = `${prefijo}_${tipo}`;
  const utcVal = valor ? localCOtoUTC(valor) : null;
  await sb.from('checklist_turno').update({ [campo]: utcVal, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  checklistActual[campo] = utcVal;
}

async function cargarHistorialChecklist() {
  let { data, error } = await sb.from('checklist_turno').select('fecha,items,cerrado,cerrado_por,cerrado_fecha,cierres_area').order('fecha', { ascending: false }).limit(30);
  if (error) ({ data } = await sb.from('checklist_turno').select('fecha,items,cerrado,cerrado_por,cerrado_fecha').order('fecha', { ascending: false }).limit(30));
  const el = document.getElementById('cl-historial');
  if (!el) return;
  if (!data || !data.length) { el.innerHTML = '<tr><td colspan="3" class="empty-state">Sin historial</td></tr>'; return; }
  el.innerHTML = data.map(row => {
    const total = Object.keys(row.items || {}).length;
    const marcados = Object.values(row.items || {}).filter(i => i?.checked).length;
    const c = cierresDe(row);
    const n = AREAS_CIERRE.filter(a => c[a.id]?.fecha).length;
    const faltan = AREAS_CIERRE.filter(a => !c[a.id]?.fecha).map(a => a.nombre);
    const pillCls = n === AREAS_CIERRE.length ? 's-val' : (n ? 's-rec' : 's-pend');
    return `<tr onclick="document.getElementById('cl-fecha').value='${row.fecha}';cambiarFechaChecklist()" style="cursor:pointer">
      <td class="mono">${fmt(row.fecha)}</td>
      <td style="text-align:center">${marcados}/${total}</td>
      <td><span class="pill ${pillCls}"><span class="dot"></span>${n}/${AREAS_CIERRE.length}</span>${faltan.length && faltan.length < AREAS_CIERRE.length ? ` <span style="font-size:10.5px;color:var(--text3)">sin cerrar: ${faltan.join(', ')}</span>` : ''}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// MODAL ENTREGA DE TURNO — se muestra al abrir el gestor por primera vez en el día
// ============================================================
// Trae el último día con registro (el viernes o sábado si hoy es lunes) y muestra
// área por área quién cerró, las novedades y los pendientes que quedaron.
async function verificarEntregaTurno() {
  const hoy = hoyCO();
  const key = 'entregaShown_' + hoy;
  try { if (localStorage.getItem(key)) return; } catch (e) {}
  const { data: filas } = await sb.from('checklist_turno').select('*').lt('fecha', hoy).order('fecha', { ascending: false }).limit(1);
  const ant = filas && filas[0];
  const c = ant ? cierresDe(ant) : {};
  const obs = ant?.obs_entrega_tarde || '';
  const nCerr = AREAS_CIERRE.filter(a => c[a.id]?.fecha).length;

  const filasArea = AREAS_CIERRE.map(a => {
    const x = c[a.id] || {}, ok = !!x.fecha;
    const conteo = a.id === 'recepcion' && x.conteo && x.conteo.fisico != null
      ? `<div style="font-size:11px;margin-top:3px;color:${x.conteo.fisico === x.conteo.sistema ? 'var(--green)' : 'var(--yellow)'}">Conteo físico ${x.conteo.fisico} · sistema ${x.conteo.sistema ?? '—'}${x.conteo.fisico === x.conteo.sistema ? ' · cuadra' : ' · no cuadró'}</div>` : '';
    return `<div style="padding:10px 0;border-bottom:0.5px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px">
        <i class="ti ${a.icono}" style="color:var(--text2)"></i><b style="font-size:12.5px">${a.nombre}</b>
        <span style="margin-left:auto;font-size:11px;color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? `<i class="ti ti-lock"></i> ${escCL(x.por || '—')}${x.legado ? '' : ' · ' + fmtHora(x.fecha)}` : '<i class="ti ti-alert-circle"></i> No se cerró'}</span>
      </div>
      ${x.novedades ? `<div style="font-size:12.5px;margin:6px 0 0 22px;padding:6px 9px;background:var(--yellow-bg);border-radius:var(--radius);color:var(--text)">${escCL(x.novedades)}</div>` : ''}
      ${x.pendientes && x.pendientes.length ? `<div style="margin:6px 0 0 22px">${chipsPendientes(x.pendientes)}</div>` : ''}
      ${conteo ? `<div style="margin-left:22px">${conteo}</div>` : ''}
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--radius-lg);max-width:620px;width:100%;padding:22px 24px;max-height:90vh;overflow-y:auto">
      <div style="font-size:18px;font-weight:600;margin-bottom:4px"><i class="ti ti-clipboard-check"></i> Entrega de turno</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">${ant ? `Último turno: ${fmt(ant.fecha)} · ${nCerr} de ${AREAS_CIERRE.length} áreas cerradas` : 'No hay cierre registrado del turno anterior'}</div>
      ${obs ? `<div style="padding:10px 12px;background:var(--yellow-bg);border:0.5px solid var(--yellow-border);border-radius:var(--radius);margin-bottom:6px">
        <div style="font-size:11.5px;font-weight:600;color:var(--yellow);margin-bottom:4px"><i class="ti ti-alert-triangle"></i> Observaciones generales</div>
        <div style="font-size:13px;color:var(--text)">${escCL(obs)}</div></div>` : ''}
      ${ant ? filasArea : ''}
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-primary" style="flex:1" onclick="cerrarModalEntrega(true)"><i class="ti ti-clipboard-check"></i> Ir al cierre de turno de hoy</button>
        <button class="btn" onclick="cerrarModalEntrega(false)">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  window._modalEntrega = modal;
  try { localStorage.setItem(key, '1'); } catch (e) {}
}

function cerrarModalEntrega(irAChecklist) {
  if (window._modalEntrega) { window._modalEntrega.remove(); window._modalEntrega = null; }
  if (irAChecklist) nav('checklist', document.querySelector(".sidebar [onclick*=\"nav('checklist'\"]"));
}
