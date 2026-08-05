// ============================================================
// REMISIONES
// ============================================================
let remisionActual = null;
let posicionesRemision = [];

function initRemisiones() {
  cargarHistorialRemisiones();
  // Si hay una remisión abierta la más reciente, cargarla
  cargarRemisionAbierta();
}

async function cargarRemisionAbierta() {
  const {data} = await sb.from('remisiones').select('*').eq('estado','abierta').order('created_at',{ascending:false}).limit(1);
  if (data && data.length) {
    remisionActual = data[0];
    await cargarPosicionesRemision(remisionActual.id);
    renderRemisionActiva();
  } else {
    remisionActual = null;
    posicionesRemision = [];
    renderRemisionActiva();
  }
}

async function nuevaRemision() {
  if (remisionActual) {
    if (!confirm('Ya hay una remisión abierta. ¿Cerrarla y crear una nueva?')) return;
    await cerrarRemision(remisionActual.id);
  }
  // Generar código automático: "Remision" + fecha ddMMyyyy
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2,'0');
  const mm = String(hoy.getMonth()+1).padStart(2,'0');
  const yyyy = hoy.getFullYear();
  const codigoAuto = `Remision${dd}${mm}${yyyy}`;

  const {data, error} = await sb.from('remisiones').insert({
    codigo_remision: codigoAuto,
    estado: 'abierta',
    creada_por: currentUser
  }).select().single();
  if (error) { toast('Error creando remisión: ' + error.message, 'err'); return; }
  remisionActual = data;
  posicionesRemision = [];
  renderRemisionActiva();
  toast('Remisión ' + codigoAuto + ' creada', 'ok');
}

async function cargarPosicionesRemision(remisionId) {
  const {data} = await sb.from('remision_posiciones').select('*').eq('remision_id', remisionId).order('created_at',{ascending:true});
  posicionesRemision = data || [];
}

function renderRemisionActiva() {
  if (!remisionActual) {
    document.getElementById('rem-id-label').textContent = 'Sin remisión abierta';
    document.getElementById('rem-escaneo-body').innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text3)">
        <i class="ti ti-send" style="font-size:32px"></i>
        <div style="margin-top:8px;font-size:13px">Crea una nueva remisión para comenzar a escanear</div>
      </div>`;
    return;
  }

  document.getElementById('rem-id-label').innerHTML = `
    <input id="rem-codigo-edit" value="${remisionActual.codigo_remision}" style="font-size:12px;padding:2px 8px;width:180px"
      onblur="actualizarCodigoRemision(this.value)" /> — ${posicionesRemision.length} muestras`;

  document.getElementById('rem-escaneo-body').innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px">
        <i class="ti ti-info-circle"></i> Escanea el tubo — registro automático, sin ventanas emergentes. La edad se agrega al final.
      </div>
      <div class="scan-input-row">
        <i class="ti ti-barcode"></i>
        <input id="rem-scan-in" placeholder="Escanea el código del tubo..." autocomplete="off"
          oninput="onRemScanInput(this.value)" />
      </div>
      <div id="rem-scan-fb" class="scan-fb" style="margin-top:8px"></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-yellow" onclick="cerrarRemision('${remisionActual.id}')"><i class="ti ti-lock"></i> Cerrar remisión</button>
        <button class="btn" onclick="copiarParaColcan()" ${posicionesRemision.length===0?'disabled':''}><i class="ti ti-copy"></i> Copiar para Colcan</button>
        <button class="btn" onclick="generarPDFRemision()" ${posicionesRemision.length===0?'disabled':''}><i class="ti ti-file-type-pdf"></i> Generar PDF</button>
      </div>
    </div>
    <div style="overflow:auto;max-height:450px">
      <table>
        <thead style="position:sticky;top:0;background:var(--surface)">
          <tr><th>Cód. Colcan</th><th>Prueba</th><th>Código muestra</th><th>Observación</th><th>Identificación</th><th>Apellidos</th><th>Nombres</th><th>Edad</th><th></th></tr>
        </thead>
        <tbody id="rem-tbody">
          ${posicionesRemision.length
            ? posicionesRemision.map(p => `<tr>
                <td class="mono" style="text-align:center">${p.codigo_colcan||'—'}</td>
                <td style="font-size:11px">${nombreCompletoColcan(p.codigo_colcan) || nombreCorto(p.estudio_nombre,'') || '—'}</td>
                <td class="mono">${p.nro_muestra}</td>
                <td style="font-size:10px;color:var(--text2)">${p.observacion||'—'}</td>
                <td class="mono">${p.identificacion||'—'}</td>
                <td style="font-size:11px">${p.apellidos||'—'}</td>
                <td style="font-size:11px">${p.nombres||'—'}</td>
                <td>
                  <input type="number" value="${p.edad ?? ''}" placeholder="—"
                    style="width:55px;font-size:11px;padding:2px 4px;text-align:center"
                    onblur="actualizarEdadRemision('${p.id}',this.value)" />
                </td>
                <td><button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
                  onclick="eliminarPosicionRemision('${p.id}')"><i class="ti ti-trash"></i></button></td>
              </tr>`).join('')
            : '<tr><td colspan="9" class="empty-state">Sin muestras aún — escanea la primera</td></tr>'
          }
        </tbody>
      </table>
    </div>`;

  setTimeout(() => { const el = document.getElementById('rem-scan-in'); if(el) el.focus(); }, 50);
}

