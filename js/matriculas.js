// ============================================================
// PRUEBAS MANUALES — MATRÍCULAS
// ============================================================
let matriculaActual = null;   // objeto de la matrícula abierta
let posicionesActual = [];    // array de posiciones escaneadas

const PRUEBAS_MANUALES = ['HLA B27','HLA B57','Homocisteina','Hemocromatosis','MTHFR'];

async function initMatriculas() {
  // Buscar si hay una matrícula abierta hoy
  const hoy = new Date().toISOString().slice(0,10);
  const {data} = await sb.from('matriculas')
    .select('*')
    .eq('estado','abierta')
    .gte('created_at', hoy + 'T00:00:00')
    .order('created_at', {ascending:false})
    .limit(1);
  if (data && data.length > 0) {
    matriculaActual = data[0];
    await cargarPosiciones(matriculaActual.id);
    renderMatriculaActiva();
  } else {
    matriculaActual = null;
    posicionesActual = [];
    document.getElementById('mat-escaneo-body').innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text3)">
        <i class="ti ti-layout-grid" style="font-size:32px"></i>
        <div style="margin-top:8px;font-size:13px">Crea una nueva matrícula para comenzar a escanear</div>
      </div>`;
    document.getElementById('mat-id-label').textContent = 'Sin matrícula abierta';
  }
  await cargarHistorialMatriculas();
}

async function nuevaMatricula() {
  if (matriculaActual) {
    if (!confirm('Ya hay una matrícula abierta. ¿Cerrarla y crear una nueva?')) return;
    await cerrarMatricula(matriculaActual.id);
  }
  const hoy = new Date().toISOString().slice(0,10).replace(/-/g,'');
  // Contar matrículas del día para el consecutivo
  const {count} = await sb.from('matriculas')
    .select('*', {count:'exact', head:true})
    .gte('created_at', new Date().toISOString().slice(0,10) + 'T00:00:00');
  const consec = String((count||0) + 1).padStart(3,'0');
  const matId = `MAT-${hoy}-${consec}`;
  const {data, error} = await sb.from('matriculas').insert({
    mat_id: matId,
    estado: 'abierta',
    creada_por: currentUser
  }).select().single();
  if (error) { toast('Error creando matrícula: ' + error.message, 'err'); return; }
  matriculaActual = data;
  posicionesActual = [];
  renderMatriculaActiva();
  toast('Matrícula ' + matId + ' creada', 'ok');
}

async function cargarPosiciones(matriculaId) {
  const {data} = await sb.from('matricula_posiciones')
    .select('*')
    .eq('matricula_id', matriculaId)
    .order('posicion', {ascending:true});
  posicionesActual = data || [];
}

function renderMatriculaActiva(soloAgregarUltima = false) {
  if (!matriculaActual) return;
  const total = posicionesActual.length;
  const restantes = 48 - total;
  document.getElementById('mat-id-label').textContent = matriculaActual.mat_id + ' — ' + total + '/48 posiciones';

  // Si solo agregamos la última fila, no reconstruir todo el DOM
  if (soloAgregarUltima && total > 0) {
    const tbody = document.getElementById('mat-tbody');
    if (tbody) {
      const p = posicionesActual[posicionesActual.length - 1];
      const tr = document.createElement('tr');
      if (p.es_control) {
        tr.style.background = 'var(--teal-bg)';
        tr.innerHTML = `<td style="font-weight:600;color:var(--teal);text-align:center">${p.posicion}</td>
          <td class="mono" style="color:var(--teal)">${p.nro_muestra}</td>
          <td colspan="2" style="font-size:11px;color:var(--teal);font-weight:500"><i class="ti ti-flask-2"></i> ${p.nombre_control||'Control'}</td>
          <td><span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--teal-bg);color:var(--teal);border:0.5px solid #5EC4A1">Control</span></td>`;
      } else {
        if (p.alerta_tipo === 'duplicado') tr.style.background = 'var(--red-bg)';
        else if (p.alerta_tipo === 'mismo_paciente') tr.style.background = 'var(--yellow-bg)';
        const alerta = p.alerta_tipo === 'duplicado'
          ? `<span style="color:var(--red);font-size:10px;font-weight:500"><i class="ti ti-alert-circle"></i> Duplicado exacto</span>`
          : p.alerta_tipo === 'mismo_paciente'
          ? `<span style="color:var(--yellow);font-size:10px;font-weight:500"><i class="ti ti-alert-triangle"></i> Mismo paciente</span>`
          : '';
        tr.innerHTML = `<td style="font-weight:600;color:var(--text2);text-align:center">${p.posicion}</td>
          <td class="mono">${p.nro_muestra}</td>
          <td style="font-size:11px">${p.paciente||'—'}</td>
          <td><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--accent-bg);color:var(--accent)">${p.prueba_corta||p.estudio_nombre||'—'}</span></td>
          <td>${alerta}</td>`;
      }
      // Quitar fila de "empty state" si existe
      const emptyRow = tbody.querySelector('.empty-state');
      if (emptyRow) emptyRow.closest('tr').remove();
      tbody.appendChild(tr);
      // Scroll al final sin mover el scroll de la página
      tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // Mantener foco en el escáner
      const input = document.getElementById('mat-scan-in');
      if (input) input.focus();
      // Actualizar contador de posiciones disponibles
      const restEl = document.getElementById('mat-restantes');
      if (restEl) restEl.textContent = restantes + ' posiciones disponibles';
      return;
    }
  }

  // Renderizado completo (primera vez o al crear nueva matrícula)
  document.getElementById('mat-escaneo-body').innerHTML = `
    <div style="margin-bottom:12px">
      ${total >= 48
        ? `<div style="padding:10px 14px;background:var(--yellow-bg);border:0.5px solid var(--yellow-border);border-radius:var(--radius);font-size:12px;color:var(--yellow);margin-bottom:10px">
            <i class="ti ti-alert-triangle"></i> Matrícula completa (48/48). Ciérrala para continuar.
           </div>`
        : `<div style="font-size:11px;color:var(--text2);margin-bottom:6px">
             <i class="ti ti-info-circle"></i> Escanea el tubo — registro automático · <span id="mat-restantes">${restantes} posiciones disponibles</span>
           </div>
           <div class="scan-input-row">
             <i class="ti ti-barcode"></i>
             <input id="mat-scan-in" placeholder="Escanea el código del tubo..." autocomplete="off"
               oninput="onMatScanInput(this.value)" />
           </div>
           <div id="mat-scan-fb" class="scan-fb" style="margin-top:8px"></div>`
      }
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-yellow" onclick="cerrarMatricula('${matriculaActual.id}')"><i class="ti ti-lock"></i> Cerrar matrícula</button>
        <button class="btn btn-red" onclick="limpiarUltima()" ${total===0?'disabled':''}><i class="ti ti-backspace"></i> Quitar última</button>
        <button class="btn" onclick="copiarCodigos()" ${total===0?'disabled':''}><i class="ti ti-copy"></i> Copiar códigos</button>
      </div>
    </div>
    <div style="overflow-x:auto;max-height:420px;overflow-y:auto">
      <table>
        <thead><tr><th style="width:40px">#</th><th>Código / Control</th><th>Paciente</th><th>Prueba</th><th>Alerta</th></tr></thead>
        <tbody id="mat-tbody">
          ${posicionesActual.length
            ? posicionesActual.map(p => {
                if (p.es_control) {
                  return `<tr style="background:var(--teal-bg)">
                    <td style="font-weight:600;color:var(--teal);text-align:center">${p.posicion}</td>
                    <td class="mono" style="color:var(--teal)">${p.nro_muestra}</td>
                    <td colspan="2" style="font-size:11px;color:var(--teal);font-weight:500"><i class="ti ti-flask-2"></i> ${p.nombre_control||'Control'}</td>
                    <td><span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--teal-bg);color:var(--teal);border:0.5px solid #5EC4A1">Control</span></td>
                  </tr>`;
                }
                const alerta = p.alerta_tipo === 'duplicado'
                  ? `<span style="color:var(--red);font-size:10px;font-weight:500"><i class="ti ti-alert-circle"></i> Duplicado exacto</span>`
                  : p.alerta_tipo === 'mismo_paciente'
                  ? `<span style="color:var(--yellow);font-size:10px;font-weight:500"><i class="ti ti-alert-triangle"></i> Mismo paciente</span>`
                  : '';
                return `<tr style="${p.alerta_tipo==='duplicado'?'background:var(--red-bg)':p.alerta_tipo==='mismo_paciente'?'background:var(--yellow-bg)':''}">
                  <td style="font-weight:600;color:var(--text2);text-align:center">${p.posicion}</td>
                  <td class="mono">${p.nro_muestra}</td>
                  <td style="font-size:11px">${p.paciente||'—'}</td>
                  <td><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--accent-bg);color:var(--accent)">${p.prueba_corta||p.estudio_nombre||'—'}</span></td>
                  <td>${alerta}</td>
                </tr>`;
              }).join('')
            : '<tr><td colspan="5" class="empty-state">Sin posiciones aún — escanea la primera muestra</td></tr>'
          }
        </tbody>
      </table>
    </div>`;

  if (total < 48) setTimeout(() => { const el = document.getElementById('mat-scan-in'); if(el) el.focus(); }, 50);
}

