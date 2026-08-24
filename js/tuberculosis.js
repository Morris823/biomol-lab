// ============================================================
// TUBERCULOSIS — CORRIDAS
// ============================================================
let corridaTBActual = null;
let posicionesTB = [];
let tipoRapidoTB = '';

async function initTB() {
  const hoy = new Date().toISOString().slice(0,10);
  const {data} = await sb.from('corridas_tb')
    .select('*')
    .eq('estado','abierta')
    .gte('created_at', hoy + 'T00:00:00')
    .order('created_at', {ascending:false})
    .limit(1);
  if (data && data.length > 0) {
    corridaTBActual = data[0];
    await cargarPosicionesTB(corridaTBActual.id);
    renderCorridaTB();
  } else {
    corridaTBActual = null;
    posicionesTB = [];
    document.getElementById('tb-body').innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text3)">
        <i class="ti ti-lungs" style="font-size:32px"></i>
        <div style="margin-top:8px;font-size:13px">Crea una nueva corrida para comenzar</div>
      </div>`;
    document.getElementById('tb-id-label').textContent = 'Sin corrida abierta';
    document.getElementById('tb-btn-copiar').disabled = true;
    document.getElementById('tb-btn-cerrar').disabled = true;
  }
  await cargarHistorialTB();
}

async function nuevaCorrridaTB() {
  if (corridaTBActual) {
    if (!confirm('Ya hay una corrida abierta. ¿Cerrarla y crear una nueva?')) return;
    await cerrarCorridaTB();
  }
  const hoy = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const {count} = await sb.from('corridas_tb')
    .select('*', {count:'exact', head:true})
    .gte('created_at', new Date().toISOString().slice(0,10) + 'T00:00:00');
  const consec = String((count||0) + 1).padStart(3,'0');
  const corrId = `TB-${hoy}-${consec}`;
  const {data, error} = await sb.from('corridas_tb').insert({
    corr_id: corrId, estado: 'abierta', creada_por: currentUser
  }).select().single();
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  corridaTBActual = data;
  posicionesTB = [];
  renderCorridaTB();
  toast('Corrida ' + corrId + ' creada', 'ok');
}

async function cargarPosicionesTB(corridaId) {
  const {data} = await sb.from('corrida_tb_posiciones')
    .select('*').eq('corrida_id', corridaId)
    .order('posicion', {ascending:true});
  posicionesTB = data || [];
}

function setTipoRapido(tipo) {
  tipoRapidoTB = tipo;
  document.querySelectorAll('#tb-tipos-rapidos .chip').forEach(ch => {
    ch.classList.toggle('active', ch.textContent === tipo);
  });
  toast('Tipo de muestra: ' + tipo, 'info');
  const input = document.getElementById('tb-scan-in');
  if (input) input.focus();
}

function renderCorridaTB() {
  if (!corridaTBActual) return;
  const total = posicionesTB.length;
  document.getElementById('tb-id-label').textContent = corridaTBActual.corr_id + ' — ' + total + ' muestras';
  document.getElementById('tb-btn-copiar').disabled = total === 0;
  document.getElementById('tb-btn-cerrar').disabled = false;

  document.getElementById('tb-body').innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--text2);margin-bottom:6px">
        <i class="ti ti-info-circle"></i> Posición 1 = Control del equipo (fija) · Escaneo automático desde posición 2
        ${tipoRapidoTB ? `· Tipo activo: <strong style="color:var(--accent)">${tipoRapidoTB}</strong>` : '· <span style="color:var(--yellow)">Selecciona el tipo de muestra →</span>'}
      </div>
      <div class="scan-input-row">
        <i class="ti ti-barcode"></i>
        <input id="tb-scan-in" placeholder="Escanea el código de la muestra..." autocomplete="off"
          oninput="onTBScanInput(this.value)" />
      </div>
      <div id="tb-scan-fb" class="scan-fb" style="margin-top:8px"></div>
      <button class="btn btn-red" style="margin-top:8px" onclick="quitarUltimaTB()" ${total===0?'disabled':''}><i class="ti ti-backspace"></i> Quitar última</button>
    </div>

    <div style="overflow-x:auto;max-height:500px;overflow-y:auto">
      <table>
        <thead><tr>
          <th style="width:40px">#</th>
          <th>Código</th>
          <th>Tipo muestra</th>
          <th>Paciente</th>
          <th>Cédula</th>
          <th>Regional</th>
          <th>Ingreso</th>
          <th>Resultado</th>
          <th>Estado</th>
        </tr></thead>
        <tbody>
          <!-- Posición 1: control del equipo -->
          <tr style="background:var(--bg3)">
            <td style="font-weight:600;text-align:center;color:var(--text3)">1</td>
            <td colspan="6" style="font-size:11px;color:var(--text3);font-style:italic">Control del equipo — posición fija</td>
            <td></td>
          </tr>
          ${posicionesTB.map(p => {
            if (p.es_control) {
              return `<tr style="background:var(--teal-bg)">
                <td style="font-weight:600;text-align:center;color:var(--teal)">${p.posicion}</td>
                <td class="mono" style="color:var(--teal)">${p.nro_muestra}</td>
                <td colspan="5" style="font-size:11px;color:var(--teal);font-weight:500"><i class="ti ti-flask-2"></i> ${p.nombre_control||'Control'} <span style="opacity:.7;font-weight:400">(${p.tipo_muestra||'Control'})</span></td>
                <td>
                  <input style="width:110px;font-size:11px;padding:3px 6px;border:0.5px solid #5EC4A1;background:var(--teal-bg);border-radius:4px;color:var(--teal)"
                    value="${(p.resultado||'').replace(/"/g,'&quot;')}"
                    placeholder="Resultado..."
                    onchange="actualizarResultadoTB('${p.id}',this.value)" />
                </td>
                <td><span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--teal-bg);color:var(--teal);border:0.5px solid #5EC4A1">Control</span></td>
              </tr>`;
            }
            const tieneIngreso = !!p.od_id;
            const celdaPaciente = tieneIngreso
              ? `<td style="font-size:11px">${p.paciente||'—'}</td>`
              : `<td><input style="width:140px;font-size:11px;padding:3px 6px;border:0.5px solid var(--yellow-border);background:var(--yellow-bg);border-radius:4px"
                    value="${(p.paciente||'').replace(/"/g,'&quot;')}"
                    placeholder="Nombre paciente..."
                    onchange="actualizarDatoManualTB('${p.id}','paciente',this.value)" /></td>`;
            const celdaCedula = tieneIngreso
              ? `<td class="mono">${p.cedula||'—'}</td>`
              : `<td><input style="width:100px;font-size:11px;padding:3px 6px;border:0.5px solid var(--yellow-border);background:var(--yellow-bg);border-radius:4px"
                    value="${(p.cedula||'').replace(/"/g,'&quot;')}"
                    placeholder="Cédula..."
                    onchange="actualizarDatoManualTB('${p.id}','cedula',this.value)" /></td>`;
            const celdaSede = tieneIngreso
              ? `<td><span style="font-size:10px;padding:1px 7px;border-radius:10px;background:var(--accent-bg);color:var(--accent)">${getRegional(p.sede)}</span></td>`
              : `<td><input style="width:100px;font-size:11px;padding:3px 6px;border:0.5px solid var(--yellow-border);background:var(--yellow-bg);border-radius:4px"
                    value="${(p.sede||'').replace(/"/g,'&quot;')}"
                    placeholder="Sede..."
                    onchange="actualizarDatoManualTB('${p.id}','sede',this.value)" /></td>`;
            return `<tr${!tieneIngreso ? ' style="background:var(--yellow-bg)"' : ''}>
              <td style="font-weight:600;text-align:center">${p.posicion}</td>
              <td class="mono">${p.nro_muestra}</td>
              <td>
                <input style="width:130px;font-size:11px;padding:3px 6px"
                  value="${p.tipo_muestra||''}"
                  placeholder="Tipo..."
                  onchange="actualizarTipoTB('${p.id}',this.value)" />
              </td>
              ${celdaPaciente}
              ${celdaCedula}
              ${celdaSede}
              <td>${tieneIngreso
                ? '<span style="color:var(--green);font-size:10px;font-weight:500"><i class="ti ti-circle-check"></i> Sí</span>'
                : '<span style="color:var(--yellow);font-size:10px;font-weight:500"><i class="ti ti-alert-triangle"></i> No</span>'}</td>
              <td>
                <input style="width:110px;font-size:11px;padding:3px 6px"
                  value="${p.resultado||''}"
                  placeholder="Resultado..."
                  onchange="actualizarResultadoTB('${p.id}',this.value)" />
              </td>
              <td>${p.estado_muestra==='validado'
                ? '<span class="pill s-val"><span class="dot"></span>Validado</span>'
                : '<span class="pill s-sinval"><span class="dot"></span>Sin validar</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  setTimeout(() => { const el = document.getElementById('tb-scan-in'); if(el) el.focus(); }, 100);
}

