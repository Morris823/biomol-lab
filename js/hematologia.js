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
let hematoFiltro = 'todas';    // 'todas' | 'sin' | 'ges'

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
  // El contador solo cuenta las que faltan por gestionar
  const n = new Set(muestrasRescateHemato().filter(m => !m.gestionada).map(m => m.nro_muestra)).size;
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
  const porTubo = new Map();   // un tubo puede tener 2 pruebas manuales: una sola fila
  muestrasRescateHemato().forEach(m => {
    if (!porTubo.has(m.nro_muestra)) porTubo.set(m.nro_muestra, { m, ods: [], pruebas: [], gestionada: true, nota: '' });
    const t = porTubo.get(m.nro_muestra);
    t.ods.push(m.od_id);
    t.pruebas.push(nombreCorto(m.estudio_nombre, m.estudio_codigo));
    if (!m.gestionada) t.gestionada = false;
    if (m.gestion && !t.nota) t.nota = m.gestion;
  });
  // Primero las que faltan por gestionar (más antiguas arriba); las gestionadas al final
  const todas = [...porTubo.values()].sort((a, b) => (a.gestionada - b.gestionada) || (new Date(a.m.fecha_ingreso) - new Date(b.m.fecha_ingreso)));
  const faltan = todas.filter(f => !f.gestionada).length;
  const filas = hematoFiltro === 'sin' ? todas.filter(f => !f.gestionada)
              : hematoFiltro === 'ges' ? todas.filter(f => f.gestionada) : todas;
  document.getElementById('hemato-count').textContent =
    `${faltan} por rescatar` + (todas.length > faltan ? ` · ${todas.length - faltan} gestionada${todas.length - faltan === 1 ? '' : 's'}` : '');
  document.getElementById('hemato-copiar').disabled = faltan === 0;
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const horas = f => f ? Math.floor((Date.now() - new Date(f)) / 3600000) : null;
  document.getElementById('hemato-tabla').innerHTML = filas.length
    ? filas.map(({ m, pruebas, gestionada, nota }) => {
        const h = horas(m.fecha_ingreso);
        const tiempo = h == null ? '—' : h < 24 ? `${h} h` : `${Math.floor(h / 24)} d ${h % 24} h`;
        const color = gestionada ? 'var(--text3)' : h == null ? 'var(--text3)' : h >= 24 ? 'var(--red)' : h >= 6 ? 'var(--yellow)' : 'var(--text2)';
        const nro = m.nro_muestra;
        return `<tr${gestionada ? ' style="background:var(--green-bg)"' : ''}>
          <td class="mono">${nro}</td>
          <td>${m.paciente || '—'}</td>
          <td class="mono">${m.identificacion || '—'}</td>
          <td>${[...new Set(pruebas)].map(p => `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--accent-bg);color:var(--accent);margin-right:3px">${p}</span>`).join('')}</td>
          <td style="font-size:11px;color:var(--text2)">${m.sede || '—'}</td>
          <td class="mono" data-sort="${m.fecha_ingreso ? new Date(m.fecha_ingreso).getTime() : 0}">${fmt(m.fecha_ingreso)} <span style="font-size:10px;color:var(--text3)">${m.fecha_ingreso ? fmtHora(m.fecha_ingreso) : ''}</span></td>
          <td class="mono" data-sort="${h ?? -1}" style="font-weight:600;color:${color}">${tiempo}</td>
          <td><input id="hnota-${nro}" value="${esc(nota)}" placeholder="Nota de gestión..." style="width:100%;min-width:160px;font-size:11px;padding:3px 6px"
            onblur="guardarNotaHemato('${nro}', this.value)" /></td>
          <td style="text-align:center"><input type="checkbox" ${gestionada ? 'checked' : ''} title="Gestionada"
            onchange="marcarGestionHemato('${nro}', this)" /></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="9" class="empty-state">${hematoFiltro === 'ges' ? 'No hay muestras gestionadas' : 'No hay muestras por rescatar de hematología 🎉'}</td></tr>`;
}

function copiarCodigosHemato() {
  const codigos = [...new Set(muestrasRescateHemato().filter(m => !m.gestionada).map(m => m.nro_muestra))];
  if (!codigos.length) return;
  navigator.clipboard.writeText(codigos.join('\n'))
    .then(() => toast(`${codigos.length} código${codigos.length === 1 ? '' : 's'} copiado${codigos.length === 1 ? '' : 's'}`, 'ok'))
    .catch(() => toast('No se pudo copiar al portapapeles', 'err'));
}

// ---- Gestión (misma tabla `gestiones` que usa "Pendientes por recibir") ----
// Una muestra gestionada (p. ej. le anularon el ingreso) se queda en la lista,
// coloreada y con su nota, pero ya no cuenta en el contador ni se copia.
// Sale de la lista cuando se escanea en Recepción.
async function upsertGestionHemato(od_id, nro_muestra, campos) {
  const {data: existing, error: e1} = await sb.from('gestiones').select('id').eq('od_id', od_id).maybeSingle();
  if (e1) return e1;
  const {error} = existing
    ? await sb.from('gestiones').update({ ...campos, gestionado_por: currentUser }).eq('od_id', od_id)
    : await sb.from('gestiones').insert({ od_id, nro_muestra, ...campos, gestionado_por: currentUser });
  return error;
}

function odsDelTuboHemato(nro) {
  return allMuestras.filter(m => m.nro_muestra === nro && hematoOdIds.has(m.od_id));
}

async function guardarNotaHemato(nro, texto) {
  const nota = (texto || '').trim();
  const muestras = odsDelTuboHemato(nro);
  if (!nota || muestras.every(m => (m.gestion || '') === nota)) return;
  for (const m of muestras) {
    const err = await upsertGestionHemato(m.od_id, nro, { descripcion: nota });
    if (err) { toast('Error guardando la nota: ' + err.message, 'err'); return; }
    m.gestion = nota; m.gestionado_por = currentUser;
  }
}

async function marcarGestionHemato(nro, chk) {
  const marcar = chk.checked;
  const nota = (document.getElementById('hnota-' + nro)?.value || '').trim();
  if (marcar && !nota) {
    toast('Escribe primero una nota de gestión (p. ej. "Ingreso anulado en LabCore")', 'err');
    chk.checked = false;
    document.getElementById('hnota-' + nro)?.focus();
    return;
  }
  chk.disabled = true;
  for (const m of odsDelTuboHemato(nro)) {
    const campos = { gestionada: marcar };
    if (nota) campos.descripcion = nota;
    const err = await upsertGestionHemato(m.od_id, nro, campos);
    if (err) { toast('Error: ' + err.message, 'err'); chk.checked = !marcar; chk.disabled = false; return; }
    m.gestionada = marcar;
    if (nota) m.gestion = nota;
    m.gestionado_por = currentUser;
    if (marcar) gestionadasLocal.add(m.od_id); else gestionadasLocal.delete(m.od_id);
  }
  toast(marcar ? `${nro} gestionada` : `${nro} vuelve a quedar por rescatar`, marcar ? 'ok' : 'info');
  updateBadge();
  loadRescateHemato();
}

function chipHemato(el, val) {
  document.querySelectorAll('#page-hematologia .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active'); hematoFiltro = val; loadRescateHemato();
}

// ---- Excel de hematología aparte ----
// El Excel de ingresos con hematología pesa mucho; ahora se puede descargar el de
// hematología solo y subirlo aquí. El archivo se lee en el navegador y NO se guarda:
// solo se toman los códigos de muestra con hemoleucograma, se cruzan con nuestras
// pruebas manuales de sangre que ya están en ingresos y siguen pendientes por recibir,
// y esas se marcan para rescatar. Subirlo DESPUÉS de los ingresos del mismo corte.
async function procesarHemogramas(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  toast('Leyendo hemogramas...', 'info');
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const nrosHemo = nrosConHemograma(rows);
    if (!nrosHemo.size) { toast('El archivo no trae hemoleucogramas (código 1001934)', 'err'); return; }

    // Solo se consultan los tubos del archivo (consulta pequeña, por lotes de 100)
    const nros = [...nrosHemo];
    const nuestras = [];
    for (let i = 0; i < nros.length; i += 100) {
      const {data, error} = await sb.from('v_muestras')
        .select('od_id,nro_muestra,estudio_nombre,estudio_codigo,estado')
        .in('nro_muestra', nros.slice(i, i + 100));
      if (error) { toast('Error cruzando con ingresos: ' + error.message, 'err'); return; }
      nuestras.push(...(data || []));
    }
    const manuales = nuestras.filter(m => PRUEBAS_MANUALES_SANGRE.has(nombreCorto(m.estudio_nombre, m.estudio_codigo)));
    const porRecibir = manuales.filter(m => m.estado === 'pendiente');
    const yaMarcadas = porRecibir.filter(m => hematoOdIds.has(m.od_id)).length;
    const nuevas = await marcarConHemograma(porRecibir.filter(m => !hematoOdIds.has(m.od_id)), nrosHemo);

    const tubosNuestros = new Set(manuales.map(m => m.nro_muestra)).size;
    let msg = `${nrosHemo.size} hemograma${nrosHemo.size === 1 ? '' : 's'} leído${nrosHemo.size === 1 ? '' : 's'} · ${tubosNuestros} con prueba manual nuestra`;
    msg += ` · ${nuevas} nueva${nuevas === 1 ? '' : 's'} para rescatar`;
    if (yaMarcadas) msg += ` · ${yaMarcadas} ya estaba${yaMarcadas === 1 ? '' : 'n'} en la lista`;
    toast(msg, 'ok');
    if (!tubosNuestros) toast('Ningún hemograma coincide con nuestros ingresos. ¿Ya se subió el Excel de ingresos de este corte?', 'info');
    actualizarBadgeHemato();
    await loadRescateHemato();
  } catch (err) {
    toast('Error leyendo el archivo: ' + err.message, 'err');
  }
}