let matScanTimer = null;
function onMatScanInput(val) {
  clearTimeout(matScanTimer);
  if (val.length >= 12) matScanTimer = setTimeout(() => procesarMatScan(val), 200);
}

async function procesarMatScan(val) {
  const input = document.getElementById('mat-scan-in');
  const fb = document.getElementById('mat-scan-fb');
  if (input) input.value = '';
  if (!matriculaActual) { toast('Crea una matrícula primero','err'); return; }
  if (posicionesActual.length >= 48) { toast('Matrícula completa — máximo 48 posiciones','err'); return; }

  // Detectar alertas
  let alertaTipo = null;
  const duplicadoExacto = posicionesActual.find(p => p.nro_muestra === val);
  const mismoPaciente = !duplicadoExacto && posicionesActual.find(p =>
    p.nro_muestra.slice(0,11) === val.slice(0,11) && p.nro_muestra !== val
  );
  if (duplicadoExacto) alertaTipo = 'duplicado';
  else if (mismoPaciente) alertaTipo = 'mismo_paciente';

  // Buscar en ingresos
  const ingreso = allMuestras.find(m => m.nro_muestra === val);
  const posicion = posicionesActual.length + 1;

  // Guardar en BD
  const {data, error} = await sb.from('matricula_posiciones').insert({
    matricula_id: matriculaActual.id,
    posicion,
    nro_muestra: val,
    od_id: ingreso?.od_id || null,
    estudio_nombre: ingreso?.estudio_nombre || null,
    prueba_corta: ingreso ? (pruebasData.find(p=>p.codigo===ingreso.estudio_codigo)?.nombre_corto||null) : null,
    paciente: ingreso?.paciente || null,
    alerta_tipo: alertaTipo,
    registrado_por: currentUser
  }).select().single();
  if (error) { toast('Error: ' + error.message, 'err'); return; }

  posicionesActual.push(data);

  // Feedback
  if (alertaTipo === 'duplicado') {
    fb.className = 'scan-fb sf-err';
    fb.innerHTML = `<strong><i class="ti ti-alert-circle"></i> ¡Duplicado exacto!</strong> El código <code>${val}</code> ya está en la posición <strong>${duplicadoExacto.posicion}</strong>. Verifícalo antes de montar.`;
  } else if (alertaTipo === 'mismo_paciente') {
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<strong><i class="ti ti-alert-triangle"></i> Mismo paciente</strong> — Los primeros 11 dígitos coinciden con la posición <strong>${mismoPaciente.posicion}</strong> (${mismoPaciente.estudio_nombre||mismoPaciente.nro_muestra}). ¿Es correcto?`;
  } else {
    fb.className = 'scan-fb sf-ok';
    fb.innerHTML = `<strong><i class="ti ti-circle-check"></i> Posición ${posicion}</strong> — ${ingreso?.paciente||val} · <span style="color:var(--accent)">${data.prueba_corta||data.estudio_nombre||'Sin ingreso'}</span>`;
  }

  renderMatriculaActiva(true); // solo agregar la última fila, sin mover el scroll
}

async function limpiarUltima() {
  if (!posicionesActual.length) return;
  const ultima = posicionesActual[posicionesActual.length - 1];
  const {error} = await sb.from('matricula_posiciones').delete().eq('id', ultima.id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  posicionesActual.pop();
  renderMatriculaActiva();
  toast('Última posición eliminada', 'ok');
}

async function cerrarMatricula(id) {
  const {error} = await sb.from('matriculas').update({estado:'cerrada', cerrada_por: currentUser}).eq('id', id);
  if (error) { toast('Error cerrando matrícula: ' + error.message, 'err'); return; }
  matriculaActual = null;
  posicionesActual = [];
  toast('Matrícula cerrada', 'ok');
  await initMatriculas();
}

async function cargarHistorialMatriculas() {
  const {data} = await sb.from('matriculas')
    .select('*, matricula_posiciones(nro_muestra, es_control)')
    .order('created_at', {ascending:false})
    .limit(30);
  const rows = data || [];
  document.getElementById('mat-hist-count').textContent = rows.length + ' matrículas';

  document.getElementById('mat-hist-tabla').innerHTML = rows.length
    ? rows.map((m, i) => {
        const posiciones = (m.matricula_posiciones || []).filter(p => !p.es_control);
        const cnt = posiciones.length;

        // Derivar estado real desde allMuestras
        let pendientes = 0, reprocesos = 0, sinValidar = 0;
        posiciones.forEach(p => {
          const muestra = allMuestras.find(x => x.nro_muestra === p.nro_muestra);
          if (!muestra) return;
          if (['pendiente','recibido','sin-validar'].includes(muestra.estado)) sinValidar++;
          if (muestra.estado === 'reproceso' || muestra.estado === 'nueva-muestra') reprocesos++;
          if (muestra.estado === 'pendiente') pendientes++;
        });

        // Cerrada = todas las muestras en validado, anulado o nueva-muestra
        const estadoReal = (sinValidar === 0 && reprocesos === 0 && cnt > 0)
          ? 'cerrada' : 'abierta';

        // Badge de alertas
        let alertas = '';
        if (reprocesos > 0) alertas += `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:var(--red-bg);color:var(--red);border:0.5px solid var(--red-border);margin-left:4px">${reprocesos} reproceso${reprocesos>1?'s':''}</span>`;
        if (sinValidar > 0 && reprocesos === 0) alertas += `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:var(--yellow-bg);color:var(--yellow);border:0.5px solid var(--yellow-border);margin-left:4px">${sinValidar} sin validar</span>`;

        return `<tr onclick="verMatricula('${m.id}')" style="cursor:pointer">
          <td style="font-weight:500;color:var(--text2)">${rows.length - i}</td>
          <td class="mono" style="font-size:11px">${m.mat_id}</td>
          <td style="font-size:11px">${fmt(m.created_at)}</td>
          <td style="text-align:center"><strong>${cnt}</strong>/48</td>
          <td style="font-size:10px;color:var(--text2)" id="pruebas-${m.id}">—</td>
          <td>${estadoReal === 'abierta'
            ? `<span class="pill s-rec"><span class="dot"></span>Abierta</span>${alertas}`
            : '<span class="pill s-val"><span class="dot"></span>Cerrada ✓</span>'}</td>
          <td style="font-size:11px;color:var(--text2)">${m.creada_por}</td>
          <td onclick="event.stopPropagation()">
            ${estadoReal === 'cerrada'
              ? `<button class="btn" style="padding:2px 7px;font-size:10px;color:var(--text3);border-color:var(--border2);cursor:not-allowed;opacity:.5" disabled title="No se puede eliminar una matrícula cerrada">
                  <i class="ti ti-lock"></i>
                </button>`
              : `<button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
                  onclick="eliminarMatricula('${m.id}','${m.mat_id}')"
                  title="Eliminar matrícula">
                  <i class="ti ti-trash"></i>
                </button>`}
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty-state">Sin matrículas registradas</td></tr>';
}

async function verMatricula(id) {
  const {data} = await sb.from('matricula_posiciones').select('*').eq('matricula_id', id).order('posicion');
  if (!data) return;

  // Guardar posiciones en variable global para que copiarCodigosRango las lea
  window._matPosiciones = data.filter(p => !p.es_control).map(p => ({pos: p.posicion, cod: p.nro_muestra}));
  const minPos = window._matPosiciones.length ? window._matPosiciones[0].pos : 1;
  const maxPos = window._matPosiciones.length ? window._matPosiciones[window._matPosiciones.length-1].pos : 1;

  const filas = data.map(p => {
    if (p.es_control) {
      return `<tr style="background:var(--teal-bg)">
        <td style="font-weight:600;text-align:center;color:var(--teal)">${p.posicion}</td>
        <td class="mono" style="color:var(--teal)">${p.nro_muestra}</td>
        <td colspan="3" style="font-size:11px;color:var(--teal)"><i class="ti ti-flask-2"></i> ${p.nombre_control||'Control'}</td>
        <td><span style="font-size:10px;padding:1px 6px;border-radius:8px;background:var(--teal-bg);color:var(--teal);border:0.5px solid #5EC4A1">Control</span></td>
      </tr>`;
    }
    const muestra = allMuestras.find(x => x.nro_muestra === p.nro_muestra);
    const estado = muestra?.estado || 'pendiente';
    const rowBg = estado === 'reproceso' || estado === 'nueva-muestra'
      ? 'background:var(--red-bg)'
      : estado === 'sin-validar' || estado === 'pendiente'
      ? 'background:var(--yellow-bg)'
      : estado === 'validado' ? 'background:var(--green-bg)' : '';
    return `<tr style="${rowBg}">
      <td style="font-weight:600;text-align:center">${p.posicion}</td>
      <td class="mono">${p.nro_muestra}</td>
      <td style="font-size:11px">${p.paciente||'—'}</td>
      <td style="font-size:10px">${p.prueba_corta||p.estudio_nombre||'—'}</td>
      <td style="font-size:10px">${p.alerta_tipo==='duplicado'?'🔴 Duplicado':p.alerta_tipo==='mismo_paciente'?'🟡 Mismo paciente':''}</td>
      <td>${pill(estado)}</td>
    </tr>`;
  }).join('');

  document.getElementById('d-title').textContent = 'Detalle de matrícula';
  document.getElementById('d-sub').textContent = data.length + ' posiciones';
  document.getElementById('d-body').innerHTML = `
    <div style="padding:12px 14px;background:var(--bg2);border-bottom:0.5px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--text2);font-weight:500"><i class="ti ti-copy"></i> Copiar códigos</span>
      <span style="font-size:11px;color:var(--text3)">Del</span>
      <input type="number" id="mat-rango-desde" value="${minPos}" min="${minPos}" max="${maxPos}"
        style="width:54px;text-align:center;font-size:12px;padding:3px 6px" />
      <span style="font-size:11px;color:var(--text3)">al</span>
      <input type="number" id="mat-rango-hasta" value="${maxPos}" min="${minPos}" max="${maxPos}"
        style="width:54px;text-align:center;font-size:12px;padding:3px 6px" />
      <button class="btn btn-primary" style="padding:4px 12px;font-size:11px" onclick="copiarCodigosRango()">
        <i class="ti ti-copy"></i> Copiar
      </button>
      <button class="btn" style="padding:4px 10px;font-size:11px;color:var(--text2)"
        onclick="document.getElementById('mat-rango-desde').value=${minPos};document.getElementById('mat-rango-hasta').value=${maxPos}">
        Todo
      </button>
    </div>
    <div style="overflow:auto;max-height:calc(100vh - 260px)">
      <table>
        <thead style="position:sticky;top:0;background:var(--surface);z-index:1"><tr><th>#</th><th>Código</th><th>Paciente</th><th>Prueba</th><th>Alerta</th><th>Estado actual</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
  document.getElementById('ov').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function copiarCodigosRango() {
  const desde = parseInt(document.getElementById('mat-rango-desde').value);
  const hasta = parseInt(document.getElementById('mat-rango-hasta').value);
  const posiciones = window._matPosiciones || [];
  if (isNaN(desde) || isNaN(hasta) || desde > hasta) { toast('Rango inválido', 'err'); return; }
  const filtradas = posiciones.filter(p => p.pos >= desde && p.pos <= hasta);
  if (!filtradas.length) { toast('Sin códigos en ese rango', 'err'); return; }
  const texto = filtradas.map(p => p.cod).join('\n');
  navigator.clipboard.writeText(texto).then(() => {
    toast(`${filtradas.length} códigos copiados (posiciones ${desde}–${hasta})`, 'ok');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = texto; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast(`${filtradas.length} códigos copiados`, 'ok');
  });
}

// ── Verificación contra pendientes ──────────────────────────────────────────
function copiarCodigos() {
  if (!posicionesActual.length) return;
  const texto = posicionesActual
    .sort((a,b) => a.posicion - b.posicion)
    .map(p => p.nro_muestra)
    .join('\n');
  navigator.clipboard.writeText(texto).then(() => {
    toast(`${posicionesActual.length} códigos copiados al portapapeles`, 'ok');
  }).catch(() => {
    // Fallback si clipboard API no está disponible
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast(`${posicionesActual.length} códigos copiados al portapapeles`, 'ok');
  });
}

async function verificarPendientes(e) {
  const file = e.target.files[0];
  if (!file) return;
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, {type:'array'});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:''});

  // Extraer códigos de muestra del archivo de pendientes
  const pendientes = rows.map(r => {
    const nro = String(r['NRO MUESTRA'] || r['CODIGO MUESTRA'] || r['NRO_MUESTRA'] || r['CÓDIGO MUESTRA'] || '').trim();
    const estudio = String(r['ESTUDIO NOMBRE'] || r['ESTUDIO'] || r['DESCRIPCION ESTUDIO'] || '').trim();
    const od = String(r['OD_ID'] || r['OD ID'] || '').trim();
    return {nro, estudio, od};
  }).filter(r => r.nro);

  if (!pendientes.length) { toast('No se encontraron códigos en el archivo','err'); return; }

  // Códigos en el montaje actual
  const enMontaje = new Set(posicionesActual.map(p => p.nro_muestra));

  // Encontrar los que NO están en el montaje
  const faltantes = pendientes.filter(p => !enMontaje.has(p.nro));

  const resultEl = document.getElementById('mat-pend-result');
  if (!faltantes.length) {
    resultEl.innerHTML = `<div style="padding:10px;background:var(--green-bg);border:0.5px solid var(--green-border);border-radius:var(--radius);font-size:12px;color:var(--green)">
      <i class="ti ti-circle-check"></i> <strong>¡Todo en orden!</strong> Todos los pendientes están en el montaje.
    </div>`;
    return;
  }

  // Para cada faltante, buscar su estado en ingresos
  const filas = faltantes.map(p => {
    const ingreso = allMuestras.find(m => m.nro_muestra === p.nro || m.od_id === p.od);
    let estadoLabel = '';
    let gestionLabel = '';
    if (!ingreso) {
      estadoLabel = '<span style="color:var(--text3);font-size:10px">No está en ingresos</span>';
    } else if (ingreso.estado === 'recibido' || ingreso.estado === 'sin-validar') {
      estadoLabel = `<span style="color:var(--accent);font-size:10px;font-weight:500"><i class="ti ti-circle-check"></i> Recibida — buscar por qué no está en montaje</span>`;
    } else if (ingreso.estado === 'pendiente') {
      estadoLabel = `<span style="color:var(--yellow);font-size:10px;font-weight:500"><i class="ti ti-clock"></i> Pendiente de recibir</span>`;
      gestionLabel = ingreso.gestion ? `<div style="font-size:10px;color:var(--teal);margin-top:2px"><i class="ti ti-message"></i> ${ingreso.gestion}</div>` : '<div style="font-size:10px;color:var(--text3)">Sin gestión registrada</div>';
    } else {
      estadoLabel = pill(ingreso.estado);
    }
    return `<tr>
      <td class="mono">${p.nro}</td>
      <td style="font-size:10px">${p.estudio||ingreso?.estudio_nombre||'—'}</td>
      <td>${estadoLabel}${gestionLabel}</td>
    </tr>`;
  });

  resultEl.innerHTML = `
    <div style="font-size:11px;font-weight:500;color:var(--red);margin-bottom:6px">
      <i class="ti ti-alert-triangle"></i> ${faltantes.length} pendiente(s) no están en el montaje
    </div>
    <div style="overflow-x:auto;max-height:300px;overflow-y:auto;border:0.5px solid var(--border);border-radius:var(--radius)">
      <table>
        <thead><tr><th>Código</th><th>Prueba</th><th>Estado</th></tr></thead>
        <tbody>${filas.join('')}</tbody>
      </table>
    </div>`;
  e.target.value = '';
}