async function actualizarCodigoRemision(nuevoCodigo) {
  if (!nuevoCodigo.trim() || nuevoCodigo === remisionActual.codigo_remision) return;
  await sb.from('remisiones').update({ codigo_remision: nuevoCodigo.trim() }).eq('id', remisionActual.id);
  remisionActual.codigo_remision = nuevoCodigo.trim();
  toast('Código de remisión actualizado', 'ok');
}

async function actualizarEdadRemision(id, edad) {
  const edadNum = edad ? parseInt(edad) : null;
  await sb.from('remision_posiciones').update({ edad: edadNum }).eq('id', id);
  const p = posicionesRemision.find(x => x.id === id);
  if (p) p.edad = edadNum;
}

function nombreCompletoColcan(codigoColcan) {
  if (codigoColcan === '0118') return 'Metilen Tetrahidrofolato Reductasa (MTHFR)- Mutacion del Gen C677-T';
  if (codigoColcan === '0146') return 'Hemocromatosis hereditaria - Mutacion del gen HFE (C282Y, H63D, S65C)';
  return '';
}

function copiarParaColcan() {
  // Columnas A-H exactas para pegar en el formato Colcan
  const filas = posicionesRemision.map(p => [
    p.codigo_colcan || '',
    nombreCompletoColcan(p.codigo_colcan) || nombreCorto(p.estudio_nombre,'') || '',
    p.nro_muestra || '',
    p.observacion || '',
    p.identificacion || '',
    p.apellidos || '',
    p.nombres || '',
    p.edad ?? ''
  ].join('\t'));
  const texto = filas.join('\n');
  navigator.clipboard.writeText(texto).then(() => toast(`${posicionesRemision.length} filas copiadas — listas para pegar en Colcan`, 'ok'));
}

