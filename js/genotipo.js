// ============================================================
// GENOTIPO VIH (NGS)
// ============================================================
// Reemplaza el Excel "BD genotipo VIH NGS" y las hojas de montaje.
//  · Muestras: cada ingreso de Genotipo VIH (1001882) aparece solo. Las auxiliares
//    escriben la carga viral DEL TUBO: < 200 copias/mL → No se realiza (sin ID);
//    ≥ 200 → Apta, en cola para la próxima corrida. Oportunidad: 30 días hábiles
//    desde la recepción en el laboratorio.
//  · Corridas: letra + año (A-2026, B-2026…; en 2027 vuelve a la A; después de Z, AA).
//    El ID de cada muestra es letra + posición (F1, F2…). Extracción en 1 o 2 partes;
//    la secuenciación es con 24 que amplificaron. Una que no amplifica conserva su ID,
//    queda "Sin resultado" y se puede reemplazar (por eso una corrida puede pasar de 24).
//  · Resultado: total / parcial (genes PR-RT-INT) / sin resultado, subtipo, mutaciones
//    por gen y resistencia por fármaco con los niveles de Stanford HIVdb.
//  · Correos: no se realiza (médico), inoportunidad (médico), nueva muestra (Fay).
// Tablas: genotipo_vih, genotipo_corridas, genotipo_posiciones, genotipo_correos.
// ============================================================
const GV_COD = '1001882';
const GV_OPORTUNIDAD = 30;            // días hábiles desde la recepción
const GV_UMBRAL_CV = 200;             // copias/mL
const GV_FINALES = ['nsr', 'tot', 'par', 'sin', 'rem', 'val', 'anu'];
const GV_ESTADOS = {
  pend: ['Pendiente de recibir', 'gv-e-pend'], cv: ['Esperando CV', 'gv-e-cv'], nsr: ['No se realiza', 'gv-e-nsr'],
  apta: ['Apta · en cola', 'gv-e-apta'], corrida: ['En corrida', 'gv-e-corrida'], tot: ['Resultado total', 'gv-e-tot'],
  par: ['Resultado parcial', 'gv-e-par'], sin: ['Sin resultado (no amplificó)', 'gv-e-sin'], rem: ['Remitida (externa)', 'gv-e-rem'],
  val: ['Validada', 'gv-e-val'], anu: ['Anulada', 'gv-e-pend']
};
const GV_DROGAS = [
  ['Inhibidores nucleósidos de la TR (NRTI)', ['ABC', 'AZT', 'FTC', '3TC', 'TDF', 'D4T', 'DDI']],
  ['Inhibidores no nucleósidos de la TR (NNRTI)', ['DOR', 'EFV', 'ETR', 'NVP', 'RPV']],
  ['Inhibidores de proteasa (PI)', ['ATV/r', 'DRV/r', 'FPV/r', 'IDV/r', 'LPV/r', 'NFV', 'SQV/r', 'TPV/r']],
  ['Inhibidores de integrasa (INI)', ['BIC', 'CAB', 'DTG', 'EVG', 'RAL']],
];
const GV_NIVELES = [['S', 'Susceptible'], ['PL', 'Potencial bajo'], ['L', 'Resistencia baja'], ['I', 'Intermedia'], ['H', 'Alta']];
const GV_CORREO_NM = { para: 'Fayrline Aristizábal Colorado <faristizabalc@dinamicaips.com.co>', cc: 'Gloria Elena Ramírez Gómez <geramirezg@sura.com.co>; Laura Pertuz Restrepo <lprestrepo@sura.com.co>' };

let gvMuestras = [];          // filas de v_muestras de Genotipo VIH
let gvDatos = new Map();      // od_id -> fila de genotipo_vih
let gvCorridas = [];
let gvPos = [];               // posiciones de las corridas cargadas
let gvCorreos = [];
let gvFiltro = 'activas', gvTab = 'muestras', gvCorrSel = null, gvVista = 'pos', gvAbierto = null, gvCorreoActual = null;
let gvCargado = false;
let gvCVTubo = new Set();          // nro_muestra de genotipo que también tienen ingreso de CV VIH (1000165)
let gvCVPaciente = new Map();      // cédula -> [fechas de ingreso de CV VIH] (para "otro tubo")
const GV_COD_CV = '1000165';

// ---------------- Utilidades ----------------
const gvEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const gvISO = ts => !ts ? null : (/^\d{4}-\d{2}-\d{2}$/.test(ts) ? ts : new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ_CO }));
const gvSigDia = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const gvVenceCache = new Map();
function gvVence(recISO) {
  if (gvVenceCache.has(recISO)) return gvVenceCache.get(recISO);
  let d = recISO, n = 0;
  while (n < GV_OPORTUNIDAD) { const sig = gvSigDia(d); if (diasHabilesGlobal(d, sig) === 1) n++; d = sig; }
  gvVenceCache.set(recISO, d); return d;
}
const gvM = od => gvMuestras.find(m => m.od_id === od);
const gvG = od => gvDatos.get(od) || {};
const gvCV = g => g.cv_valor == null || g.cv_valor === '' ? null : g.cv_valor;
const gvCVtxt = g => { const v = gvCV(g); if (v == null) return null; return /^\d+(\.\d+)?$/.test(v) ? Number(v).toLocaleString('es-CO') : v; };
const gvNombre = m => `${(m.nombres || '').trim()} ${(m.apellidos || '').trim()}`.trim() || m.paciente || '—';
const gvCorrida = id => gvCorridas.find(c => c.id === id);
const gvIdTxt = p => { const c = gvCorrida(p.corrida_id); return c ? c.letra + p.posicion : '?' + p.posicion; };
// Posición vigente de una muestra (la más reciente que no sea una repetición)
function gvPosDe(od) {
  const ps = gvPos.filter(p => p.od_id === od && !p.repetida);
  return ps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
}
function gvEstado(m) {
  if (m.estado === 'anulado') return 'anu';
  const g = gvG(m.od_id), p = gvPosDe(m.od_id);
  if (['nsr', 'tot', 'par', 'sin', 'rem'].includes(g.estado)) return g.estado;
  if (p && p.amplificacion === 'no') return 'sin';
  if (m.estado === 'validado') return 'val';
  if (p) return 'corrida';
  if (!m.fecha_recepcion) return 'pend';
  if (gvCV(g) != null) return Number(g.cv_num) < GV_UMBRAL_CV ? 'nsr' : 'apta';
  return 'cv';
}
function gvOportunidad(m) {
  const rec = gvISO(m.fecha_recepcion); if (!rec) return null;
  const e = gvEstado(m), g = gvG(m.od_id);
  const parado = GV_FINALES.includes(e);
  const fin = parado ? (gvISO(m.fecha_validacion) || g.cv_fecha || gvISO(g.updated_at) || hoyCO()) : hoyCO();
  const usados = diasHabilesGlobal(rec, fin < rec ? rec : fin);
  return { usados, quedan: GV_OPORTUNIDAD - usados, vence: gvVence(rec), parado };
}
const gvCorreosDe = (od, tipo) => gvCorreos.filter(c => c.od_id === od && (!tipo || c.tipo === tipo));

// ---------------- Carga (consultas pequeñas: solo Genotipo VIH) ----------------
async function initGenotipo() {
  await gvCargar();
  gvRender();
}

