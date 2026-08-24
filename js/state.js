// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentUser = null;
let allMuestras = [];
let lastMuestrasLoad = 0;
let recepciones = [];
let recepcionesTB = [];
let gestionadasLocal = new Set();
let muestrasPage = 0;  // página actual en "todas las muestras"
let pendientesPage = 0; // página actual en pendientes
const PAGE_SIZE = 50; // od_ids marcados como gestionados en esta sesión
let scanDups = 0;
let scanTimer = null;
let activeEstado = 'todos';
let activePrueba = 'todas';
let pendFiltro = 'todas';
let pendSearch = '';
let selectedMotivo = null;

// Mapa código → nombre corto (hardcodeado como fallback)
const CODIGO_CORTO = {
  '1001543':'CMV','1001542':'CMV',
  '1004658':'Hemocr.',
  '1001662':'TB',
  '1004472':'HLA B57',
  '1000107':'VPH','1009395':'VPH','1011771':'VPH','1002198':'VPH',
  '1000165':'HIV',
  '1001953':'VHB','1006610':'VHB',
  '1001955':'VHC','1003864':'VHC',
  '1004512':'Homocist.',
  '1001683':'Geno C',
  '1001882':'Geno HIV',
  '1005655':'HLA B27',
  '1004394':'Integrasa',
  '1005081':'MTHFR','1005081-1':'MTHFR',
};

function nombreCorto(estudio_nombre, estudio_codigo) {
  // 1. Buscar por código exacto en mapa hardcodeado
  if (estudio_codigo && CODIGO_CORTO[estudio_codigo]) return CODIGO_CORTO[estudio_codigo];
  // 2. Buscar en pruebasData de Supabase
  if (estudio_codigo && pruebasData.length) {
    const p = pruebasData.find(x => x.codigo === estudio_codigo);
    if (p) return p.nombre_corto;
  }
  // 3. Fallback por texto del nombre
  const n = (estudio_nombre||'').toUpperCase();
  if (n.includes('VIH CARGA') || n.includes('HIV CARGA')) return 'HIV';
  if (n.includes('HEPATITIS B')) return 'VHB';
  if (n.includes('HEPATITIS C') && !n.includes('GENOTIP')) return 'VHC';
  if (n.includes('PAPILOMAVIRUS') || n.includes('PVH') || n.includes('TAMIZAJE ADN')) return 'VPH';
  if (n.includes('TUBERCULOSIS') || n.includes('MYCOBACTERIUM')) return 'TB';
  if (n.includes('CITOMEGALOVIRUS')) return 'CMV';
  if (n.includes('HLA-B') && n.includes('27')) return 'HLA B27';
  if (n.includes('HLA-B') && n.includes('57')) return 'HLA B57';
  if (n.includes('HEMOCROMATOSIS')) return 'Hemocr.';
  if (n.includes('HOMOCISTEINA')) return 'Homocist.';
  if (n.includes('MTHFR')) return 'MTHFR';
  if (n.includes('INTEGRASA')) return 'Integrasa';
  if (n.includes('GENOTIPIF') && n.includes('VIH')) return 'Geno HIV';
  if (n.includes('GENOTIPIF') && n.includes('HEPATITIS')) return 'Geno C';
  return estudio_nombre ? estudio_nombre.slice(0,10) + (estudio_nombre.length>10?'…':'') : '—';
}

const SM = {
  'pendiente':     {l:'Pendiente',    c:'s-pend'},
  'recibido':      {l:'Recibido',     c:'s-rec'},
  'sin-validar':   {l:'Sin validar',  c:'s-sinval'},
  'validado':      {l:'Validado',     c:'s-val'},
  'reproceso':     {l:'Reproceso',    c:'s-rep'},
  'nueva-muestra': {l:'Nueva muestra',c:'s-nmu'},
  'remitida':      {l:'Remitida',     c:'s-rem'},
  'anulado':       {l:'Anulado',      c:'s-anu'},
};
function pill(e){const s=SM[e]||{l:e,c:'s-pend'};return`<span class="pill ${s.c}"><span class="dot"></span>${s.l}</span>`;}
// Convierte un datetime-local string (sin TZ) a ISO UTC asumiendo Colombia UTC-5
function localCOtoUTC(dtLocal) {
  if (!dtLocal) return null;
  // dtLocal viene del input datetime-local como "2026-06-01T15:00" (hora Colombia).
  // Construimos explícitamente con offset -05:00 para que la conversión a UTC sea correcta
  // sin depender de la zona horaria configurada en el computador.
  const iso = dtLocal.length === 16 ? dtLocal + ':00' : dtLocal;
  return new Date(iso + '-05:00').toISOString();
}

// Convierte serial de Excel a ISO UTC asumiendo que el serial está en hora Colombia
function excelSerialToUTC(num) {
  // El serial de Excel representa una fecha/hora local de Colombia (sin zona horaria).
  // (num - 25569) * 86400000 da los milisegundos desde epoch tratándolo como UTC.
  // Como en realidad es hora Colombia (UTC-5), sumamos 5h para obtener el UTC real.
  const msComoUTC = Math.round((num - 25569) * 86400 * 1000);
  return new Date(msComoUTC + 5 * 3600 * 1000).toISOString();
}

const TZ_CO = 'America/Bogota';
function fmt(dt){if(!dt)return'—';const d=new Date(dt);return d.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:TZ_CO});}
function fmtHora(dt){if(!dt)return'—';return new Date(dt).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',timeZone:TZ_CO});}
// Fecha de HOY en hora Colombia (YYYY-MM-DD), sin depender de la zona horaria del
// computador. Usar SIEMPRE esto en vez de new Date().toISOString().slice(0,10):
// después de las 7 PM hora Colombia, el slice de UTC devuelve el día siguiente.
function hoyCO(){ return new Date().toLocaleDateString('en-CA', { timeZone: TZ_CO }); }