function generarPDFRemision() {
  const filasHTML = posicionesRemision.map((p, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${p.codigo_colcan||'—'}</td>
      <td>${nombreCompletoColcan(p.codigo_colcan) || nombreCorto(p.estudio_nombre,'') || '—'}</td>
      <td>${p.nro_muestra||'—'}</td>
      <td>${p.observacion||'—'}</td>
      <td>${p.identificacion||'—'}</td>
      <td>${p.apellidos||'—'}</td>
      <td>${p.nombres||'—'}</td>
      <td>${p.edad ?? '—'}</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Remisión ${remisionActual.codigo_remision}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1A1A18; }
        h1 { font-size: 18px; margin-bottom: 2px; }
        .sub { font-size: 12px; color: #5F5E5A; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #CECDCA; padding: 6px 8px; text-align: left; }
        th { background: #EFEFED; font-weight: 600; }
        .footer { margin-top: 24px; font-size: 11px; color: #5F5E5A; display:flex; justify-content:space-between; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <h1>Remisión de muestras — ${remisionActual.codigo_remision}</h1>
      <div class="sub">BioMol Lab — Biología Molecular · Fecha de generación: ${new Date().toLocaleDateString('es-CO')} · Remitido por: ${remisionActual.creada_por} · Total muestras: ${posicionesRemision.length}</div>
      <table>
        <thead>
          <tr><th>#</th><th>Cód. Colcan</th><th>Prueba</th><th>Código muestra</th><th>Observación</th><th>Identificación</th><th>Apellidos</th><th>Nombres</th><th>Edad</th></tr>
        </thead>
        <tbody>${filasHTML}</tbody>
      </table>
      <div class="footer">
        <span>Firma quien remite: ______________________</span>
        <span>Firma quien recibe: ______________________</span>
      </div>
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

let remScanTimer = null;
function onRemScanInput(val) {
  clearTimeout(remScanTimer);
  if (val.length >= 6) remScanTimer = setTimeout(() => procesarScanRemision(val), 250);
}

async function procesarScanRemision(codigo) {
  document.getElementById('rem-scan-in').value = '';
  const fb = document.getElementById('rem-scan-fb');

  if (posicionesRemision.find(p => p.nro_muestra === codigo)) {
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<i class="ti ti-alert-triangle"></i> <strong>${codigo}</strong> ya está en esta remisión`;
    setTimeout(() => document.getElementById('rem-scan-in').focus(), 50);
    return;
  }

  const muestra = allMuestras.find(m => m.nro_muestra === codigo);
  if (!muestra) {
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<i class="ti ti-alert-circle"></i> Código <strong>${codigo}</strong> no encontrado en el sistema`;
    setTimeout(() => document.getElementById('rem-scan-in').focus(), 50);
    return;
  }

  // Observación siempre es fija
  const OBS_FIJA = 'Sangre Total en Refrigeracion  5-8°C';

  // Código Colcan según la prueba
  const prueba = nombreCorto(muestra.estudio_nombre, muestra.estudio_codigo);
  let codigoColcan = '';
  if (prueba === 'MTHFR' || prueba === 'Homocist.') codigoColcan = '0118';
  else if (prueba === 'Hemocr.') codigoColcan = '0146';

  const {data, error} = await sb.from('remision_posiciones').insert({
    remision_id: remisionActual.id,
    nro_muestra: codigo,
    od_id: muestra.od_id,
    estudio_nombre: muestra.estudio_nombre,
    observacion: OBS_FIJA,
    codigo_colcan: codigoColcan,
    identificacion: muestra.identificacion,
    apellidos: muestra.apellidos,
    nombres: muestra.nombres
  }).select().single();

  if (error) { toast('Error: ' + error.message, 'err'); return; }

  posicionesRemision.push(data);
  fb.className = 'scan-fb sf-ok';
  fb.innerHTML = `<i class="ti ti-circle-check"></i> <strong>${muestra.paciente||codigo}</strong> agregada a la remisión`;
  renderRemisionActiva();
}

async function eliminarPosicionRemision(id) {
  if (!confirm('¿Quitar esta muestra de la remisión?')) return;
  await sb.from('remision_posiciones').delete().eq('id', id);
  posicionesRemision = posicionesRemision.filter(p => p.id !== id);
  renderRemisionActiva();
  toast('Muestra removida de la remisión', 'ok');
}

function copiarCodigosRemision() {
  const texto = posicionesRemision.map(p => p.nro_muestra).join('\n');
  navigator.clipboard.writeText(texto).then(() => toast(`${posicionesRemision.length} códigos copiados`, 'ok'));
}

async function cerrarRemision(id) {
  const {error} = await sb.from('remisiones').update({ estado: 'cerrada' }).eq('id', id);
  if (error) { toast('Error cerrando remisión: ' + error.message, 'err'); return; }
  remisionActual = null;
  posicionesRemision = [];
  renderRemisionActiva();
  cargarHistorialRemisiones();
  toast('Remisión cerrada', 'ok');
}

async function cargarHistorialRemisiones() {
  const {data} = await sb.from('remisiones')
    .select('*, remision_posiciones(nro_muestra)')
    .order('created_at', {ascending:false})
    .limit(30);
  const rows = data || [];
  document.getElementById('rem-hist-count').textContent = rows.length + ' remisiones';

  document.getElementById('rem-hist-tabla').innerHTML = rows.length
    ? rows.map((r, i) => {
        const nros = (r.remision_posiciones||[]).map(p => p.nro_muestra);
        const cnt = nros.length;
        // Verificar si todas están validadas o nueva-muestra
        let todasOk = cnt > 0;
        nros.forEach(nro => {
          const m = allMuestras.find(x => x.nro_muestra === nro);
          if (!m || (m.estado !== 'validado' && m.estado !== 'nueva-muestra')) todasOk = false;
        });
        const estadoReal = r.estado === 'cerrada' ? 'cerrada' : (todasOk ? 'lista_para_cerrar' : 'abierta');

        return `<tr onclick="verRemision('${r.id}')" style="cursor:pointer">
          <td style="font-weight:500;color:var(--text2)">${rows.length - i}</td>
          <td class="mono" style="font-size:11px">${r.codigo_remision}</td>
          <td style="font-size:11px">${fmt(r.created_at)}</td>
          <td style="text-align:center"><strong>${cnt}</strong></td>
          <td>${r.estado==='cerrada'
            ? '<span class="pill s-val"><span class="dot"></span>Cerrada</span>'
            : estadoReal === 'lista_para_cerrar'
            ? '<span class="pill s-rec"><span class="dot"></span>Remitida ✓</span>'
            : '<span class="pill s-rec"><span class="dot"></span>Abierta</span>'}</td>
          <td style="font-size:11px;color:var(--text2)">${r.creada_por}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
              onclick="eliminarRemision('${r.id}','${r.codigo_remision}')" title="Eliminar remisión">
              <i class="ti ti-trash"></i>
            </button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty-state">Sin remisiones registradas</td></tr>';
}

async function verRemision(id) {
  const {data} = await sb.from('remision_posiciones').select('*').eq('remision_id', id).order('created_at');
  if (!data) return;

  const filas = data.map(p => {
    const muestra = allMuestras.find(m => m.nro_muestra === p.nro_muestra);
    const estado = muestra?.estado || 'pendiente';
    return `<tr>
      <td class="mono">${p.nro_muestra}</td>
      <td class="mono">${p.identificacion||'—'}</td>
      <td style="font-size:11px">${(p.apellidos||'')+', '+(p.nombres||'')}</td>
      <td><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--accent-bg);color:var(--accent)">${nombreCorto(p.estudio_nombre,'')||'—'}</span></td>
      <td style="font-size:11px">${p.observacion||'—'}</td>
      <td>${pill(estado)}</td>
    </tr>`;
  }).join('');

  document.getElementById('d-title').textContent = 'Detalle de remisión';
  document.getElementById('d-sub').textContent = data.length + ' muestras';
  document.getElementById('d-body').innerHTML = `
    <div style="overflow:auto;max-height:calc(100vh - 260px)">
      <table>
        <thead style="position:sticky;top:0;background:var(--surface)"><tr><th>Código</th><th>Cédula</th><th>Nombre</th><th>Prueba</th><th>Observación</th><th>Estado</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
  document.getElementById('ov').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

async function eliminarRemision(id, codigo) {
  if (!confirm(`¿Eliminar la remisión ${codigo} y todas sus posiciones?\n\nEsta acción no se puede deshacer.`)) return;
  await sb.from('remision_posiciones').delete().eq('remision_id', id);
  const {error} = await sb.from('remisiones').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast(`Remisión ${codigo} eliminada`, 'ok');
  cargarHistorialRemisiones();
}