let tbScanTimer = null;
function onTBScanInput(val) {
  clearTimeout(tbScanTimer);
  if (val.length >= 12) tbScanTimer = setTimeout(() => procesarTBScan(val), 200);
}

async function procesarTBScan(val) {
  const input = document.getElementById('tb-scan-in');
  const fb = document.getElementById('tb-scan-fb');
  if (input) input.value = '';
  if (!corridaTBActual) { toast('Crea una corrida primero','err'); return; }

  // Duplicado exacto
  const dup = posicionesTB.find(p => p.nro_muestra === val);
  if (dup) {
    fb.className = 'scan-fb sf-err';
    fb.innerHTML = `<strong><i class="ti ti-alert-circle"></i> ¡Duplicado!</strong> El código <code>${val}</code> ya está en la posición <strong>${dup.posicion}</strong>.`;
    return;
  }

  const ingreso = allMuestras.find(m => m.nro_muestra === val);
  const posicion = posicionesTB.length + 2; // empieza en 2
  const estadoMuestra = ingreso?.estado === 'validado' ? 'validado' : 'sin-validar';

  const {data, error} = await sb.from('corrida_tb_posiciones').insert({
    corrida_id: corridaTBActual.id,
    posicion,
    nro_muestra: val,
    od_id: ingreso?.od_id || null,
    paciente: ingreso?.paciente || null,
    cedula: ingreso?.identificacion || null,
    sede: ingreso?.sede || null,
    tipo_muestra: tipoRapidoTB || null,
    estado_muestra: estadoMuestra,
    registrado_por: currentUser
  }).select().single();

  if (error) { toast('Error: ' + error.message, 'err'); return; }
  posicionesTB.push(data);

  if (estadoMuestra === 'validado') {
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<strong><i class="ti ti-alert-triangle"></i> Posición ${posicion} — ${ingreso?.paciente||val}</strong><br>
      <span style="font-size:11px;color:var(--yellow)">⚠ Esta muestra ya está <strong>validada</strong> — no es necesario procesarla nuevamente.</span>`;
  } else if (!ingreso) {
    // Sin ingreso: mostrar mini-formulario inline para capturar datos en la posición
    fb.className = 'scan-fb sf-dup';
    fb.style.display = 'block';
    fb.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <i class="ti ti-alert-triangle" style="color:var(--yellow)"></i>
        <strong>Posición ${posicion} — sin ingreso registrado</strong>
        <span style="font-size:10px;color:var(--text3);margin-left:auto">Llena los datos para continuar</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:6px">
        <div>
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px;text-transform:uppercase">Paciente</div>
          <input id="tb-manual-pac" placeholder="Nombre completo" style="width:100%;font-size:11px;padding:4px 7px" />
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px;text-transform:uppercase">Cédula</div>
          <input id="tb-manual-ced" placeholder="Número doc." style="width:100%;font-size:11px;padding:4px 7px" />
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px;text-transform:uppercase">Sede</div>
          <input id="tb-manual-sede" placeholder="Sede de origen" style="width:100%;font-size:11px;padding:4px 7px" />
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary" style="font-size:11px;padding:4px 10px"
          onclick="guardarDatosManualesTB('${data.id}', ${posicion})">
          <i class="ti ti-check"></i> Guardar datos
        </button>
        <button class="btn" style="font-size:11px;padding:4px 10px;color:var(--text3)"
          onclick="this.closest('.scan-fb').style.display='none'">
          Omitir
        </button>
      </div>`;
    setTimeout(() => document.getElementById('tb-manual-pac')?.focus(), 50);
    renderCorridaTB();
    return; // No renderizar de nuevo al final
  } else {
    fb.className = 'scan-fb sf-ok';
    fb.innerHTML = `<strong><i class="ti ti-circle-check"></i> Posición ${posicion} — ${ingreso.paciente}</strong> · Cédula: ${ingreso.identificacion||'—'}`;
  }

  renderCorridaTB();
}

