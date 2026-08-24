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

