// ============================================================
// TUBERCULOSIS — OPORTUNIDAD (meta 48 h, Resolución 227 de 2020)
// ============================================================
// Las pruebas moleculares de TB deben tener un tiempo de respuesta al clínico de
// máximo 48 horas (horas corridas: fines de semana y festivos cuentan). Aquí se
// mide desde la recepción en el laboratorio hasta hoy para las que siguen sin
// validar, con alerta a las 36 h para alcanzar a montarlas a tiempo.
// Todo sale de allMuestras (ya está en memoria); solo el cumplimiento de los
// últimos 30 días hace una consulta pequeña (dos columnas, ~70 filas) cada 10 min.
// ============================================================
const TB_COD = '1001662';
const TB_META_H = 48;
const TB_ALERTA_H = 36;
let tbOpFiltro = 'todas';
let tbOpCumpl = null;          // {pct, n, en48, hora}
let tbOpCumplCargado = 0;

const tbHoras = iso => (Date.now() - Date.parse(iso)) / 3600e3;
const esTB = m => m.estudio_codigo === TB_COD || nombreCorto(m.estudio_nombre, m.estudio_codigo) === 'TB';

// Muestras de TB recibidas que siguen esperando resultado
function tbEnEspera() {
  return (allMuestras || [])
    .filter(m => esTB(m) && (m.estado === 'sin-validar' || m.estado === 'reproceso') && m.fecha_recepcion)
    .map(m => ({ ...m, horas: tbHoras(m.fecha_recepcion) }))
    .sort((a, b) => b.horas - a.horas);
}

function tbSemaforo(h) {
  if (h > TB_META_H) return 'crit';
  if (h >= TB_ALERTA_H) return 'warn';
  return 'ok';
}

function resumenOportunidadTB() {
  const espera = tbEnEspera();
  return {
    espera,
    vencidas: espera.filter(m => m.horas > TB_META_H).length,
    porVencer: espera.filter(m => m.horas >= TB_ALERTA_H && m.horas <= TB_META_H).length,
  };
}

function actualizarBadgeTB() {
  const b = document.getElementById('badge-tb-op');
  if (!b) return;
  const { vencidas, porVencer } = resumenOportunidadTB();
  const n = vencidas + porVencer;
  b.textContent = n;
  b.style.display = n ? 'inline' : 'none';
  b.style.background = vencidas ? 'var(--red-bg)' : 'var(--yellow-bg)';
  b.style.color = vencidas ? 'var(--red)' : 'var(--yellow)';
  b.title = `${vencidas} con más de 48 h · ${porVencer} entre 36 y 48 h`;
}

async function cargarCumplimientoTB(force = false) {
  if (!force && tbOpCumpl && Date.now() - tbOpCumplCargado < 600000) return;
  const desde = new Date(Date.now() - 30 * 86400e3).toISOString();
  const { data, error } = await sb.from('v_muestras')
    .select('fecha_recepcion,fecha_validacion')
    .eq('estudio_codigo', TB_COD).eq('estado', 'validado')
    .gte('fecha_validacion', desde);
  if (error) { console.error('Cumplimiento TB:', error); return; }
  const filas = (data || []).filter(r => r.fecha_recepcion && r.fecha_validacion && Date.parse(r.fecha_validacion) > Date.parse(r.fecha_recepcion));
  const en48 = filas.filter(r => (Date.parse(r.fecha_validacion) - Date.parse(r.fecha_recepcion)) / 3600e3 <= TB_META_H).length;
  tbOpCumpl = { n: filas.length, en48, pct: filas.length ? Math.round(100 * en48 / filas.length) : null };
  tbOpCumplCargado = Date.now();
}

