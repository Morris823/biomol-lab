// ============================================================
// PENDIENTES / GESTIONES
// ============================================================
let pendientesData = [];

let pendModo = 'pendiente'; // 'pendiente' | 'sin-validar'

async function loadPendientes() {
  if (allMuestras.length === 0) await loadMuestras({ force: true });
  pendModo = 'pendiente';
  pendientesData = allMuestras.filter(m => m.estado === 'pendiente');
  renderPendientes();
}

async function loadPendientesValidar() {
  if (allMuestras.length === 0) await loadMuestras({ force: true });
  pendModo = 'sin-validar';
  pendientesData = allMuestras.filter(m => m.estado === 'sin-validar');
  renderPendientesValidar();
}

let pvPage = 0;

function renderPendientesValidar() {
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0,10);
  let arr = pendientesData;

  const q = (document.getElementById('pv-buscar')?.value || '').trim().toLowerCase();
  if (q) {
    arr = arr.filter(m =>
      m.nro_muestra?.toLowerCase().includes(q) ||
      (m.paciente||'').toLowerCase().includes(q) ||
      (m.identificacion||'').toLowerCase().includes(q) ||
      (m.sede||'').toLowerCase().includes(q)
    );
  }

  const totalPV = arr.length;
  const totalPagPV = Math.ceil(totalPV / PAGE_SIZE) || 1;
  if (pvPage >= totalPagPV) pvPage = totalPagPV - 1;
  const paginada = arr.slice(pvPage * PAGE_SIZE, (pvPage + 1) * PAGE_SIZE);

  document.getElementById('pv-tabla').innerHTML = paginada.length
    ? paginada.map(m => {
        const prueba = nombreCorto(m.estudio_nombre, m.estudio_codigo);
        const cfg = CONFIG_PRUEBA[prueba];
        const limite = cfg?.limite || 3;
        const fechaRef = m.fecha_recepcion;
        const dias = fechaRef ? diasHabilesGlobal(new Date(fechaRef).toISOString().slice(0,10), hoyISO) : null;
        const color = dias === null ? 'var(--text3)' : dias > limite ? 'var(--red)' : dias > limite*0.7 ? 'var(--yellow)' : 'var(--green)';
        return `<tr onclick="openD('${m.od_id}')" style="cursor:pointer">
          <td class="mono">${m.nro_muestra}</td>
          <td class="mono">${m.identificacion||'—'}</td>
          <td style="font-size:11px">${m.paciente||'—'}</td>
          <td style="font-size:11px">${prueba}</td>
          <td style="font-size:11px;color:var(--text2)">${m.sede||'—'}</td>
          <td class="mono">${fmt(m.fecha_recepcion)}</td>
          <td style="text-align:center">${dias !== null ? `<span style="color:${color};font-weight:600">${dias}d</span>` : '—'}</td>
          <td style="font-size:11px;color:var(--text3)">${limite}d</td>
          <td>${pill(m.estado)}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="9" class="empty-state">Sin muestras pendientes por validar 🎉</td></tr>';

  renderPaginacion('pv-paginacion', pvPage, totalPagPV, totalPV, (p) => { pvPage = p; renderPendientesValidar(); });
}

function renderPendientes() {
  let arr = pendientesData;
  if (pendFiltro === 'sin') arr = arr.filter(m => !m.gestionada);
  if (pendFiltro === 'ges') arr = arr.filter(m => m.gestionada);
  if (pendSearch) {
    arr = arr.filter(m =>
      (m.nro_muestra||'').includes(pendSearch) ||
      (m.identificacion||'').includes(pendSearch) ||
      (m.paciente||'').toLowerCase().includes(pendSearch) ||
      (m.sede||'').toLowerCase().includes(pendSearch)
    );
  }
  const totalPend = arr.length;
  const totalPagPend = Math.ceil(totalPend / PAGE_SIZE) || 1;
  if (pendientesPage >= totalPagPend) pendientesPage = totalPagPend - 1;
  const paginadaPend = arr.slice(pendientesPage * PAGE_SIZE, (pendientesPage + 1) * PAGE_SIZE);

  document.getElementById('pend-tabla').innerHTML = paginadaPend.length
    ? paginadaPend.map(m => {
        const dias = Math.floor((Date.now() - new Date(m.fecha_ingreso)) / 86400000);
        const esGestionada = !!m.gestionada;
        const rowBg = esGestionada ? 'background:var(--green-bg)' : '';
        return `<tr style="${rowBg}">
          <td class="mono">${m.nro_muestra}</td>
          <td class="mono">${m.identificacion||'—'}</td>
          <td style="font-size:11px">${m.paciente||''}</td>
          <td style="font-size:11px">${nombreCorto(m.estudio_nombre,m.estudio_codigo)}</td>
          <td style="font-size:11px;color:var(--text2)">${m.sede||''}</td>
          <td><span style="color:${dias>5?'var(--red)':'var(--yellow)'};font-weight:500">${dias}d</span></td>
          <td>
            <input id="nota-${m.od_id}"
              style="width:100%;font-size:11px;padding:3px 7px;border-radius:4px;border:0.5px solid var(--border2);${esGestionada?'background:var(--green-bg)':''}"
              placeholder="Escribe la nota de gestión..."
              value="${(m.gestion||'').replace(/"/g,'&quot;')}"
              onblur="autoGuardarNota('${m.od_id}','${m.nro_muestra}',this.value)"
              onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}" />
          </td>
          <td style="font-size:11px;color:var(--text2)">${m.gestionado_por||'—'}</td>
          <td class="mono" style="font-size:11px;color:var(--text3)">${m.fecha_gestion ? fmt(m.fecha_gestion) : '—'}</td>
          <td style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            ${esGestionada
              ? `<button class="btn" style="padding:3px 8px;font-size:11px;color:var(--green);border-color:var(--green-border);background:var(--green-bg)"
                  onclick="marcarGestion('${m.od_id}','${m.nro_muestra}',false)"
                  title="Quitar marca de gestionada">
                  <i class="ti ti-circle-check"></i> Gest.
                </button>`
              : `<button class="btn" style="padding:3px 8px;font-size:11px;color:var(--text2)"
                  onclick="marcarGestion('${m.od_id}','${m.nro_muestra}',true)"
                  title="Marcar como gestionada">
                  <i class="ti ti-circle"></i> Gest.
                </button>`
            }
            <button class="btn" style="padding:3px 8px;font-size:11px;color:var(--green);border-color:var(--green-border)"
              onclick="validarDesdePendientes('${m.od_id}','${m.nro_muestra}')"
              title="Marcar como validada">
              <i class="ti ti-check"></i> Validar
            </button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="9" class="empty-state">Sin muestras pendientes 🎉</td></tr>';

  renderPaginacion('pend-paginacion', pendientesPage, totalPagPend, totalPend, (p) => { pendientesPage = p; renderPendientes(); });
}