async function gvCargar() {
  const desde = new Date(Date.now() - 400 * 864e5).toISOString();
  const filas = [];
  for (let from = 0; ; from += 1000) {
    const {data, error} = await sb.from('v_muestras').select(COLS_MUESTRAS)
      .eq('estudio_codigo', GV_COD).gte('fecha_ingreso', desde)
      .order('fecha_ingreso', { ascending: true }).range(from, from + 999);
    if (error) { toast('Error cargando genotipos: ' + error.message, 'err'); return; }
    filas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  gvMuestras = filas;
  await gvCargarIngresosCV(desde);
  const [rg, rc, rco] = await Promise.all([
    sb.from('genotipo_vih').select('*'),
    sb.from('genotipo_corridas').select('*').gte('anio', new Date().getFullYear() - 1).order('created_at', { ascending: true }),
    sb.from('genotipo_correos').select('*').order('fecha', { ascending: true }),
  ]);
  if (rg.error) { toast('Falta crear las tablas de Genotipo VIH en Supabase (genotipo_vih.sql)', 'err'); return; }
  gvDatos = new Map((rg.data || []).map(g => [g.od_id, g]));
  gvCorridas = rc.data || [];
  gvCorreos = rco.data || [];
  gvPos = [];
  const ids = gvCorridas.map(c => c.id);
  for (let i = 0; i < ids.length; i += 50) {
    const {data} = await sb.from('genotipo_posiciones').select('*').in('corrida_id', ids.slice(i, i + 50)).order('posicion', { ascending: true });
    gvPos.push(...(data || []));
  }
  gvCargado = true;
  await gvVincularNuevasMuestras();
}

// ¿La muestra tiene también ingreso de carga viral de VIH? Solo se consultan los tubos y
// cédulas de genotipo (consultas pequeñas, por lotes de 100).
async function gvCargarIngresosCV(desde) {
  gvCVTubo = new Set(); gvCVPaciente = new Map();
  const nros = [...new Set(gvMuestras.map(m => m.nro_muestra).filter(Boolean))];
  const ccs = [...new Set(gvMuestras.map(m => m.identificacion).filter(Boolean))];
  for (let i = 0; i < nros.length; i += 100) {
    const {data} = await sb.from('ingresos').select('nro_muestra').eq('estudio_codigo', GV_COD_CV).in('nro_muestra', nros.slice(i, i + 100));
    (data || []).forEach(r => gvCVTubo.add(r.nro_muestra));
  }
  for (let i = 0; i < ccs.length; i += 100) {
    const {data} = await sb.from('ingresos').select('identificacion,fecha_ingreso').eq('estudio_codigo', GV_COD_CV).gte('fecha_ingreso', desde).in('identificacion', ccs.slice(i, i + 100));
    (data || []).forEach(r => { if (!gvCVPaciente.has(r.identificacion)) gvCVPaciente.set(r.identificacion, []); gvCVPaciente.get(r.identificacion).push(r.fecha_ingreso); });
  }
}
// 'tubo' = el mismo tubo tiene ingreso de CV · 'paciente' = el paciente tiene CV en otro tubo
// (±15 días del ingreso del genotipo) · null = no tiene ingreso de CV
function gvIngresoCV(m) {
  if (gvCVTubo.has(m.nro_muestra)) return { tipo: 'tubo' };
  const fs = gvCVPaciente.get(m.identificacion) || [];
  const t0 = new Date(m.fecha_ingreso).getTime();
  const cerca = fs.filter(f => Math.abs(new Date(f).getTime() - t0) <= 15 * 864e5).sort((a, b) => Math.abs(new Date(a) - t0) - Math.abs(new Date(b) - t0))[0];
  return cerca ? { tipo: 'paciente', fecha: cerca } : null;
}
function gvChipCV(m) {
  const c = gvIngresoCV(m);
  if (!c) return '<span class="pill gv-e-nsr" title="No hay ingreso de carga viral de VIH para este tubo ni para el paciente en esos días">✗ Sin ingreso CV</span>';
  if (c.tipo === 'tubo') return '<span class="pill gv-e-tot" title="El mismo tubo tiene ingreso de carga viral de VIH">✓ Mismo tubo</span>';
  return `<span class="pill gv-e-apta" title="El paciente tiene ingreso de carga viral de VIH en otro tubo">✓ Otro tubo · ${fmt(c.fecha)}</span>`;
}

// Cuando llega un ingreso nuevo de genotipo de un paciente al que se le pidió nueva
// muestra, se vinculan los dos intentos (por cédula) y se avisa en la bandeja.
async function gvVincularNuevasMuestras() {
  const pendientes = gvMuestras.filter(m => { const g = gvG(m.od_id); return g.nueva_muestra_fecha && !g.vinculo_od; });
  for (const ant of pendientes) {
    const g = gvG(ant.od_id);
    const nueva = gvMuestras.filter(m => m.od_id !== ant.od_id && m.identificacion && m.identificacion === ant.identificacion
        && gvISO(m.fecha_ingreso) >= g.nueva_muestra_fecha && !gvG(m.od_id).nueva_de_od)
      .sort((a, b) => new Date(a.fecha_ingreso) - new Date(b.fecha_ingreso))[0];
    if (!nueva) continue;
    await gvGuardar(ant.od_id, { vinculo_od: nueva.od_id }, true);
    await gvGuardar(nueva.od_id, { nueva_de_od: ant.od_id, aviso_nueva: true }, true);
  }
}

async function gvGuardar(od, campos, silencioso) {
  const m = gvM(od);
  const prev = gvDatos.get(od) || { od_id: od, genes: { PR: true, RT: true, INT: true }, mutaciones: {}, resistencias: {}, clinicos: {} };
  const fila = { ...prev, ...campos, od_id: od, nro_muestra: m?.nro_muestra || prev.nro_muestra || null, actualizado_por: currentUser, updated_at: new Date().toISOString() };
  const {error} = await sb.from('genotipo_vih').upsert(fila, { onConflict: 'od_id' });
  if (error) { toast('No se pudo guardar: ' + error.message, 'err'); return false; }
  gvDatos.set(od, fila);
  if (!silencioso) gvActualizarBadge();
  return true;
}

// ---------------- Render general ----------------
function gvRender() {
  if (!gvCargado) return;
  document.querySelectorAll('#page-genotipo .gv-tab').forEach(t => t.classList.toggle('active', t.dataset.t === gvTab));
  document.getElementById('gv-v-muestras').style.display = gvTab === 'muestras' ? '' : 'none';
  document.getElementById('gv-v-corridas').style.display = gvTab === 'corridas' ? '' : 'none';
  const act = gvMuestras.filter(gvFiltros()[0][2]).length;
  document.getElementById('gv-tn-muestras').textContent = act;
  document.getElementById('gv-tn-corridas').textContent = gvCorridas.filter(c => c.anio === Number(hoyCO().slice(0, 4))).length;
  if (gvTab === 'muestras') { gvRenderAvisos(); gvRenderKpis(); gvRenderLista(); }
  else gvRenderCorridas();
  gvActualizarBadge();
  if (gvAbierto) gvRenderDrawer();
}
function gvIrTab(t) { gvTab = t; gvRender(); }
function gvActualizarBadge() {
  const b = document.getElementById('badge-genotipo'); if (!b || !gvCargado) return;
  const n = gvMuestras.filter(gvFiltros()[5][2]).length + gvMuestras.filter(m => gvEstado(m) === 'nsr' && !gvCorreosDe(m.od_id, 'nsr').length && gvActiva(m)).length;
  b.textContent = n; b.style.display = n ? 'inline' : 'none';
}
// "Activa" = necesita algo del laboratorio
function gvActiva(m) {
  const e = gvEstado(m), g = gvG(m.od_id);
  if (['tot', 'par', 'val', 'rem', 'anu'].includes(e)) return false;
  if (e === 'nsr' && gvCorreosDe(m.od_id, 'nsr').length) return false;
  if (e === 'sin' && g.vinculo_od) return false;
  if (e === 'sin' && g.nueva_muestra_fecha && gvCorreosDe(m.od_id, 'nm').length) return false;
  return true;
}
function gvFiltros() {
  return [
    ['activas', 'Activas', gvActiva],
    ['pend', 'Por recibir', m => gvEstado(m) === 'pend'],
    ['cv', 'Esperando CV', m => gvEstado(m) === 'cv'],
    ['apta', 'Aptas en cola', m => gvEstado(m) === 'apta'],
    ['corrida', 'En corrida', m => gvEstado(m) === 'corrida'],
    ['vence', 'Vencen ≤ 1 día', m => { const e = gvEstado(m), o = gvOportunidad(m); return o && ['cv', 'apta', 'corrida'].includes(e) && o.quedan <= 1 && !gvCorreosDe(m.od_id, 'inop').length; }],
    ['nsr', 'No se realiza', m => gvEstado(m) === 'nsr'],
    ['fin', 'Con resultado', m => ['tot', 'par', 'sin', 'val', 'rem'].includes(gvEstado(m))],
    ['sincv', 'Sin ingreso CV', m => gvActiva(m) && !gvIngresoCV(m)],
  ];
}

// ---------------- Muestras ----------------
function gvRenderAvisos() {
  const a = [];
  gvMuestras.filter(m => gvG(m.od_id).aviso_nueva).forEach(m => { const ant = gvM(gvG(m.od_id).nueva_de_od); const p = ant && gvPosDe(ant.od_id);
    a.push(`<div class="gv-aviso gv-av-blue"><i class="ti ti-link" style="font-size:16px"></i><div>Llegó la <b>nueva muestra</b> de <b>${gvEsc(gvNombre(m))}</b> (código <span class="mono">${m.nro_muestra}</span>). Se vinculó con el intento anterior${p ? ' <b>' + gvIdTxt(p) + '</b>' : ''} por la cédula ${gvEsc(m.identificacion || '')}.</div><button class="btn" onclick="gvAbrir('${m.od_id}')">Ver historia</button></div>`); });
  const venc = gvMuestras.filter(gvFiltros()[5][2]);
  if (venc.length) a.push(`<div class="gv-aviso gv-av-red"><i class="ti ti-alarm" style="font-size:16px"></i><div><b>${venc.length} muestra${venc.length > 1 ? 's' : ''}</b> llega${venc.length > 1 ? 'n' : ''} al día ${GV_OPORTUNIDAD} de oportunidad o ya lo pasó y no se ha avisado al médico.</div><button class="btn" onclick="gvSetFiltro('vence')">Ver cuáles</button></div>`);
  const nsrSin = gvMuestras.filter(m => gvEstado(m) === 'nsr' && !gvCorreosDe(m.od_id, 'nsr').length);
  if (nsrSin.length) a.push(`<div class="gv-aviso gv-av-yel"><i class="ti ti-mail-exclamation" style="font-size:16px"></i><div><b>${nsrSin.length}</b> "No se realiza" sin correo enviado al médico.</div><button class="btn" onclick="gvSetFiltro('nsr')">Ver</button></div>`);
  document.getElementById('gv-avisos').innerHTML = a.join('');
}
function gvRenderKpis() {
  const F = gvFiltros();
  const enF = gvCorridas.find(c => c.estado === 'armando');
  const k = [
    ['pend', F[1][2], 'ingresadas, sin escanear'],
    ['cv', F[2][2], 'falta la carga del tubo'],
    ['apta', F[3][2], enF ? `corrida ${enF.letra} abierta` : 'no hay corrida abierta'],
    ['corrida', F[4][2], 'armando o en secuenciación'],
    ['vence', F[5][2], `${GV_OPORTUNIDAD} días hábiles desde recepción`],
    ['nsr', F[6][2], `CV < ${GV_UMBRAL_CV} copias/mL`],
  ];
  document.getElementById('gv-kpis').innerHTML = k.map(([id, f, s]) => { const n = gvMuestras.filter(f).length; const lbl = F.find(x => x[0] === id)[1];
    return `<div class="mc ${gvFiltro === id ? 'sel' : ''}" onclick="gvSetFiltro('${id}')"><div class="mc-label">${lbl}</div><div class="mc-value" style="${id === 'vence' && n ? 'color:var(--red)' : ''}">${n}</div><div class="mc-sub">${s}</div></div>`; }).join('');
}
function gvSetFiltro(f) { gvFiltro = gvFiltro === f ? 'activas' : f; gvRender(); }
function gvCeldaOp(m) {
  const o = gvOportunidad(m); if (!o) return '<span class="gv-sub">empieza al recibir</span>';
  if (o.parado) return `<span class="gv-sub">${o.usados} d háb. · detenido</span>`;
  const pct = Math.min(100, o.usados / GV_OPORTUNIDAD * 100);
  const col = o.quedan <= 1 ? 'var(--red)' : o.quedan <= 7 ? 'var(--yellow)' : 'var(--green)';
  const txt = o.quedan < 0 ? `vencida hace ${-o.quedan} d` : o.quedan === 0 ? 'vence hoy' : `quedan ${o.quedan} d háb.`;
  return `<div class="gv-op"><span class="gv-op-txt" style="color:${col}">${txt}</span><div class="gv-op-bar"><i style="width:${pct}%;background:${col}"></i></div><span class="gv-sub">vence ${fmt(o.vence)}</span></div>`;
}
function gvCeldaCV(m, editable = true) {
  const g = gvG(m.od_id), e = gvEstado(m);
  if (e === 'cv' && editable) return `<input class="gv-cv-in" placeholder="copias/mL" title="Escribe el valor o <20 y Enter" onkeydown="if(event.key==='Enter')gvPonerCV('${m.od_id}',this.value)" onclick="event.stopPropagation()" />`;
  const v = gvCVtxt(g); if (v == null) return '<span class="gv-sub">—</span>';
  const bajo = Number(g.cv_num) < GV_UMBRAL_CV;
  return `<span class="mono" style="font-weight:600;color:${bajo ? 'var(--red)' : 'var(--text)'}">${gvEsc(v)}</span>${g.cv_fecha ? `<div class="gv-sub">${fmt(g.cv_fecha)}</div>` : ''}`;
}
async function gvPonerCV(od, valor) {
  const v = String(valor || '').trim().replace(/\s/g, ''); if (!v) return;
  const menor = v.startsWith('<');
  const num = menor ? 0 : Number(v.replace(/\./g, '').replace(',', '.'));
  if (!menor && (isNaN(num) || num < 0)) { toast('Escribe un número (copias/mL) o "<20"', 'err'); return; }
  const txt = menor ? v : String(num);
  if (!await gvGuardar(od, { cv_valor: txt, cv_num: num, cv_fecha: hoyCO(), estado: num < GV_UMBRAL_CV ? 'nsr' : null })) return;
  toast(num < GV_UMBRAL_CV ? `CV ${txt} < ${GV_UMBRAL_CV} → No se realiza. Genera el correo para el médico.` : `CV ${num.toLocaleString('es-CO')} → Apta, queda en la cola de la próxima corrida.`, num < GV_UMBRAL_CV ? 'info' : 'ok');
  gvRender();
}
function gvBotones(m) {
  const b = [], e = gvEstado(m), g = gvG(m.od_id), o = gvOportunidad(m);
  if (e === 'nsr') b.push(`<button class="btn ${gvCorreosDe(m.od_id, 'nsr').length ? '' : 'btn-yellow'}" onclick="event.stopPropagation();gvCorreo('${m.od_id}','nsr')"><i class="ti ti-mail"></i> No se realiza</button>`);
  if (o && !o.parado && o.quedan <= 1 && ['apta', 'corrida', 'cv'].includes(e)) b.push(`<button class="btn ${gvCorreosDe(m.od_id, 'inop').length ? '' : 'btn-red'}" onclick="event.stopPropagation();gvCorreo('${m.od_id}','inop')"><i class="ti ti-mail"></i> Inoportunidad</button>`);
  if (e === 'sin' && !g.nueva_muestra_fecha) b.push(`<button class="btn btn-yellow" onclick="event.stopPropagation();gvCorreo('${m.od_id}','nm')"><i class="ti ti-mail"></i> Pedir nueva muestra</button>`);
  if (e === 'sin' && g.nueva_muestra_fecha && !g.vinculo_od) b.push(`<span class="pill gv-e-nm">Nueva muestra pedida ${fmt(g.nueva_muestra_fecha)}</span>`);
  if (g.vinculo_od) b.push(`<span class="pill gv-e-apta"><i class="ti ti-link"></i> Llegó nueva</span>`);
  b.push(`<button class="btn" title="Detalle" onclick="event.stopPropagation();gvAbrir('${m.od_id}')"><i class="ti ti-file-description"></i></button>`);
  return `<div class="gv-acc">${b.join('')}</div>`;
}
function gvRenderLista() {
  const F = gvFiltros(), f = F.find(x => x[0] === gvFiltro) || F[0];
  const q = (document.getElementById('gv-buscar')?.value || '').trim().toLowerCase();
  const idDe = m => { const p = gvPosDe(m.od_id); return p ? gvIdTxt(p) : ''; };
  let arr = gvMuestras.filter(f[2]).filter(m => !q || [m.nro_muestra, m.nombres, m.apellidos, m.identificacion, idDe(m)].join(' ').toLowerCase().includes(q));
  const orden = { nsr: 0, cv: 1, apta: 2, pend: 3, corrida: 4, sin: 5, tot: 6, par: 6, val: 7, rem: 7, anu: 8 };
  arr.sort((a, b) => (orden[gvEstado(a)] - orden[gvEstado(b)]) || ((gvOportunidad(a)?.quedan ?? 99) - (gvOportunidad(b)?.quedan ?? 99)) || (new Date(b.fecha_ingreso) - new Date(a.fecha_ingreso)));
  document.getElementById('gv-chip-sincv')?.classList.toggle('active', gvFiltro === 'sincv');
  document.getElementById('gv-lista-titulo').textContent = (gvFiltro === 'activas' ? 'Muestras activas' : f[1]) + ` · ${arr.length}`;
  document.getElementById('gv-lista').innerHTML = arr.length ? arr.map(m => { const e = gvEstado(m), id = idDe(m), g = gvG(m.od_id);
    return `<tr class="gv-clic" onclick="gvAbrir('${m.od_id}')">
      <td class="mono">${m.nro_muestra}${g.nueva_de_od ? '<div class="gv-sub"><i class="ti ti-link"></i> nueva muestra</div>' : ''}</td>
      <td>${gvEsc(gvNombre(m))}<div class="gv-sub">CC ${gvEsc(m.identificacion || '—')}</div></td>
      <td>${gvChipCV(m)}</td>
      <td style="font-size:11px;color:var(--text2)">${gvEsc((m.sede || '—').replace('Ay Dx ', ''))}</td>
      <td class="mono">${m.fecha_recepcion ? fmt(m.fecha_recepcion) : '<span class="gv-sub">no ha llegado</span>'}</td>
      <td>${gvCeldaOp(m)}</td><td>${gvCeldaCV(m)}</td>
      <td><span class="pill ${GV_ESTADOS[e][1]}">${GV_ESTADOS[e][0]}</span></td>
      <td>${id ? `<span class="gv-id">${id}</span>` : '<span class="gv-sub">—</span>'}</td>
      <td>${gvBotones(m)}</td></tr>`; }).join('') : '<tr><td colspan="10" class="empty-state">Nada por aquí 🎉</td></tr>';
}

// ---------------- Detalle de la muestra ----------------
async function gvAbrir(od) {
  gvAbierto = od;
  if (gvG(od).aviso_nueva) await gvGuardar(od, { aviso_nueva: false });
  gvRenderDrawer();
  document.getElementById('gv-drawer').classList.add('open');
  document.getElementById('gv-ov').classList.add('open');
  gvRender();
}
function gvCerrarDrawer() { gvAbierto = null; document.getElementById('gv-drawer').classList.remove('open'); document.getElementById('gv-ov').classList.remove('open'); }
function gvRenderDrawer() {
  const m = gvM(gvAbierto); if (!m) return;
  const g = gvG(m.od_id), e = gvEstado(m), o = gvOportunidad(m), p = gvPosDe(m.od_id);
  const genes = g.genes || { PR: true, RT: true, INT: true }, mut = g.mutaciones || {}, res = g.resistencias || {}, cl = g.clinicos || {};
  document.getElementById('gv-dh').innerHTML = `<div style="font-size:15px;font-weight:600">${gvEsc(gvNombre(m))}</div>
    <div class="gv-sub" style="margin-top:2px">CC ${gvEsc(m.identificacion || '—')} · <span class="mono">${m.nro_muestra}</span> · ${gvEsc(m.sede || '')}</div>
    <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="pill ${GV_ESTADOS[e][1]}">${GV_ESTADOS[e][0]}</span>${p ? `<span class="gv-id">${gvIdTxt(p)}</span>` : ''}${o ? `<span class="gv-sub">${o.parado ? 'oportunidad detenida (' + o.usados + ' d háb.)' : (o.quedan >= 0 ? 'quedan ' + o.quedan + ' d háb. · vence ' + fmt(o.vence) : 'vencida')}</span>` : ''}</div>`;
  // Historia
  const h = [{ f: m.fecha_ingreso, t: 'Ingreso en LabCore', c: '' }];
  if (g.nueva_de_od) { const a = gvM(g.nueva_de_od); if (a) h.push({ f: a.fecha_ingreso, t: `Intento anterior ${gvPosDe(a.od_id) ? gvIdTxt(gvPosDe(a.od_id)) + ' ' : ''}(${a.nro_muestra})`, c: 'bad', od: a.od_id }); }
  if (m.fecha_recepcion) h.push({ f: m.fecha_recepcion, t: `Recibida en el laboratorio${m.recibido_por ? ' (' + gvEsc(m.recibido_por) + ')' : ''}`, c: 'ok' });
  if (gvCV(g) != null) h.push({ f: g.cv_fecha, t: `CV del tubo ${gvEsc(gvCVtxt(g))} copias/mL → ${Number(g.cv_num) < GV_UMBRAL_CV ? 'no se realiza' : 'apta'}`, c: Number(g.cv_num) < GV_UMBRAL_CV ? 'bad' : 'ok' });
  gvPos.filter(x => x.od_id === m.od_id).forEach(x => { const c = gvCorrida(x.corrida_id);
    h.push({ f: x.created_at, t: `${x.repetida ? 'Repetida en' : 'Asignada a'} la corrida ${c ? c.letra + '-' + c.anio : ''} como ${gvIdTxt(x)} (extracción ${x.extraccion})`, c: 'ok' });
    if (x.amplificacion === 'no') h.push({ f: c?.fecha_seq || c?.fecha_ext2 || x.created_at, t: `${gvIdTxt(x)} no amplificó`, c: 'bad' }); });
  if (g.nueva_muestra_fecha) h.push({ f: g.nueva_muestra_fecha, t: `Nueva muestra solicitada${g.nueva_muestra_por ? ' (' + gvEsc(g.nueva_muestra_por) + ')' : ''}`, c: '' });
  if (g.vinculo_od) { const n = gvM(g.vinculo_od); if (n) h.push({ f: n.fecha_ingreso, t: `Llegó la nueva muestra ${n.nro_muestra}`, c: 'now', od: n.od_id }); }
  gvCorreosDe(m.od_id).forEach(c => h.push({ f: c.fecha, t: `Correo: ${{ nsr: 'no se realiza', inop: 'inoportunidad', nm: 'solicitud de nueva muestra' }[c.tipo] || c.tipo}${c.enviado_por ? ' (' + gvEsc(c.enviado_por) + ')' : ''}`, c: '' }));
  if (m.fecha_validacion) h.push({ f: m.fecha_validacion, t: `Validada en LabCore${m.validado_por ? ' (' + gvEsc(m.validado_por) + ')' : ''}`, c: 'ok' });
  h.sort((a, b) => new Date(a.f || 0) - new Date(b.f || 0));
  const od = m.od_id;
  const clin = (k, l, ph = '', tipo = 'text') => `<label>${l}<input type="${tipo}" value="${gvEsc(cl[k] || '')}" placeholder="${ph}" onchange="gvGuardarClin('${od}','${k}',this.value)"></label>`;
  document.getElementById('gv-db').innerHTML = `
    <div class="gv-sec"><h4><i class="ti ti-timeline"></i> Historia de la muestra</h4><ul class="gv-tl">${h.map(x => `<li class="${x.c}"><span class="f">${fmt(x.f)}</span> · ${x.t}${x.od ? ` <a href="#" onclick="event.preventDefault();gvAbrir('${x.od}')">ver</a>` : ''}</li>`).join('')}</ul></div>
    <div class="gv-sec"><h4><i class="ti ti-droplet"></i> Carga viral del tubo</h4>
      <dl class="gv-kv"><dt>Ingreso de CV VIH</dt><dd>${gvChipCV(m)}</dd><dt>Valor</dt><dd>${gvCeldaCV(m)}${gvCV(g) != null && !p ? ` <a href="#" style="font-size:11px;margin-left:6px" onclick="event.preventDefault();gvCorregirCV('${od}')">corregir</a>` : ''}</dd>
      <dt>Regla</dt><dd style="font-size:11.5px;color:var(--text2)">&lt; ${GV_UMBRAL_CV} copias/mL → no se realiza · ≥ ${GV_UMBRAL_CV} → apta</dd></dl></div>
    <div class="gv-sec"><details class="gv-opc"><summary>Datos clínicos (opcionales)</summary><div class="gv-grid2">
      ${clin('dx', 'Año de diagnóstico', 'ej. 2019')}
      <label>Estadio<select onchange="gvGuardarClin('${od}','estadio',this.value)"><option></option>${['A1','A2','A3','B1','B2','B3','C1','C2','C3'].map(x => `<option ${cl.estadio === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label>Grupo poblacional<select onchange="gvGuardarClin('${od}','grupo',this.value)"><option></option>${['Población general','LGBTIQ+','Habitante de calle','Gestante','Otro'].map(x => `<option ${cl.grupo === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      ${clin('tel', 'Teléfono')}${clin('cv_prev', 'CV previa (copias/mL)', 'ej. 486')}${clin('cv_prev_fecha', 'Fecha CV previa', '', 'date')}
      ${clin('tto', 'Tratamiento', 'ej. TDF/FTC/DTG')}${clin('cd4', 'CD4 (cél/µL) y fecha', 'ej. 420 · 2026-08-01')}
    </div></details></div>
    <div class="gv-sec"><h4><i class="ti ti-report-medical"></i> Resultado</h4>
      <div class="gv-grid2" style="margin-top:0">
        <label>Estado final<select onchange="gvCambiarFinal('${od}',this.value)"><option value="">— (se calcula)</option>
          ${[['tot', 'TOTAL'], ['par', 'RESULTADO PARCIAL'], ['sin', 'SIN RESULTADO (no amplificó)'], ['nsr', 'NO SE REALIZA'], ['rem', 'REMITIDA (externa)']].map(([k, l]) => `<option value="${k}" ${g.estado === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Subtipo<input value="${gvEsc(g.subtipo || '')}" placeholder="ej. B" onchange="gvGuardar('${od}',{subtipo:this.value.trim()})"></label>
      </div>
      <div class="gv-fld" style="margin-top:10px">Genes secuenciados <span class="gv-sub">(clic en el que no salió → resultado parcial)</span>
        <div class="gv-genes">${['PR', 'RT', 'INT'].map(x => `<span class="gv-gen ${genes[x] !== false ? 'on' : 'off'}" onclick="gvToggleGen('${od}','${x}')"><i class="ti ti-${genes[x] !== false ? 'check' : 'x'}"></i> ${x}</span>`).join('')}</div></div>
      <div class="gv-grid2">${['PR', 'RT', 'INT'].map(x => `<label style="grid-column:${x === 'INT' ? '1/-1' : 'auto'}">Mutaciones ${x}<textarea class="gv-ta" placeholder="${x === 'PR' ? 'ej. L10I, L33F' : x === 'RT' ? 'ej. M184V, K103N' : 'ej. G118R, E138K'}" ${genes[x] !== false ? '' : 'disabled'} onchange="gvGuardarMut('${od}','${x}',this.value)">${gvEsc(mut[x] || '')}</textarea></label>`).join('')}</div>
      <div class="gv-fld" style="margin-top:10px">Resistencia por fármaco (niveles Stanford HIVdb)</div>
      <div class="gv-res">${GV_DROGAS.map(([cls, ds]) => `<div class="gv-res-cls">${cls}</div>` + ds.map(d => { const v = res[d] || ''; return `<div class="gv-res-row"><span class="mono">${d}</span><select class="${v ? 'gv-lv-' + v : ''}" onchange="gvGuardarRes('${od}','${d}',this)"><option value="">—</option>${GV_NIVELES.map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`; }).join('')).join('')}</div>
      <div class="gv-grid2"><label>Link del resultado<input placeholder="https://…" value="${gvEsc(g.link_resultado || '')}" onchange="gvGuardar('${od}',{link_resultado:this.value.trim()})"></label>
        <label>Fecha de validación<input value="${m.fecha_validacion ? fmt(m.fecha_validacion) : ''}" placeholder="se llena sola al importar validados" disabled></label></div>
      <label class="gv-fld" style="margin-top:8px">Notas<textarea class="gv-ta" style="font-family:var(--font)" onchange="gvGuardar('${od}',{notas:this.value})">${gvEsc(g.notas || '')}</textarea></label>
    </div>
    <div class="gv-sec"><h4><i class="ti ti-mail"></i> Correos</h4><div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn" onclick="gvCorreo('${od}','nsr')">No se realiza</button><button class="btn" onclick="gvCorreo('${od}','inop')">Inoportunidad</button><button class="btn" onclick="gvCorreo('${od}','nm')">Nueva muestra</button></div></div>`;
}
async function gvCorregirCV(od) { if (!confirm('¿Borrar la carga viral para escribirla de nuevo?')) return; await gvGuardar(od, { cv_valor: null, cv_num: null, cv_fecha: null, estado: null }); gvRender(); }
async function gvGuardarClin(od, k, v) { const cl = { ...(gvG(od).clinicos || {}), [k]: v }; await gvGuardar(od, { clinicos: cl }); }
async function gvGuardarMut(od, gen, v) { const mu = { ...(gvG(od).mutaciones || {}), [gen]: v.trim() }; await gvGuardar(od, { mutaciones: mu }); }
async function gvGuardarRes(od, droga, sel) { const r = { ...(gvG(od).resistencias || {}) }; if (sel.value) r[droga] = sel.value; else delete r[droga]; sel.className = sel.value ? 'gv-lv-' + sel.value : ''; await gvGuardar(od, { resistencias: r }); }
async function gvToggleGen(od, gen) {
  const g = gvG(od), genes = { PR: true, RT: true, INT: true, ...(g.genes || {}) }; genes[gen] = genes[gen] === false;
  const campos = { genes };
  if (Object.values(genes).some(v => v === false) && g.estado === 'tot') campos.estado = 'par';
  await gvGuardar(od, campos); gvRender();
}
async function gvCambiarFinal(od, v) {
  const p = gvPosDe(od);
  await gvGuardar(od, { estado: v || null });
  if (p && (v === 'sin' || (p.amplificacion === 'no' && v && v !== 'sin'))) {
    const amp = v === 'sin' ? 'no' : 'si';
    await sb.from('genotipo_posiciones').update({ amplificacion: amp }).eq('id', p.id); p.amplificacion = amp;
  }
  gvRender();
}

// ---------------- Correos ----------------
function gvCorreo(od, tipo) {
  const m = gvM(od), g = gvG(od), firma = currentUser || '';
  const nombre = gvNombre(m), cc = m.identificacion || '';
  const cvTxt = gvCV(g) == null ? '[carga viral]' : gvCVtxt(g) + ' copias/mL';
  const ant = g.nueva_de_od ? gvM(g.nueva_de_od) : null, ga = ant ? gvG(ant.od_id) : null;
  let para, copia = '', asunto, cuerpo, extra = '';
  if (tipo === 'nsr') {
    para = 'Médico tratante (buscar en la historia clínica)'; asunto = `Información genotipo de VIH - ${nombre}`;
    cuerpo = `Buenas tardes Dr(a).,\n\nNos permitimos informar que no es posible realizar el genotipo de VIH correspondiente a la muestra del paciente:\n\n${nombre}\n${cc}\n\nDebido a que la carga viral al momento del procesamiento fue inferior al umbral mínimo requerido de ${GV_UMBRAL_CV} copias/mL.\nA continuación, se detallan los valores observados:\n` +
      (ant && ga && gvCV(ga) != null ? `Carga viral previa: ${gvCVtxt(ga)} copias/mL, validada el ${fmt(ga.cv_fecha)}\nEn un primer procesamiento no se obtiene amplificación de blancos, por lo que se le solicita al paciente una nueva muestra.\n` : '') +
      `Carga viral actual: ${cvTxt}, validada el ${fmt(g.cv_fecha)}.\n\nDebido a que la carga viral se encuentra por debajo del límite técnico requerido para la amplificación, no es posible realizar el procesamiento de la muestra.\n\nSe sugiere considerar una nueva toma en caso de que persista la necesidad clínica de realizar el genotipo y que la muestra cumpla con los criterios mínimos establecidos.\n\nMuchas gracias.\nCordialmente,\n${firma}`;
  } else if (tipo === 'inop') {
    para = 'Médico tratante (buscar en la historia clínica)'; asunto = `Información genotipo de VIH ${nombre}`;
    const fv = document.getElementById('gv-f-val')?.value || '';
    extra = `<label class="gv-fld" style="margin-bottom:10px">Día en que se espera validar el resultado<input type="date" id="gv-f-val" value="${gvEsc(fv)}" onchange="gvCorreo('${od}','inop')"></label>`;
    const dia = fv ? new Date(fv + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : '[día]';
    cuerpo = `Buenos días Dr(a).\nEspero se encuentre muy bien.\n\nLe escribo para informarle que hemos presentado una inoportunidad en el procesamiento de la prueba de genotipo de VIH del paciente ${nombre} CC ${cc}, debido a que estábamos completando el número mínimo de muestras requerido para la corrida de secuenciación (24 pacientes), condición necesaria para el procesamiento del ensayo.\nDe acuerdo con la programación actual del laboratorio, el día ${dia} estaremos validando el resultado.\n\nAgradezco por su atención.\nCordialmente,\n${firma}`;
  } else {
    para = GV_CORREO_NM.para; copia = GV_CORREO_NM.cc; asunto = 'Solicitud nueva muestra para genotipo de VIH';
    cuerpo = `Hola Fay, ¿cómo estás?\n\nSolicito tu colaboración con la solicitud de una nueva muestra para la realización del genotipo de VIH correspondiente a:\n\n${nombre}\n${cc}\n\nDebido a que no se obtuvo amplificación en los blancos de genotipo de VIH y se requiere nueva muestra para corroborar estado virológico del paciente o descartar inhibidores.\n\nAgradezco por tu atención.\nCordialmente,\n${firma}`;
  }
  gvCorreoActual = { od, tipo, asunto, cuerpo, para, copia };
  const env = gvCorreosDe(od, tipo);
  document.getElementById('gv-mt').textContent = { nsr: `Correo — No se realiza (CV < ${GV_UMBRAL_CV})`, inop: 'Correo — Inoportunidad', nm: 'Correo — Solicitud de nueva muestra' }[tipo];
  document.getElementById('gv-mb').innerHTML = extra + `<div class="gv-meta"><span>Para</span><span><b>${gvEsc(para)}</b></span>${copia ? `<span>CC</span><span>${gvEsc(copia)}</span>` : ''}<span>Asunto</span><span>${gvEsc(asunto)}</span></div><div class="gv-body">${gvEsc(cuerpo)}</div>` +
    (env.length ? `<div class="gv-sub" style="margin-top:8px"><i class="ti ti-history"></i> Ya enviado: ${env.map(c => fmt(c.fecha) + (c.enviado_por ? ' por ' + gvEsc(c.enviado_por) : '')).join(' · ')}</div>` : '');
  document.getElementById('gv-mf').innerHTML = `<span class="gv-sub" style="flex:1">${tipo === 'nm' ? '' : 'El médico no se guarda en el gestor: búscalo en la historia y pégalo en "Para".'}</span><button class="btn" onclick="gvCopiarCorreo()"><i class="ti ti-copy"></i> Copiar correo</button><button class="btn btn-primary" onclick="gvMarcarEnviado()"><i class="ti ti-check"></i> Marcar como enviado</button>`;
  document.getElementById('gv-mbg').classList.add('open');
}
function gvCopiarCorreo() {
  const c = gvCorreoActual; const t = `Asunto: ${c.asunto}\n\n${c.cuerpo}`;
  const ok = () => toast('Correo copiado: pégalo en Outlook', 'ok');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, () => gvCopiarRespaldo(t, ok));
  else gvCopiarRespaldo(t, ok);
}
function gvCopiarRespaldo(t, ok) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('No se pudo copiar', 'err'); } ta.remove(); }
async function gvMarcarEnviado() {
  const c = gvCorreoActual;
  const {data, error} = await sb.from('genotipo_correos').insert({ od_id: c.od, tipo: c.tipo, enviado_por: currentUser }).select().single();
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  gvCorreos.push(data);
  if (c.tipo === 'nm') await gvGuardar(c.od, { nueva_muestra_fecha: hoyCO(), nueva_muestra_por: currentUser });
  toast('Correo registrado en la historia de la muestra', 'ok');
  gvCerrarModal(); gvRender();
}
function gvCerrarModal() { document.getElementById('gv-mbg').classList.remove('open'); }

// ---------------- Corridas ----------------
const gvLetra = n => n < 26 ? String.fromCharCode(65 + n) : gvLetra(Math.floor(n / 26) - 1) + String.fromCharCode(65 + n % 26);
const gvIndiceLetra = L => [...L].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;   // A=0 … Z=25, AA=26
// Siempre la que sigue a la ÚLTIMA del año (no rellena huecos)
function gvLetraSiguiente(anio) { const idx = gvCorridas.filter(c => c.anio === anio).map(c => gvIndiceLetra(c.letra)); return gvLetra(idx.length ? Math.max(...idx) + 1 : 0); }
const gvPosC = c => gvPos.filter(p => p.corrida_id === c.id).sort((a, b) => (a.posicion - b.posicion) || (a.repetida - b.repetida));
const gvColaAptas = () => gvMuestras.filter(m => gvEstado(m) === 'apta').sort((a, b) => (gvOportunidad(a)?.quedan ?? 99) - (gvOportunidad(b)?.quedan ?? 99));
async function gvNuevaCorrida() {
  const abierta = gvCorridas.find(c => c.estado === 'armando');
  if (abierta) { toast(`Ya está abierta la corrida ${abierta.letra}-${abierta.anio}`, 'err'); gvCorrSel = abierta.id; gvRender(); return; }
  const anio = Number(hoyCO().slice(0, 4)), letra = gvLetraSiguiente(anio);
  if (!confirm(`¿Crear la corrida ${letra}-${anio}?`)) return;
  const {data, error} = await sb.from('genotipo_corridas').insert({ letra, anio, estado: 'armando', creada_por: currentUser }).select().single();
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  gvCorridas.push(data); gvCorrSel = data.id; toast(`Corrida ${letra}-${anio} creada`, 'ok'); gvRender();
}
function gvRenderCorridas() {
  const lista = [...gvCorridas].sort((a, b) => (b.anio - a.anio) || (new Date(b.created_at) - new Date(a.created_at)));
  if (!gvCorrSel || !gvCorrida(gvCorrSel)) gvCorrSel = (lista.find(c => c.estado !== 'cerrada') || lista[0])?.id || null;
  document.getElementById('gv-clist').innerHTML = lista.length ? lista.map(c => { const ps = gvPosC(c).filter(p => p.od_id || p.nro_muestra).filter(p => !p.repetida && !p.verificacion);
    const n = ps.length, ok = ps.filter(p => p.amplificacion === 'si').length;
    const est = { armando: ['Armando', 'gv-e-apta'], secuenciacion: ['En secuenciación', 'gv-e-corrida'], cerrada: ['Cerrada', 'gv-e-tot'] }[c.estado];
    return `<div class="gv-citem ${c.id === gvCorrSel ? 'sel' : ''}" onclick="gvCorrSel='${c.id}';gvRender()"><div class="gv-letra">${c.letra}</div><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:500">Corrida ${c.letra} · ${c.anio}</div><div class="gv-sub">${n} muestras${c.estado !== 'armando' ? ` · ${ok} amplificaron` : ''}</div>${c.estado === 'armando' ? `<div class="gv-prog"><i style="width:${Math.min(100, n / 24 * 100)}%"></i></div>` : ''}</div><span class="pill ${est[1]}">${est[0]}</span></div>`; }).join('') : '<div class="empty-state">Sin corridas</div>';
  const c = gvCorrida(gvCorrSel);
  if (!c) { document.getElementById('gv-cdet').innerHTML = '<div class="panel"><div class="empty-state">Crea la primera corrida</div></div>'; return; }
  const ps = gvPosC(c), pac = ps.filter(p => !p.repetida && !p.verificacion);
  const amplifican = pac.filter(p => p.amplificacion !== 'no').length;
  const editable = c.estado === 'armando', cerrada = c.estado === 'cerrada';
  const cola = gvColaAptas();
  const filas = ps.map(p => {
    if (p.verificacion) return `<tr class="gv-fila-ver"><td><span class="gv-id">${gvIdTxt(p)}</span></td><td colspan="3"><input value="${gvEsc(p.verificacion)}" ${cerrada ? 'disabled' : ''} style="font-size:12px;padding:3px 7px;width:260px;color:var(--teal);font-weight:500" onchange="gvActPos('${p.id}',{verificacion:this.value})"></td><td>${gvExt(p, cerrada)}</td><td><span class="gv-sub">verificación</span></td><td><div class="gv-acc">${editable ? `<button class="btn" title="Quitar" onclick="gvQuitarPos('${p.id}')"><i class="ti ti-x"></i></button>` : ''}</div></td></tr>`;
    const m = p.od_id ? gvM(p.od_id) : null, o = m ? gvOportunidad(m) : null;
    const nombre = m ? gvNombre(m) : (p.paciente || '—');
    return `<tr class="${p.amplificacion === 'no' ? 'gv-fila-no' : ''}"><td><span class="gv-id">${gvIdTxt(p)}</span>${p.repetida ? '<div class="gv-sub">repetida</div>' : ''}</td><td class="mono">${p.nro_muestra || '—'}</td>
      <td>${gvEsc(nombre)}<div class="gv-sub">${o && !o.parado ? (o.quedan >= 0 ? 'quedan ' + o.quedan + ' d háb.' : 'vencida') : (p.nota ? gvEsc(p.nota) : '')}</div></td>
      <td class="mono">${gvEsc(p.cv || '')}</td><td>${gvExt(p, cerrada)}</td>
      <td><select class="gv-amp" ${cerrada ? 'disabled' : ''} onchange="gvCambiarAmp('${p.id}',this.value)">${[['pend', 'Pendiente'], ['si', 'Amplificó'], ['no', 'No amplificó']].map(([k, l]) => `<option value="${k}" ${p.amplificacion === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><div class="gv-acc">${p.amplificacion === 'no' && !cerrada && !p.repetida ? `<button class="btn btn-yellow" onclick="gvReemplazar('${c.id}')" title="Entra la siguiente muestra de la cola">Reemplazar</button>` : ''}
        ${!cerrada && !p.repetida && p.od_id ? `<button class="btn" title="Repetir la extracción de esta muestra dentro de la misma corrida" onclick="gvRepetir('${p.id}')"><i class="ti ti-repeat"></i></button>` : ''}
        ${editable && p.amplificacion === 'pend' ? `<button class="btn" title="Quitar de la corrida" onclick="gvQuitarPos('${p.id}')"><i class="ti ti-x"></i></button>` : ''}
        ${m ? `<button class="btn" title="Detalle" onclick="gvAbrir('${m.od_id}')"><i class="ti ti-file-description"></i></button>` : ''}</div></td></tr>`;
  }).join('');
  document.getElementById('gv-cdet').innerHTML = `
    <div class="panel"><div class="panel-header"><span class="panel-title">Corrida ${c.letra} · ${c.anio} <span class="gv-sub" style="margin-left:6px">IDs ${c.letra}1, ${c.letra}2… según la posición</span></span>
      <div class="chips"><span class="chip ${gvVista === 'pos' ? 'active' : ''}" onclick="gvVista='pos';gvRender()">Posiciones</span><span class="chip ${gvVista === 'tec' ? 'active' : ''}" onclick="gvVista='tec';gvRender()">Hoja técnica</span></div></div>
      <div style="padding:12px 14px;border-bottom:0.5px solid var(--border);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">
        <div class="mc"><div class="mc-label">Muestras</div><div class="mc-value">${pac.length}<span class="gv-sub" style="font-size:12px"> / 24</span></div><div class="gv-prog"><i style="width:${Math.min(100, pac.length / 24 * 100)}%"></i></div></div>
        <div class="mc"><div class="mc-label">Extracción 1</div><div class="mc-value" style="font-size:15px">${c.fecha_ext1 ? fmt(c.fecha_ext1) : '—'}</div><div class="mc-sub">${ps.filter(p => p.extraccion === 1).length} posiciones</div></div>
        <div class="mc"><div class="mc-label">Extracción 2</div><div class="mc-value" style="font-size:15px">${c.fecha_ext2 ? fmt(c.fecha_ext2) : '—'}</div><div class="mc-sub">${ps.filter(p => p.extraccion === 2).length} posiciones</div></div>
        <div class="mc"><div class="mc-label">Van a secuenciación</div><div class="mc-value" style="color:${amplifican >= 24 ? 'var(--green)' : 'var(--text)'}">${amplifican}<span class="gv-sub" style="font-size:12px"> / 24</span></div><div class="mc-sub">${amplifican >= 24 ? 'completa ✓' : `faltan ${24 - amplifican}`}</div></div>
      </div>
      ${gvVista === 'tec' ? `<div style="padding:14px"><div class="gv-fase2"><b>Hoja técnica de la corrida — próxima entrega.</b><br>Aquí irá lo de "Formato de corridas de NGS" por posición: <code>Banda RT</code> <code>Banda Nested</code> <code>Qubit pospurificación</code> <code>Diluciones a 3 ng/µL</code> <code>Pool</code> <code>Adaptador</code> <code>Qubit librerías</code> <code>Qsep100 (pb)</code> <code>nM</code> <code>Dilución de librerías</code>, con los cálculos automáticos, y los lotes y vencimientos de reactivos.</div></div>` : `
      <div style="padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-bottom:0.5px solid var(--border)">
        ${editable ? `<input id="gv-scan" placeholder="Escanea el tubo para agregarlo…" style="width:230px;font-size:12px;padding:5px 9px" onkeydown="if(event.key==='Enter')gvEscanear('${c.id}',this)">
          <button class="btn btn-primary" onclick="gvVerCola('${c.id}')"><i class="ti ti-plus"></i> Agregar de la cola (${cola.length})</button>
          <button class="btn" onclick="gvAgregarVer('${c.id}')"><i class="ti ti-flask-2"></i> Verificación</button>
          <button class="btn" onclick="gvMarcarExt('${c.id}',1)">${c.fecha_ext1 ? '✓ ' : ''}Extracción 1</button><button class="btn" onclick="gvMarcarExt('${c.id}',2)">${c.fecha_ext2 ? '✓ ' : ''}Extracción 2</button>
          <button class="btn btn-green" style="margin-left:auto" onclick="gvASecuenciar('${c.id}')"><i class="ti ti-send"></i> Enviar a secuenciación</button>`
        : c.estado === 'secuenciacion' ? `<button class="btn" onclick="gvReemplazar('${c.id}')"><i class="ti ti-replace"></i> Reemplazar no amplificadas</button><button class="btn" onclick="gvReabrir('${c.id}')">Volver a armando</button><button class="btn btn-green" style="margin-left:auto" onclick="gvCerrarCorrida('${c.id}')"><i class="ti ti-lock"></i> Cerrar corrida</button>`
        : '<span class="gv-sub">Corrida cerrada — solo consulta.</span>'}
      </div>
      <div style="overflow:auto;max-height:calc(100vh - 360px)"><table><thead><tr><th>ID</th><th>Código</th><th>Paciente</th><th>CV</th><th>Extracción</th><th>Amplificación</th><th></th></tr></thead>
      <tbody>${filas || '<tr><td colspan="7" class="empty-state">Agrega muestras de la cola de aptas o escanea el tubo</td></tr>'}</tbody></table></div>`}
    </div>
    <div class="gv-nota"><b>Reglas:</b> el ID es la letra + la posición. Se puede extraer en dos partes; la secuenciación es con 24 que amplificaron. Si una <b>no amplifica</b> conserva su ID y queda <i>Sin resultado</i>; con <b>Reemplazar</b> entra la siguiente de la cola (por eso una corrida puede pasar de 24). <i class="ti ti-repeat"></i> repite la extracción de una muestra en la misma corrida. En el año nuevo la letra vuelve a la A.</div>`;
}
function gvExt(p, cerrada) { return `<span class="gv-ext">${[1, 2].map(n => `<span class="${p.extraccion === n ? 'on' : ''}" ${cerrada ? '' : `onclick="gvActPos('${p.id}',{extraccion:${n}})"`}>${n}</span>`).join('')}</span>`; }
async function gvActPos(id, campos) {
  const {error} = await sb.from('genotipo_posiciones').update(campos).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  Object.assign(gvPos.find(p => p.id === id), campos); gvRender();
}
function gvSigPos(c) { const ns = gvPosC(c).map(p => p.posicion); return (ns.length ? Math.max(...ns) : 0) + 1; }
async function gvAgregarMuestra(c, m) {
  const g = gvG(m.od_id);
  const fila = { corrida_id: c.id, posicion: gvSigPos(c), od_id: m.od_id, nro_muestra: m.nro_muestra, paciente: gvNombre(m), cv: gvCV(g), extraccion: c.fecha_ext1 ? 2 : 1, amplificacion: 'pend', repetida: false, registrado_por: currentUser };
  const {data, error} = await sb.from('genotipo_posiciones').insert(fila).select().single();
  if (error) { toast('Error: ' + error.message, 'err'); return null; }
  gvPos.push(data); return data;
}
async function gvEscanear(cid, input) {
  const c = gvCorrida(cid); const cod = resolverTubo(input.value.trim()); input.value = '';
  if (!cod) return;
  const m = gvMuestras.find(x => x.nro_muestra === cod);
  if (!m) { toast(`${cod} no tiene ingreso de Genotipo VIH en el gestor`, 'err'); return; }
  const e = gvEstado(m);
  if (e !== 'apta') { toast(`${gvNombre(m)}: ${GV_ESTADOS[e][0]}${e === 'cv' ? ' — primero escribe la carga viral' : ''}`, 'err'); return; }
  const p = await gvAgregarMuestra(c, m); if (p) toast(`${gvNombre(m)} → ${gvIdTxt(p)}`, 'ok');
  gvRender(); setTimeout(() => document.getElementById('gv-scan')?.focus(), 50);
}
function gvVerCola(cid) {
  const cola = gvColaAptas();
  document.getElementById('gv-mt').textContent = 'Agregar a la corrida — cola de aptas (las que más se van a vencer, arriba)';
  document.getElementById('gv-mb').innerHTML = cola.length ? cola.map(m => { const o = gvOportunidad(m), g = gvG(m.od_id);
    return `<label class="gv-cola"><input type="checkbox" value="${m.od_id}" checked><span class="mono" style="width:115px">${m.nro_muestra}</span><span style="flex:1">${gvEsc(gvNombre(m))}</span><span class="mono" style="width:80px;text-align:right">${gvEsc(gvCVtxt(g) || '')}</span><span style="width:120px;text-align:right;font-size:11px;font-weight:600;color:${o.quedan <= 1 ? 'var(--red)' : o.quedan <= 7 ? 'var(--yellow)' : 'var(--green)'}">${o.quedan >= 0 ? 'quedan ' + o.quedan + ' d háb.' : 'vencida'}</span></label>`; }).join('') : '<div class="empty-state">No hay muestras aptas en cola</div>';
  document.getElementById('gv-mf').innerHTML = `<span class="gv-sub" style="flex:1"></span><button class="btn" onclick="gvCerrarModal()">Cancelar</button>${cola.length ? `<button class="btn btn-primary" onclick="gvConfirmarCola('${cid}')"><i class="ti ti-plus"></i> Agregar seleccionadas</button>` : ''}`;
  document.getElementById('gv-mbg').classList.add('open');
}
async function gvConfirmarCola(cid) {
  const c = gvCorrida(cid);
  const ods = [...document.querySelectorAll('#gv-mb input:checked')].map(i => i.value);
  let n = 0; for (const od of ods) { if (await gvAgregarMuestra(c, gvM(od))) n++; }
  gvCerrarModal(); toast(`${n} muestra(s) agregadas a la corrida ${c.letra}`, 'ok'); gvRender();
}
async function gvAgregarVer(cid) {
  const c = gvCorrida(cid);
  const {data, error} = await sb.from('genotipo_posiciones').insert({ corrida_id: c.id, posicion: gvSigPos(c), verificacion: 'Verificación', extraccion: c.fecha_ext1 ? 2 : 1, amplificacion: 'si', repetida: false, registrado_por: currentUser }).select().single();
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  gvPos.push(data); gvRender();
}
async function gvQuitarPos(id) {
  const p = gvPos.find(x => x.id === id);
  if (!confirm(`¿Quitar ${gvIdTxt(p)} de la corrida?${p.od_id ? ' La muestra vuelve a la cola.' : ''}`)) return;
  const {error} = await sb.from('genotipo_posiciones').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  gvPos = gvPos.filter(x => x.id !== id); gvRender();
}
async function gvRepetir(id) {
  const p = gvPos.find(x => x.id === id);
  const {data, error} = await sb.from('genotipo_posiciones').insert({ corrida_id: p.corrida_id, posicion: p.posicion, od_id: p.od_id, nro_muestra: p.nro_muestra, paciente: p.paciente, cv: p.cv, extraccion: 2, amplificacion: 'pend', repetida: true, registrado_por: currentUser }).select().single();
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  gvPos.push(data); toast(`${gvIdTxt(p)} se repite en la extracción 2`, 'ok'); gvRender();
}
async function gvMarcarExt(cid, n) {
  const c = gvCorrida(cid), campo = 'fecha_ext' + n, valor = c[campo] ? null : hoyCO();
  if (c[campo] && !confirm(`¿Quitar la fecha de la extracción ${n}?`)) return;
  const {error} = await sb.from('genotipo_corridas').update({ [campo]: valor }).eq('id', cid);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  c[campo] = valor; if (valor) toast(`Extracción ${n} registrada hoy`, 'ok'); gvRender();
}
async function gvCambiarAmp(id, v) {
  const p = gvPos.find(x => x.id === id);
  const {error} = await sb.from('genotipo_posiciones').update({ amplificacion: v }).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  const antes = p.amplificacion; p.amplificacion = v;
  if (p.od_id && !p.repetida) {
    const g = gvG(p.od_id);
    if (v === 'no') { await gvGuardar(p.od_id, { estado: 'sin' }); toast(`${gvIdTxt(p)} no amplificó: conserva su ID y queda sin resultado. Puedes reemplazarla y pedir nueva muestra.`, 'info'); }
    else if (antes === 'no' && g.estado === 'sin') await gvGuardar(p.od_id, { estado: null });
  }
  gvRender();
}
async function gvReemplazar(cid) {
  const c = gvCorrida(cid), cola = gvColaAptas();
  if (!cola.length) { toast('No hay muestras aptas en la cola para reemplazar', 'err'); return; }
  const p = await gvAgregarMuestra(c, cola[0]); if (p) toast(`Entró ${gvNombre(cola[0])} como ${gvIdTxt(p)}`, 'ok'); gvRender();
}
async function gvEstadoCorrida(cid, estado, extra = {}) {
  const {error} = await sb.from('genotipo_corridas').update({ estado, ...extra }).eq('id', cid);
  if (error) { toast('Error: ' + error.message, 'err'); return false; }
  Object.assign(gvCorrida(cid), { estado, ...extra }); gvRender(); return true;
}
async function gvASecuenciar(cid) {
  const c = gvCorrida(cid), amp = gvPosC(c).filter(p => !p.repetida && !p.verificacion && p.amplificacion !== 'no').length;
  if (amp < 24 && !confirm(`La corrida tiene ${amp} muestras que van a secuenciación (se necesitan 24). ¿Enviarla igual?`)) return;
  if (await gvEstadoCorrida(cid, 'secuenciacion', { fecha_seq: hoyCO() })) toast(`Corrida ${c.letra} en secuenciación`, 'ok');
}
async function gvReabrir(cid) { await gvEstadoCorrida(cid, 'armando'); }
async function gvCerrarCorrida(cid) {
  const c = gvCorrida(cid);
  const pend = gvPosC(c).filter(p => !p.verificacion && !p.repetida && p.amplificacion === 'pend').length;
  if (!confirm(pend ? `Hay ${pend} posiciones con amplificación pendiente. ¿Cerrar la corrida igual?` : `¿Cerrar la corrida ${c.letra}-${c.anio}? Los resultados se siguen llenando en cada muestra.`)) return;
  if (await gvEstadoCorrida(cid, 'cerrada')) toast(`Corrida ${c.letra} cerrada`, 'ok');
}
