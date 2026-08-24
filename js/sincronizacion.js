// ============================================================
// SINCRONIZACIÓN DE ESTADO_MUESTRA (matrículas y TB)
// Consulta Supabase directamente — NO depende de allMuestras (que puede no
// tener las validadas cargadas). Solo actualiza hacia "validado", nunca
// revierte, así el estado queda permanente una vez validado.
// ============================================================
async function sincronizarEstadoMuestra(tabla, posiciones) {
  const pendientesSync = posiciones.filter(p => !p.es_control && p.estado_muestra !== 'validado');
  if (!pendientesSync.length) return;

  const nros = [...new Set(pendientesSync.map(p => p.nro_muestra))];
  const {data: ings} = await sb.from('ingresos').select('od_id,nro_muestra').in('nro_muestra', nros);
  if (!ings || !ings.length) return;

  const odIds = ings.map(i => i.od_id);
  const {data: vals} = await sb.from('validaciones').select('od_id').in('od_id', odIds);
  if (!vals || !vals.length) return;

  const validadasOdIds = new Set(vals.map(v => v.od_id));
  const nrosValidados = new Set(ings.filter(i => validadasOdIds.has(i.od_id)).map(i => i.nro_muestra));

  for (const p of pendientesSync) {
    if (nrosValidados.has(p.nro_muestra)) {
      await sb.from(tabla).update({ estado_muestra: 'validado' }).eq('id', p.id);
      p.estado_muestra = 'validado'; // reflejar en el objeto en memoria también
    }
  }
}

async function cargarHistorialMatriculas() {
  const {data} = await sb.from('matriculas')
    .select('*, matricula_posiciones(id, nro_muestra, es_control, estado_muestra)')
    .order('created_at', {ascending:false})
    .limit(30);
  const rows = data || [];
  document.getElementById('mat-hist-count').textContent = rows.length + ' matrículas';

  // Sincronizar estado de TODAS las posiciones de TODAS las matrículas cargadas
  for (const m of rows) {
    await sincronizarEstadoMuestra('matricula_posiciones', m.matricula_posiciones || []);
  }

  document.getElementById('mat-hist-tabla').innerHTML = rows.length
    ? rows.map((m, i) => {
        const posiciones = (m.matricula_posiciones || []).filter(p => !p.es_control);
        const cnt = posiciones.length;

        // Estado real desde estado_muestra (persistente, no depende de allMuestras)
        let sinValidar = 0;
        posiciones.forEach(p => {
          if (p.estado_muestra !== 'validado') sinValidar++;
        });

        const estadoReal = (sinValidar === 0 && cnt > 0) ? 'cerrada' : 'abierta';
        const alertas = sinValidar > 0
          ? `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:var(--yellow-bg);color:var(--yellow);border:0.5px solid var(--yellow-border);margin-left:4px">${sinValidar} sin validar</span>`
          : '';

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

  // Sincronizar contra Supabase directamente — actualiza permanentemente a "validado"
  await sincronizarEstadoMuestra('matricula_posiciones', data);

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
    // estado_muestra es la fuente de verdad persistente — si aún no está validado,
    // usar el estado de allMuestras como mejor esfuerzo (puede no estar cargado)
    const muestra = allMuestras.find(x => x.nro_muestra === p.nro_muestra);
    const estado = p.estado_muestra === 'validado' ? 'validado' : (muestra?.estado || 'sin-validar');
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