function chipTBOp(el, val) {
  tbOpFiltro = val;
  document.querySelectorAll('#tb-op-chips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderOportunidadTB();
}

const tbFmtH = h => h < 1 ? '<1 h' : (h < 100 ? Math.floor(h) + ' h' : Math.floor(h / 24) + ' d');

function renderOportunidadTB() {
  const cont = document.getElementById('tb-op-tabla');
  if (!cont) return;
  const { espera, vencidas, porVencer } = resumenOportunidadTB();
  const kpi = (lbl, val, color, sub) => `<div class="mc"><div class="mc-label">${lbl}</div><div class="mc-value" style="color:${color}">${val}</div>${sub ? `<div class="mc-sub">${sub}</div>` : ''}</div>`;
  const c = tbOpCumpl;
  const colorCumpl = !c || c.pct === null ? 'var(--text2)' : c.pct >= 90 ? 'var(--green)' : c.pct >= 70 ? 'var(--yellow)' : 'var(--red)';
  document.getElementById('tb-op-kpis').innerHTML =
    kpi('Esperando resultado', espera.length, 'var(--text)', 'recibidas, sin validar') +
    kpi('Por vencer', porVencer, porVencer ? 'var(--yellow)' : 'var(--text)', `entre ${TB_ALERTA_H} y ${TB_META_H} h desde recepción`) +
    kpi('Vencidas', vencidas, vencidas ? 'var(--red)' : 'var(--text)', `más de ${TB_META_H} h desde recepción`) +
    kpi('Cumplimiento 30 días', c && c.pct !== null ? c.pct + ' %' : '—', colorCumpl, c ? `${c.en48} de ${c.n} validadas en ≤${TB_META_H} h` : 'calculando…');

  let filas = espera;
  if (tbOpFiltro === 'alerta') filas = espera.filter(m => m.horas >= TB_ALERTA_H);
  document.getElementById('tb-op-resumen').textContent = espera.length ? `${filas.length} de ${espera.length}` : '';

  const col = { ok: 'var(--green)', warn: 'var(--yellow)', crit: 'var(--red)' };
  const bg = { ok: 'var(--green-bg)', warn: 'var(--yellow-bg)', crit: 'var(--red-bg)' };
  cont.innerHTML = filas.length ? filas.map(m => {
    const s = tbSemaforo(m.horas);
    const vence = new Date(Date.parse(m.fecha_recepcion) + TB_META_H * 3600e3);
    const enCorr = typeof enCorridaTBGlobal !== 'undefined' ? enCorridaTBGlobal.get(m.nro_muestra) : null;
    const pct = Math.min(100, m.horas / TB_META_H * 100);
    return `<tr${s === 'crit' ? ' style="background:#FDF6F6"' : ''}>
      <td class="mono" style="font-size:11px">${m.nro_muestra}</td>
      <td style="font-size:11.5px">${m.paciente || '—'}</td>
      <td style="font-size:11px;color:var(--text2)">${m.sede || '—'}</td>
      <td style="font-size:11px">${fmt(m.fecha_recepcion)} ${fmtHora(m.fecha_recepcion)}</td>
      <td style="min-width:120px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;font-weight:600;padding:1px 7px;border-radius:10px;background:${bg[s]};color:${col[s]}">${tbFmtH(m.horas)}</span>
          <div style="flex:1;height:5px;border-radius:3px;background:var(--bg3);overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:${col[s]}"></i></div>
        </div>
      </td>
      <td style="font-size:11px;color:${s === 'crit' ? 'var(--red)' : 'var(--text2)'}">${s === 'crit' ? 'Venció ' : ''}${fmt(vence.toISOString())} ${fmtHora(vence.toISOString())}</td>
      <td style="font-size:11px">${enCorr ? `<span class="mono">${enCorr.nombre || 'Sí'}</span>` : '<span style="color:var(--text3)">Sin montar</span>'}</td>
      <td>${pill(m.estado)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" class="empty-state">${tbOpFiltro === 'alerta' ? 'Ninguna muestra pasa de ' + TB_ALERTA_H + ' h' : 'No hay muestras de TB esperando resultado'}</td></tr>`;
  actualizarBadgeTB();
}

async function initOportunidadTB() {
  renderOportunidadTB();
  const nros = tbEnEspera().map(m => m.nro_muestra);
  await Promise.all([
    nros.length && typeof cargarEnCorridaTBGlobal === 'function' ? cargarEnCorridaTBGlobal(nros) : null,
    cargarCumplimientoTB(),
  ]);
  renderOportunidadTB();
}

// Cada minuto: las horas avanzan aunque no cambien los datos (sin consultas)
setInterval(() => {
  if (!currentUser) return;
  actualizarBadgeTB();
  if (document.getElementById('page-tuberculosis')?.classList.contains('active')) renderOportunidadTB();
}, 60000);
