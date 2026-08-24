// ============================================================
// TODAS LAS MUESTRAS — filtros
// ============================================================
let segGestionMap = {}; // nro_muestra -> última observación de seguimiento_manuales
let segGestionMapLoaded = 0;

async function cargarSegGestionMap(force = false) {
  if (!force && Date.now() - segGestionMapLoaded < 120000) return; // cache 2 min
  const {data} = await sb.from('seguimiento_manuales')
    .select('nro_muestra,observacion,estado')
    .order('fecha', { ascending: false });
  segGestionMap = {};
  (data||[]).forEach(r => {
    if (!segGestionMap[r.nro_muestra] && r.observacion) {
      segGestionMap[r.nro_muestra] = r.observacion;
    }
  });
  segGestionMapLoaded = Date.now();
}

async function applyFilters(interaccionUsuario = true) {
  // Cargar validadas bajo demanda solo cuando el usuario interactúa explícitamente
  // (no en la carga inicial de la página, para no consumir egress innecesario)
  if (interaccionUsuario) {
    const busquedaTexto = document.getElementById('q-search').value.trim();
    const necesitaValidadas = activeEstado === 'validado' || activeEstado === 'todos' || busquedaTexto.length > 3;
    if (necesitaValidadas && !validadasCargadas) {
      toast('Cargando historial de validadas...', 'info');
      await loadMuestras({ force: true, incluirValidadas: true });
    }
  }

  await cargarSegGestionMap();
  const q = document.getElementById('q-search').value.toLowerCase().trim();
  const desde = document.getElementById('f-desde').value;
  const hasta = document.getElementById('f-hasta').value;
  const ingreso = document.getElementById('f-ingreso').value;
  // Filtro por prueba: usar nombreCorto() directamente (mismo cálculo que se muestra en pantalla)
  // en vez de depender solo de la tabla pruebasData — así se filtran correctamente muestras
  // cuyo estudio_codigo no está registrado en pruebasData pero sí se resuelve por texto/fallback
  // Para filtro duplicados: contar tubos reales, no pruebas
  // Un tubo = un nro_muestra único. Varios OD_IDs con mismo nro_muestra = misma muestra, varias pruebas (NO duplicado)
  // Duplicado real = mismo nro_muestra recibido físicamente más de una vez
  let codigosDuplicados = new Set();
  if (activeEstado === 'duplicados') {
    // Paginar para traer TODAS las recepciones (Supabase limita a 1000 por query)
    const conteoRec = {};
    for (const esTB of [false, null]) {
      let from = 0;
      while (true) {
        const q = sb.from('recepciones').select('nro_muestra').range(from, from + 999);
        const {data} = esTB === null ? await q.is('es_tb', null) : await q.eq('es_tb', false);
        if (!data || data.length === 0) break;
        data.forEach(r => { conteoRec[r.nro_muestra] = (conteoRec[r.nro_muestra]||0)+1; });
        if (data.length < 1000) break;
        from += 1000;
      }
    }
    Object.entries(conteoRec).forEach(([cod,cnt]) => {
      if (cnt > 1) codigosDuplicados.add(cod);
    });
  }

  let arr = allMuestras.filter(m => {
    if (activeEstado === 'duplicados') {
      if (!codigosDuplicados.has(m.nro_muestra)) return false;
    } else if (activeEstado !== 'todos' && m.estado !== activeEstado) return false;
    if (activePrueba !== 'todas' && nombreCorto(m.estudio_nombre, m.estudio_codigo) !== activePrueba) return false;
    if (q && ![m.nro_muestra,m.identificacion,m.od_id,(m.paciente||'').toLowerCase(),(m.estudio_nombre||'').toLowerCase(),(m.sede||'').toLowerCase()].some(v=>v&&v.includes(q))) return false;
    const fr = m.fecha_recepcion ? m.fecha_recepcion.slice(0,10) : null;
    const fi = m.fecha_ingreso ? m.fecha_ingreso.slice(0,10) : null;
    if (desde && (!fr || fr < desde)) return false;
    if (hasta && (!fr || fr > hasta)) return false;
    if (ingreso && fi !== ingreso) return false;
    return true;
  });

  if (activeEstado === 'duplicados') arr.sort((a,b) => a.nro_muestra.localeCompare(b.nro_muestra));
  else if (muestrasOrdenCol !== null) {
    // Ordenar el array completo según la columna seleccionada
    const colMap = {0:'od_id',1:'nro_muestra',2:'identificacion',3:'paciente',4:'estudio_nombre',6:'sede',7:'fecha_ingreso',8:'fecha_recepcion',9:'estado'};
    const campo = colMap[muestrasOrdenCol];
    if (campo) {
      arr.sort((a,b) => {
        const av = (a[campo]||'').toString();
        const bv = (b[campo]||'').toString();
        const cmp = av.localeCompare(bv, 'es', { sensitivity: 'base' });
        return muestrasOrdenAsc ? cmp : -cmp;
      });
    }
  }

  const totalFiltrado = arr.length;
  const totalPaginas = Math.ceil(totalFiltrado / PAGE_SIZE) || 1;
  if (muestrasPage >= totalPaginas) muestrasPage = totalPaginas - 1;
  const paginada = arr.slice(muestrasPage * PAGE_SIZE, (muestrasPage + 1) * PAGE_SIZE);

  document.getElementById('total-lbl').textContent = allMuestras.length + ' totales';
  document.getElementById('results-info').textContent = activeEstado === 'duplicados'
    ? `${codigosDuplicados.size} pacientes con tubos duplicados (${totalFiltrado} registros)`
    : `${totalFiltrado} de ${allMuestras.length} muestras`;

  document.getElementById('m-tabla').innerHTML = paginada.length
    ? paginada.map(m=>`<tr onclick="openD('${m.od_id}')">
        <td class="mono">${m.od_id}</td>
        <td class="mono" style="${activeEstado==='duplicados'?'font-weight:600;color:var(--yellow)':''}">${m.nro_muestra}</td>
        <td class="mono">${m.identificacion||'—'}</td>
        <td style="font-size:11px;white-space:nowrap">${m.paciente||''}</td>
        <td style="font-size:11px">${nombreCorto(m.estudio_nombre,m.estudio_codigo)}</td>
        <td style="font-size:11px;color:var(--text2)">${m.tipo_muestra||''}</td>
        <td style="font-size:11px;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.sede||''}</td>
        <td class="mono">${fmt(m.fecha_ingreso)}</td>
        <td class="mono">${m.fecha_recepcion?fmt(m.fecha_recepcion)+' <span style="font-size:10px;color:var(--text3)">'+fmtHora(m.fecha_recepcion)+'</span>':'<span style="color:var(--text3);font-style:italic;font-family:var(--font)">No recibida</span>'}</td>
        <td>${pill(m.estado)}</td>
        <td style="font-size:11px;color:var(--text2);max-width:140px;overflow:hidden;text-overflow:ellipsis" title="${(m.gestion||'').replace(/"/g,'&quot;')}">${m.gestion||'—'}</td>
        <td style="font-size:11px;color:var(--text2);max-width:140px;overflow:hidden;text-overflow:ellipsis" title="${(segGestionMap[m.nro_muestra]||'').replace(/"/g,'&quot;')}">${segGestionMap[m.nro_muestra]||'—'}</td>
        <td onclick="event.stopPropagation()">
          <select style="font-size:10px;padding:2px 4px;border-radius:4px;border:0.5px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer"
            onchange="cambiarEstadoManual('${m.od_id}', this.value, this)">
            ${['pendiente','recibido','sin-validar','reproceso','nueva-muestra','anulado','validado'].map(s =>
              `<option value="${s}"${m.estado===s?' selected':''}>${SM[s]?SM[s].l:s}</option>`
            ).join('')}
          </select>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="11" class="empty-state">Sin resultados para los filtros aplicados</td></tr>';

  // Controles de paginación
  renderPaginacion('m-paginacion', muestrasPage, totalPaginas, totalFiltrado, (p) => { muestrasPage = p; applyFilters(); });
}

function chipEstado(el,val){
  document.querySelectorAll('#chips-estado .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active'); activeEstado=val; muestrasPage=0; muestrasOrdenCol=null; applyFilters();
}
function chipEstadoClick(el,val){ chipEstado(el,val); }
function chipPrueba(el,val){
  document.querySelectorAll('#chips-prueba .chip-prueba').forEach(c=>c.classList.remove('active'));
  el.classList.add('active'); activePrueba=val; muestrasPage=0; muestrasOrdenCol=null; applyFilters();
}

// ============================================================
// CAMBIO MANUAL DE ESTADO
// Jerarquía: validado > reproceso/nueva-muestra > sin-validar > recibido/gestionado > pendiente > anulado
// Regla: el estado superior siempre gana. Validado le gana a todo.
// ============================================================

// Orden jerárquico de mayor a menor prioridad
const ESTADO_JERARQUIA = ['anulado','validado','nueva-muestra','remitida','reproceso','sin-validar','recibido','pendiente'];
function estadoRango(e) {
  const i = ESTADO_JERARQUIA.indexOf(e);
  return i === -1 ? 99 : i; // menor índice = mayor prioridad
}

async function cambiarEstadoManual(od_id, nuevoEstado, selectEl) {
  const m = allMuestras.find(x => x.od_id === od_id);
  if (!m) return;
  const estadoAnterior = m.estado;
  if (estadoAnterior === nuevoEstado) return;

  // Bloquear degradaciones incorrectas según jerarquía
  if (estadoRango(nuevoEstado) > estadoRango(estadoAnterior)) {
    // El nuevo estado tiene menor prioridad — pedir confirmación
    if (!confirm(`⚠ Estás bajando el estado de "${SM[estadoAnterior]?.l||estadoAnterior}" a "${SM[nuevoEstado]?.l||nuevoEstado}".\n\nEsto va en contra de la jerarquía normal. ¿Confirmar de todas formas?`)) {
      selectEl.value = estadoAnterior; return;
    }
  } else if (nuevoEstado === 'validado') {
    if (!confirm(`Marcar como Validado manualmente. ¿Confirmar?`)) {
      selectEl.value = estadoAnterior; return;
    }
  }

  // Si pasa a validado, registrar en validaciones
  if (nuevoEstado === 'validado') {
    const fecha_val = new Date().toISOString();
    await sb.from('validaciones').upsert({
      od_id,
      fecha_validacion: fecha_val,
      importado_por: currentUser + ' (manual)',
      hasta_fecha: fecha_val
    }, {onConflict: 'od_id'});
  }

  // Si pasa a anulado, registrar en la tabla anulados (sin esto la vista v_muestras
  // recalcula el estado y vuelve al anterior al recargar, porque no encuentra la fila)
  if (nuevoEstado === 'anulado') {
    const motivo = prompt('Motivo de anulación (opcional):') || 'Anulado manualmente desde Todas las muestras';
    const {error: errAnula} = await sb.from('anulados').upsert({
      od_id,
      nro_muestra: m.nro_muestra,
      motivo_anulacion: motivo,
      registrado_por: currentUser
    }, {onConflict: 'od_id'});
    if (errAnula) {
      toast('Error al anular: ' + errAnula.message, 'err');
      selectEl.value = estadoAnterior;
      return;
    }
  }

  // Si se está sacando de anulado hacia otro estado, quitar la fila de anulados
  if (estadoAnterior === 'anulado' && nuevoEstado !== 'anulado') {
    await sb.from('anulados').delete().eq('od_id', od_id);
  }

  // Auditoría (tabla opcional)
  sb.from('cambios_estado_manual').insert({
    od_id, estado_anterior: estadoAnterior, estado_nuevo: nuevoEstado, cambiado_por: currentUser
  }).then(({error}) => { if(error) console.warn('Tabla cambios_estado_manual no existe — ignorar o crear con SQL del README'); });

  await loadMuestras({force:true});
  selectEl.closest('tr').querySelector('td:nth-child(10)').innerHTML = pill(nuevoEstado);
  toast(`Estado actualizado: ${SM[nuevoEstado]?.l||nuevoEstado}`, 'ok');
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}
function clearFilters(){
  document.getElementById('q-search').value='';
  document.getElementById('f-desde').value='';
  document.getElementById('f-hasta').value='';
  document.getElementById('f-ingreso').value='';
  activeEstado='todos';activePrueba='todas';
  document.querySelectorAll('#chips-estado .chip').forEach((c,i)=>c.classList.toggle('active',i===0));
  document.querySelectorAll('#chips-prueba .chip-prueba').forEach((c,i)=>c.classList.toggle('active',i===0));
  applyFilters();
}

// ============================================================
// DRAWER — detalle de muestra
// ============================================================
function openD(od_id) {
  const m = allMuestras.find(x=>x.od_id===od_id);
  if (!m) return;
  const same = allMuestras.filter(x=>x.nro_muestra===m.nro_muestra);
  document.getElementById('d-title').textContent = m.paciente || m.nro_muestra;
  document.getElementById('d-sub').textContent = m.nro_muestra + ' · OD_ID: ' + m.od_id;
  const hist = [
    {e:'Ingresado',t:fmt(m.fecha_ingreso),c:'#B4B2A9'},
    ...(m.fecha_recepcion?[{e:'Recibido en laboratorio',t:fmt(m.fecha_recepcion)+' '+fmtHora(m.fecha_recepcion),c:'var(--accent)'}]:[]),
    ...(m.fecha_reproceso?[{e:'Enviado a reproceso',t:fmt(m.fecha_reproceso),c:'#993C1D'}]:[]),
    ...(m.fecha_validacion?[{e:'Resultado validado',t:fmt(m.fecha_validacion),c:'var(--green)'}]:[]),
    ...(m.fecha_gestion?[{e:'Gestionada: '+m.gestion,t:fmt(m.fecha_gestion),c:'var(--teal)'}]:[]),
  ];
  document.getElementById('d-body').innerHTML = `
    <div class="drow"><span class="dlabel">OD_ID</span><span class="mono">${m.od_id}</span></div>
    <div class="drow"><span class="dlabel">Código muestra</span><span class="mono">${m.nro_muestra}</span></div>
    <div class="drow"><span class="dlabel">Cédula</span><span class="mono">${m.identificacion||'—'}</span></div>
    <div class="drow"><span class="dlabel">Prueba</span><span style="font-size:11px;text-align:right">${m.estudio_nombre}</span></div>
    <div class="drow"><span class="dlabel">Tipo muestra</span><span style="font-size:11px">${m.tipo_muestra||'—'}</span></div>
    <div class="drow"><span class="dlabel">Sede</span><span style="font-size:11px;text-align:right">${m.sede||'—'}</span></div>
    <div class="drow"><span class="dlabel">Estado</span><span>${pill(m.estado)}</span></div>
    ${same.length>1?`<div style="margin-top:10px;padding:8px 10px;background:var(--accent-bg);border-radius:var(--radius);font-size:11px;color:var(--accent)">
      <i class="ti ti-stack-2"></i> <strong>${same.length} pruebas</strong> en este tubo:<br>
      ${same.map(x=>`• ${nombreCorto(x.estudio_nombre,x.estudio_codigo)} — ${pill(x.estado)}`).join('<br>')}</div>`:''}
    <div style="margin-top:14px;font-size:11px;font-weight:500;margin-bottom:8px;color:var(--text2)">Línea de tiempo</div>
    ${hist.map((h,i)=>`<div class="tl-item">
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="tl-dot" style="background:${h.c}"></div>
        ${i<hist.length-1?'<div class="tl-vline"></div>':''}
      </div>
      <div style="flex:1;padding-bottom:8px">
        <div style="font-size:11px">${h.e}</div>
        <div style="font-size:10px;color:var(--text3)">${h.t}</div>
      </div></div>`).join('')}`;
  document.getElementById('ov').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}
function closeD(){
  document.getElementById('ov').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}

// ============================================================
// TOAST
// ============================================================
function toast(msg, type='ok') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast toast-'+(type==='ok'?'ok':type==='err'?'err':'info');
  t.innerHTML = `<i class="ti ${type==='ok'?'ti-circle-check':type==='err'?'ti-alert-triangle':'ti-info-circle'}"></i> ${msg}`;
  c.appendChild(t);
  setTimeout(()=>t.remove(), 3500);
}