async function actualizarDatoManualTB(id, campo, valor) {
  const update = {};
  update[campo] = valor || null;
  const {error} = await sb.from('corrida_tb_posiciones').update(update).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  // Actualizar en memoria sin re-renderizar toda la tabla
  const p = posicionesTB.find(x => x.id === id);
  if (p) p[campo] = valor || null;
  // toast silencioso — no interrumpir mientras escribe
}

async function actualizarTipoTB(id, valor) {
  await sb.from('corrida_tb_posiciones').update({tipo_muestra: valor}).eq('id', id);
  const p = posicionesTB.find(x => x.id === id);
  if (p) p.tipo_muestra = valor;
}

async function actualizarResultadoTB(id, valor) {
  await sb.from('corrida_tb_posiciones').update({resultado: valor}).eq('id', id);
  const p = posicionesTB.find(x => x.id === id);
  if (p) p.resultado = valor;
}

async function actualizarResultadoTBHistorico(id, valor) {
  const {error} = await sb.from('corrida_tb_posiciones').update({resultado: valor}).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Resultado guardado', 'ok');
}

async function quitarUltimaTB() {
  if (!posicionesTB.length) return;
  const ultima = posicionesTB[posicionesTB.length - 1];
  const {error} = await sb.from('corrida_tb_posiciones').delete().eq('id', ultima.id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  posicionesTB.pop();
  renderCorridaTB();
  toast('Última posición eliminada', 'ok');
}

async function cerrarCorridaTB() {
  if (!corridaTBActual) return;
  if (!confirm('¿Cerrar la corrida ' + corridaTBActual.corr_id + '?')) return;
  await sb.from('corridas_tb').update({estado:'cerrada', cerrada_por: currentUser}).eq('id', corridaTBActual.id);
  corridaTBActual = null;
  posicionesTB = [];
  toast('Corrida cerrada', 'ok');
  await initTB();
}

function copiarCodigosTB() {
  if (!posicionesTB.length) return;
  const texto = posicionesTB
    .sort((a,b) => a.posicion - b.posicion)
    .map(p => p.nro_muestra)
    .join('\n');
  navigator.clipboard.writeText(texto).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  });
  toast(posicionesTB.length + ' códigos copiados', 'ok');
}