// Guarda solo la nota, sin cambiar el estado de gestionada
async function autoGuardarNota(od_id, nro_muestra, desc) {
  if (!desc.trim()) return;
  const {data: existing} = await sb.from('gestiones').select('id').eq('od_id', od_id).maybeSingle();
  if (existing) {
    await sb.from('gestiones').update({ descripcion: desc, gestionado_por: currentUser }).eq('od_id', od_id);
  } else {
    await sb.from('gestiones').insert({ od_id, nro_muestra, descripcion: desc, gestionado_por: currentUser });
  }
  // Actualizar solo en memoria local sin recargar todo
  const m = allMuestras.find(x => x.od_id === od_id);
  if (m) { m.gestion = desc; m.gestionado_por = currentUser; }
  // toast silencioso — no interrumpir mientras escribe
}

// Marca o desmarca como gestionada
async function marcarGestion(od_id, nro_muestra, marcar) {
  const nota = document.getElementById('nota-' + od_id)?.value?.trim() || '';
  if (marcar && !nota) {
    toast('Escribe primero una nota de gestión antes de marcar como gestionada', 'err');
    document.getElementById('nota-' + od_id)?.focus();
    return;
  }

  const {data: existing} = await sb.from('gestiones').select('id').eq('od_id', od_id).maybeSingle();
  if (existing) {
    const {error} = await sb.from('gestiones').update({
      descripcion: nota || existing.descripcion,
      gestionado_por: currentUser,
      gestionada: marcar
    }).eq('od_id', od_id);
    if (error) { toast('Error: ' + error.message, 'err'); return; }
  } else {
    const {error} = await sb.from('gestiones').insert({
      od_id, nro_muestra, descripcion: nota, gestionado_por: currentUser, gestionada: marcar
    });
    if (error) { toast('Error: ' + error.message, 'err'); return; }
  }

  // Actualizar en memoria local directamente — no depender de v_muestras para esto
  const m = allMuestras.find(x => x.od_id === od_id);
  if (m) {
    m.gestionada = marcar;
    m.gestion = nota || m.gestion;
    m.gestionado_por = currentUser;
  }
  if (marcar) gestionadasLocal.add(od_id);
  else gestionadasLocal.delete(od_id);

  toast(marcar ? '✓ Marcada como gestionada' : 'Desmarcada — queda como pendiente', marcar ? 'ok' : 'info');
  pendientesData = allMuestras.filter(m => m.estado === 'pendiente');
  renderPendientes();
  // Actualizar dashboard en segundo plano sin bloquear la UI
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}

// Mantener compatibilidad con llamadas anteriores
async function guardarGestion(od_id, nro_muestra, desc) {
  await autoGuardarNota(od_id, nro_muestra, desc);
}

// Valida directamente desde la lista de pendientes
async function validarDesdePendientes(od_id, nro_muestra) {
  if (!confirm(`¿Marcar como VALIDADA la muestra ${nro_muestra}?\n\nEsto registrará la validación con la fecha y hora actuales.`)) return;
  const fecha_val = new Date().toISOString();
  const {error} = await sb.from('validaciones').upsert({
    od_id,
    fecha_validacion: fecha_val,
    importado_por: currentUser + ' (manual desde pendientes)',
    hasta_fecha: fecha_val
  }, { onConflict: 'od_id' });
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  // Auditoría
  sb.from('cambios_estado_manual').insert({
    od_id, estado_anterior: 'pendiente', estado_nuevo: 'validado', cambiado_por: currentUser
  }).then(({error}) => { if(error) console.warn('Tabla cambios_estado_manual no existe'); });
  toast(`✓ Muestra ${nro_muestra} marcada como validada`, 'ok');
  await loadMuestras({ force: true });
  pendientesData = allMuestras.filter(m => m.estado === 'pendiente');
  renderPendientes();
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}

function chipPend(el, val) {
  document.querySelectorAll('#page-pendientes .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active'); pendFiltro=val; renderPendientes();
}
function filterPend(q) { pendSearch=q.toLowerCase(); renderPendientes(); }

