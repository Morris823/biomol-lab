// ============================================================
// RESCATAR DE HEMATOLOGÍA
// ============================================================
// Algunas muestras de sangre total traen con el mismo código un hemoleucograma
// (1001934) y una de nuestras pruebas manuales. Si la sede manda un solo tubo,
// hematología lo procesa primero y lo descarta rápido, y nunca nos llega.
//
// Al importar ingresos, las filas de hemoleucograma NO se guardan: solo sirven
// para marcar (ingresos.con_hemograma = true) las pruebas manuales del mismo
// archivo con el mismo código de muestra. Esta sección lista las marcadas que
// todavía no se han escaneado en Recepción; al escanearlas, la marca se borra.
// ============================================================
const COD_HEMOLEUCOGRAMA = '1001934';
const PRUEBAS_MANUALES_SANGRE = new Set(['HLA B27', 'HLA B57', 'Hemocr.', 'MTHFR', 'Homocist.']);
let hematoOdIds = new Set();   // OD_ID de los ingresos marcados con hemograma

function esHemoleucograma(codigo, nombre) {
  if (String(codigo || '').trim() === COD_HEMOLEUCOGRAMA) return true;
  const n = (nombre || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return n.includes('HEMOLEUCOGRAMA') || n.includes('CUADRO HEMATICO');
}

// Lee de las filas crudas del Excel los códigos de muestra que traen hemoleucograma
// (se hace antes del filtro de pruebas, que descarta el 1001934).
function nrosConHemograma(rows) {
  const norm = s => String(s).trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  const get = (row, cands) => {
    const keys = Object.keys(row);
    for (const c of cands) {
      const k = keys.find(x => norm(x) === norm(c));
      if (k !== undefined && row[k] !== '' && row[k] != null) return String(row[k]).trim();
    }
    return null;
  };
  const set = new Set();
  for (const row of rows) {
    const cod = get(row, ['ESTUDIO CODIGO', 'COD ESTUDIO', 'CODIGO ESTUDIO']);
    const nom = get(row, ['ESTUDIO NOMBRE', 'ESTUDIO', 'NOMBRE ESTUDIO', 'DESCRIPCION ESTUDIO', 'PRUEBA']);
    if (!esHemoleucograma(cod, nom)) continue;
    const nro = get(row, ['NRO MUESTRA', 'CODIGO MUESTRA', 'NRO_MUESTRA', 'NUMERO MUESTRA']);
    if (nro) set.add(nro);
  }
  return set;
}

// Llamada desde el importador de ingresos. Marca las pruebas manuales del archivo
// que comparten código de muestra con un hemoleucograma y que aún no se recibieron.
async function marcarConHemograma(filasArchivo, nrosHemo) {
  if (!nrosHemo.size) return 0;
  const candidatas = filasArchivo.filter(r =>
    nrosHemo.has(r.nro_muestra) && PRUEBAS_MANUALES_SANGRE.has(nombreCorto(r.estudio_nombre, r.estudio_codigo)));
  if (!candidatas.length) return 0;
  // Si el tubo ya se escaneó (llegó antes que el ingreso), no hay nada que rescatar
  const nros = [...new Set(candidatas.map(r => r.nro_muestra))];
  const {data: recs} = await sb.from('recepciones').select('nro_muestra').in('nro_muestra', nros);
  const recibidos = new Set((recs || []).map(r => r.nro_muestra));
  const ods = candidatas.filter(r => !recibidos.has(r.nro_muestra)).map(r => r.od_id);
  if (!ods.length) return 0;
  const {error} = await sb.from('ingresos').update({ con_hemograma: true }).in('od_id', ods);
  if (error) { console.error('Error marcando con_hemograma:', error); toast('No se pudieron marcar las muestras con hemograma: ' + error.message, 'err'); return 0; }
  ods.forEach(od => hematoOdIds.add(od));
  return ods.length;
}

// Consulta pequeña: solo los OD_ID marcados (normalmente unos pocos)
async function cargarMarcasHemato() {
  const {data, error} = await sb.from('ingresos').select('od_id').eq('con_hemograma', true);
  if (error) return; // si la columna aún no existe, la sección queda vacía sin romper nada
  hematoOdIds = new Set((data || []).map(r => r.od_id));
  actualizarBadgeHemato();
}

function muestrasRescateHemato() {
  return allMuestras
    .filter(m => hematoOdIds.has(m.od_id) && m.estado === 'pendiente')
    .sort((a, b) => new Date(a.fecha_ingreso) - new Date(b.fecha_ingreso));
}

function actualizarBadgeHemato() {
  const badge = document.getElementById('badge-hemato');
  if (!badge) return;
  const n = new Set(muestrasRescateHemato().map(m => m.nro_muestra)).size;
  badge.textContent = n;
  badge.style.display = n > 0 ? 'inline' : 'none';
}

// Llamada desde Recepción después de registrar el escaneo
async function quitarMarcaHemato(nro, pruebas) {
  const marcadas = pruebas.filter(p => hematoOdIds.has(p.od_id));
  if (!marcadas.length) return false;
  const {error} = await sb.from('ingresos').update({ con_hemograma: false }).eq('nro_muestra', nro).eq('con_hemograma', true);
  if (error) { console.error('Error quitando con_hemograma:', error); return false; }
  marcadas.forEach(p => hematoOdIds.delete(p.od_id));
  actualizarBadgeHemato();
  return true;
}

async function loadRescateHemato() {
  await cargarMarcasHemato();
  const lista = muestrasRescateHemato();
  const porTubo = new Map();   // un tubo puede tener 2 pruebas manuales: una sola fila
  lista.forEach(m => {
    if (!porTubo.has(m.nro_muestra)) porTubo.set(m.nro_muestra, { m, pruebas: [] });
    porTubo.get(m.nro_muestra).pruebas.push(nombreCorto(m.estudio_nombre, m.estudio_codigo));
  });
  const filas = [...porTubo.values()];
  document.getElementById('hemato-count').textContent = filas.length + (filas.length === 1 ? ' tubo' : ' tubos');
  document.getElementById('hemato-copiar').disabled = filas.length === 0;
  const horas = f => f ? Math.floor((Date.now() - new Date(f)) / 3600000) : null;
  document.getElementById('hemato-tabla').innerHTML = filas.length
    ? filas.map(({ m, pruebas }) => {
        const h = horas(m.fecha_ingreso);
        const tiempo = h == null ? '—' : h < 24 ? `${h} h` : `${Math.floor(h / 24)} d ${h % 24} h`;
        const color = h == null ? 'var(--text3)' : h >= 24 ? 'var(--red)' : h >= 6 ? 'var(--yellow)' : 'var(--text2)';
        return `<tr>
          <td class="mono">${m.nro_muestra}</td>
          <td>${m.paciente || '—'}</td>
          <td class="mono">${m.identificacion || '—'}</td>
          <td>${[...new Set(pruebas)].map(p => `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--accent-bg);color:var(--accent);margin-right:3px">${p}</span>`).join('')}</td>
          <td style="font-size:11px;color:var(--text2)">${m.sede || '—'}</td>
          <td class="mono" data-sort="${m.fecha_ingreso ? new Date(m.fecha_ingreso).getTime() : 0}">${fmt(m.fecha_ingreso)} <span style="font-size:10px;color:var(--text3)">${m.fecha_ingreso ? fmtHora(m.fecha_ingreso) : ''}</span></td>
          <td class="mono" data-sort="${h ?? -1}" style="font-weight:600;color:${color}">${tiempo}</td>
          <td style="text-align:center"><input type="checkbox" title="Marcar como gestionada (p. ej. ingreso anulado): sale de la lista"
            onchange="gestionarRescateHemato('${m.nro_muestra}', this)" /></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" class="empty-state">No hay muestras por rescatar de hematología 🎉</td></tr>';
}

function copiarCodigosHemato() {
  const codigos = [...new Set(muestrasRescateHemato().map(m => m.nro_muestra))];
  if (!codigos.length) return;
  navigator.clipboard.writeText(codigos.join('\n'))
    .then(() => toast(`${codigos.length} código${codigos.length === 1 ? '' : 's'} copiado${codigos.length === 1 ? '' : 's'}`, 'ok'))
    .catch(() => toast('No se pudo copiar al portapapeles', 'err'));
}

// Para los casos que ya no van a llegar (p. ej. le anularon el ingreso en LabCore):
// se quita la marca a mano y el tubo sale de la lista, igual que al escanearlo.
async function gestionarRescateHemato(nro, chk) {
  if (!confirm(`¿Marcar ${nro} como gestionada? Saldrá de la lista de rescate.`)) { chk.checked = false; return; }
  chk.disabled = true;
  const {error} = await sb.from('ingresos').update({ con_hemograma: false }).eq('nro_muestra', nro).eq('con_hemograma', true);
  if (error) { toast('Error: ' + error.message, 'err'); chk.checked = false; chk.disabled = false; return; }
  allMuestras.filter(m => m.nro_muestra === nro).forEach(m => hematoOdIds.delete(m.od_id));
  actualizarBadgeHemato();
  toast(`${nro} gestionada — salió de la lista`, 'ok');
  loadRescateHemato();
}