async function cargarHistorialTB() {
  const {data} = await sb.from('corridas_tb')
    .select('*, corrida_tb_posiciones(id, nro_muestra, es_control, estado_muestra)')
    .order('created_at', {ascending:false}).limit(20);
  const rows = data || [];
  document.getElementById('tb-hist-count').textContent = rows.length + ' corridas';

  // Sincronizar y actualizar estado 'cerrada' de la corrida si todo quedó validado
  for (const r of rows) {
    await sincronizarEstadoMuestra('corrida_tb_posiciones', r.corrida_tb_posiciones || []);
    const posSinControl = (r.corrida_tb_posiciones || []).filter(p => !p.es_control);
    const todasValidadas = posSinControl.length > 0 && posSinControl.every(p => p.estado_muestra === 'validado');
    if (todasValidadas && r.estado !== 'cerrada') {
      await sb.from('corridas_tb').update({ estado: 'cerrada' }).eq('id', r.id);
      r.estado = 'cerrada';
    }
  }

  document.getElementById('tb-hist-tabla').innerHTML = rows.length
    ? rows.map((r,i) => {
        const cnt = (r.corrida_tb_posiciones || []).length;
        return `<tr onclick="verCorridaTB('${r.id}')" style="cursor:pointer">
          <td style="font-weight:500;color:var(--text2)">${rows.length-i}</td>
          <td class="mono" style="font-size:11px">${r.corr_id}</td>
          <td style="font-size:11px">${fmt(r.created_at)}</td>
          <td style="text-align:center"><strong>${cnt}</strong></td>
          <td>${r.estado==='abierta'
            ? '<span class="pill s-rec"><span class="dot"></span>Abierta</span>'
            : '<span class="pill s-val"><span class="dot"></span>Cerrada</span>'}</td>
          <td style="font-size:11px;color:var(--text2)">${r.creada_por}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
              onclick="eliminarCorridaTB('${r.id}','${r.corr_id}')"
              title="Eliminar corrida">
              <i class="ti ti-trash"></i>
            </button>
          </td>
        </tr>`;}).join('')
    : '<tr><td colspan="6" class="empty-state">Sin corridas registradas</td></tr>';
}

async function verCorridaTB(id) {
  const {data} = await sb.from('corrida_tb_posiciones').select('*').eq('corrida_id', id).order('posicion');
  if (!data) return;

  // Sincronizar contra Supabase — actualiza permanentemente a "validado"
  await sincronizarEstadoMuestra('corrida_tb_posiciones', data);

  document.getElementById('d-title').textContent = 'Detalle corrida TB';
  document.getElementById('d-sub').textContent = data.length + ' muestras (+ posición 1 control)';
  document.getElementById('d-body').innerHTML = `
    <div style="overflow:auto;max-height:calc(100vh - 260px)">
      <table>
        <thead style="position:sticky;top:0;background:var(--surface);z-index:1"><tr><th>#</th><th>Código</th><th>Tipo</th><th>Paciente</th><th>Resultado</th><th>Estado</th></tr></thead>
        <tbody>
          <tr style="background:var(--bg3)">
            <td style="text-align:center;color:var(--text3)">1</td>
            <td colspan="4" style="font-size:10px;color:var(--text3);font-style:italic">Control del equipo</td>
            <td></td>
          </tr>
          ${data.map(p=>`<tr>
            <td style="font-weight:600;text-align:center">${p.posicion}</td>
            <td class="mono">${p.nro_muestra}</td>
            <td style="font-size:10px">${p.tipo_muestra||'—'}</td>
            <td style="font-size:10px">${p.paciente||'—'}</td>
            <td style="font-size:10px"><span style="padding:1px 6px;border-radius:8px;background:var(--accent-bg);color:var(--accent)">${getRegional(p.sede)}</span></td>
            <td style="font-size:10px">
              <input style="width:100px;font-size:11px;padding:2px 6px"
                value="${(p.resultado||'').replace(/"/g,'&quot;')}"
                placeholder="Resultado..."
                onblur="actualizarResultadoTBHistorico('${p.id}',this.value)" />
            </td>
            <td>${p.estado_muestra==='validado'
              ? '<span class="pill s-val"><span class="dot"></span>Validado</span>'
              : '<span class="pill s-sinval"><span class="dot"></span>Sin validar</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  document.getElementById('ov').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}


