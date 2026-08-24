// ============================================================
// RECEPCION — escaneo
// ============================================================
function onScanInput(val) {
  clearTimeout(scanTimer);
  if (val.length >= 12) scanTimer = setTimeout(() => processScan(val), 200);
}

async function processScan(val) {
  document.getElementById('scan-in').value = '';
  const fb = document.getElementById('scan-fb');
  // Verificar duplicado en sesión actual — advertir pero NO bloquear
  const alreadyThis = recepciones.find(r => r.cod === val);
  const esDuplicado = !!alreadyThis;

  // Verificar si ya está en BD (turno anterior)
  // Buscar si ya existe en BD (puede haber más de una — no usamos maybeSingle)
  const {data: recsExist} = await sb.from('recepciones').select('id,fecha_recepcion').eq('nro_muestra', val).order('fecha_recepcion', {ascending:false});
  const recExist = recsExist && recsExist.length > 0 ? recsExist[0] : null;
  const esDuplicadoBD = !!recExist && !esDuplicado;
  // Buscar en ingresos
  const pruebas = allMuestras.filter(m => m.nro_muestra === val);
  const sinIngreso = pruebas.length === 0;

  // Registrar recepción — con o sin ingreso
  const {error} = await sb.from('recepciones').insert({
    nro_muestra: val,
    recibido_por: currentUser,
    sin_ingreso: sinIngreso
  });
  if (error) { toast('Error al registrar: ' + error.message, 'err'); return; }

  const hora = new Date().toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});

  if (sinIngreso) {
    // Recibida pero sin ingreso en el sistema
    recepciones.unshift({hora, cod: val, pac: '⚠ Sin ingreso', pruebas: ['Sin ingreso en sistema'], sinIngreso: true});
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<strong><i class="ti ti-alert-triangle"></i> Recibida — pero sin ingreso en el sistema</strong><br>
      <span style="font-size:11px">El código <code>${val}</code> no está en los ingresos cargados. Fue registrado como <strong>"recibida sin ingreso"</strong> para revisión posterior.<br>
      Verifica que los ingresos del día estén subidos o consulta con el biólogo.</span>`;
  } else {
    // Deduplicar nombres de prueba por si hay múltiples OD_ID con el mismo nombre para este tubo
    const nombresUnicos = [...new Set(pruebas.map(p => nombreCorto(p.estudio_nombre, p.estudio_codigo)))];
    const nombresPruebas = nombresUnicos;
    recepciones.unshift({hora, cod: val, pac: pruebas[0].paciente, pruebas: nombresPruebas});
  if (esDuplicado || esDuplicadoBD) {
    scanDups++;
    const hora_ant = esDuplicado ? alreadyThis.hora : fmtHora(recExist.fecha_recepcion);
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<strong><i class="ti ti-alert-triangle"></i> Duplicado registrado — ${pruebas[0].paciente||val}</strong>
      <div style="font-size:11px;margin-top:4px">Ya escaneado ${esDuplicado?`a las ${hora_ant} en este turno`:'en un turno anterior'}. Registrado de nuevo — hay múltiples tubos con este código.</div>
      ${nombresPruebas.map(p=>`<div class="prueba-row"><span>${p}</span>${pill('recibido')}</div>`).join('')}`;
  } else {
    fb.className = 'scan-fb sf-ok';
    fb.innerHTML = `<strong><i class="ti ti-circle-check"></i> Recibido — ${pruebas[0].paciente||val}</strong>
      ${nombresPruebas.map(p=>`<div class="prueba-row"><span>${p}</span>${pill('recibido')}</div>`).join('')}
      ${nombresPruebas.length>1?`<div style="margin-top:5px;font-size:10px;color:var(--teal)"><i class="ti ti-stack-2"></i> Este tubo tiene <strong>${nombresPruebas.length} pruebas</strong></div>`:''}`;
  }
  }

  await loadMuestras({force:true});
  renderRecepcion();
  updateScanStats();
}

async function loadRecepciones() {
  // Traer recepciones de HOY desde Supabase
  const hoy = new Date().toISOString().slice(0,10); // YYYY-MM-DD
  const {data, error} = await sb.from('recepciones')
    .select('*')
    .gte('fecha_recepcion', hoy + 'T00:00:00')
    .lte('fecha_recepcion', hoy + 'T23:59:59')
    .order('fecha_recepcion', {ascending: false});
  if (error) { toast('Error cargando recepciones: ' + error.message, 'err'); return; }

  // Separar TB del array principal
  const dataNormal = (data || []).filter(r => !r.es_tb);
  const dataTB = (data || []).filter(r => r.es_tb);

  recepciones = dataNormal.map(r => {
    const muestrasRec = allMuestras.filter(m => m.nro_muestra === r.nro_muestra);
    const pruebasUnicas = [...new Set(muestrasRec.map(m => nombreCorto(m.estudio_nombre, m.estudio_codigo)))];
    const pac = allMuestras.find(m => m.nro_muestra === r.nro_muestra);
    return {
      hora: new Date(r.fecha_recepcion).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'}),
      cod: r.nro_muestra,
      pac: pac?.paciente || '',
      pruebas: pruebasUnicas.length ? pruebasUnicas : [r.nro_muestra],
      sinIngreso: r.sin_ingreso,
      user: r.recibido_por
    };
  });

  recepcionesTB = dataTB.map(r => {
    const ingreso = allMuestras.find(m => m.nro_muestra === r.nro_muestra);
    return {
      hora: new Date(r.fecha_recepcion).toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'}),
      cod: r.nro_muestra,
      pac: ingreso?.paciente || ''
    };
  });

  renderRecepcion();
  renderRecepcionTB();
  updateScanStats();
  setTimeout(() => document.getElementById('scan-in').focus(), 100);
}

function renderRecepcion() {
  // Marcar duplicados en la lista
  const codCount = {};
  recepciones.forEach(r => { codCount[r.cod] = (codCount[r.cod]||0)+1; });

  // Panel de duplicados
  const dups = Object.entries(codCount).filter(([cod,cnt]) => cnt > 1);
  const dupPanel = document.getElementById('rec-dup-panel');
  const dupBody = document.getElementById('rec-dup-body');
  if (dupPanel) {
    if (dups.length > 0) {
      dupPanel.style.display = 'block';
      dupBody.innerHTML = dups.map(([cod, cnt]) => {
        const r = recepciones.find(x => x.cod === cod);
        return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid var(--border);font-size:12px">
          <span class="mono">${cod}</span>
          <span style="flex:1">${r?.pac||'—'}</span>
          <span style="padding:2px 8px;border-radius:10px;background:var(--yellow-bg);color:var(--yellow);font-size:11px;font-weight:500">${cnt} tubos</span>
        </div>`;
      }).join('');
    } else {
      dupPanel.style.display = 'none';
    }
  }

  document.getElementById('rec-tabla').innerHTML = recepciones.length
    ? recepciones.map((r,i) => {
        const isDup = codCount[r.cod] > 1;
        const rowBg = r.sinIngreso ? 'background:var(--yellow-bg)' : isDup ? 'background:#FFFBEE' : '';
        return `<tr style="${rowBg}">
          <td style="color:var(--text2)">${r.hora}</td>
          <td class="mono">${r.cod}${isDup?` <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:var(--yellow-bg);color:var(--yellow);border:0.5px solid var(--yellow-border)">×${codCount[r.cod]}</span>`:''}</td>
          <td style="font-size:11px">${r.sinIngreso?'<span style="color:var(--yellow);font-weight:500"><i class="ti ti-alert-triangle"></i> Sin ingreso</span>':r.pac||''}</td>
          <td>${r.pruebas.map(p=>`<span style="display:inline-block;margin:1px 2px;padding:1px 7px;border-radius:10px;font-size:10px;background:var(--bg2);border:0.5px solid var(--border2)">${p}</span>`).join('')}</td>
          <td>
            <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
              onclick="eliminarRecepcion('${r.cod}',${i})">
              <i class="ti ti-trash"></i>
            </button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="empty-state">Escanea la primera muestra del turno...</td></tr>';
}

async function eliminarRecepcionSinIngreso(nro_muestra) {
  if (!confirm(`¿Eliminar la recepción de ${nro_muestra}?`)) return;
  sb.from('recepciones').delete().eq('nro_muestra', nro_muestra).eq('sin_ingreso', true).then(({error}) => {
    if (error) { toast('Error: '+error.message,'err'); return; }
    toast('Eliminada','ok');
    loadSinIngreso();
    loadMuestras();
  });
}

async function eliminarRecepcion(nro_muestra) {
  if (!confirm(`¿Eliminar la recepción de ${nro_muestra}?\nEsto no se puede deshacer.`)) return;
  const {data: recs} = await sb.from('recepciones')
    .select('id').eq('nro_muestra', nro_muestra)
    .order('fecha_recepcion', {ascending: false}).limit(1);
  if (!recs || !recs.length) { toast('No se encontró el registro','err'); return; }
  const {error} = await sb.from('recepciones').delete().eq('id', recs[0].id);
  if (error) { toast('Error: '+error.message,'err'); return; }
  toast('Recepción eliminada','ok');
  await loadMuestras({force:true});
  await loadRecepciones();
}

// ============================================================
// ESCÁNER TB — separado, no suma al conteo principal
// ============================================================
let scanTimerTB = null;

function onScanTBInput(val) {
  clearTimeout(scanTimerTB);
  if (val.length >= 12) scanTimerTB = setTimeout(() => processScanTB(val), 200);
}

async function processScanTB(val) {
  document.getElementById('scan-tb-in').value = '';
  const fb = document.getElementById('scan-tb-fb');

  // Verificar duplicado en la sesión actual
  const dup = recepcionesTB.find(r => r.cod === val);
  if (dup) {
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<strong><i class="ti ti-alert-triangle"></i> Ya escaneada en este turno</strong> — posición ${recepcionesTB.indexOf(dup) + 1}, a las ${dup.hora}`;
    return;
  }

  // Registrar en BD con flag de TB
  const {error} = await sb.from('recepciones').insert({
    nro_muestra: val,
    recibido_por: currentUser,
    sin_ingreso: false,
    es_tb: true
  });
  if (error) { toast('Error al registrar TB: ' + error.message, 'err'); return; }

  const hora = new Date().toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
  const ingreso = allMuestras.find(m => m.nro_muestra === val);
  const pac = ingreso?.paciente || '';

  recepcionesTB.unshift({ hora, cod: val, pac });

  fb.className = 'scan-fb sf-ok';
  fb.innerHTML = `<strong><i class="ti ti-circle-check"></i> TB registrada — ${pac || val}</strong>`;

  renderRecepcionTB();
  updateScanStats();
  setTimeout(() => document.getElementById('scan-tb-in').focus(), 50);
}

function renderRecepcionTB() {
  document.getElementById('rec-tb-tabla').innerHTML = recepcionesTB.length
    ? recepcionesTB.map((r, i) => `<tr>
        <td style="color:var(--text2)">${r.hora}</td>
        <td class="mono">${r.cod}</td>
        <td style="font-size:11px">${r.pac || '<span style="color:var(--text3)">Sin ingreso</span>'}</td>
        <td>
          <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
            onclick="eliminarRecepcionTB('${r.cod}',${i})">
            <i class="ti ti-trash"></i>
          </button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty-state">Sin muestras TB escaneadas en este turno...</td></tr>';
}

async function eliminarRecepcionTB(cod, idx) {
  if (!confirm(`¿Eliminar la recepción TB de ${cod}?`)) return;
  const {data: recs} = await sb.from('recepciones').select('id')
    .eq('nro_muestra', cod).eq('es_tb', true)
    .order('fecha_recepcion', {ascending: false}).limit(1);
  if (recs && recs.length) {
    await sb.from('recepciones').delete().eq('id', recs[0].id);
  }
  recepcionesTB.splice(idx, 1);
  renderRecepcionTB();
  updateScanStats();
  toast('Recepción TB eliminada', 'ok');
}

function updateScanStats() {
  const pend = allMuestras.filter(m => m.estado === 'pendiente' && !m.gestionada).length;
  const pendGes = allMuestras.filter(m => m.estado === 'pendiente' && m.gestionada).length;
  // TB va a su propio array — el conteo principal nunca las incluye
  document.getElementById('cnt-esc').textContent = recepciones.length;
  document.getElementById('cnt-pru').textContent = recepciones.reduce((a,r)=>a+r.pruebas.length,0);
  document.getElementById('cnt-pen').textContent = pend;
  document.getElementById('cnt-pen-ges').textContent = pendGes;
  document.getElementById('cnt-dup').textContent = scanDups;
  document.getElementById('cnt-tb').textContent = recepcionesTB.length;
}

// ============================================================
// CIERRE DE TURNO
// ============================================================
function isTB(prueba) {
  return prueba.toUpperCase().includes('TUBERCULOSIS') || prueba.toUpperCase().includes('MYCOBACTERIUM');
}

async function initCierre() {
  document.getElementById('cierre-fecha').value = hoyCO();
  document.getElementById('cierre-ok').style.display = 'none';
  document.getElementById('cierre-resultado').style.display = 'none';
  document.getElementById('cierre-fisico').value = '';
  // Si no hay recepciones cargadas, cargarlas ahora
  if (recepciones.length === 0) await loadRecepciones();
  document.getElementById('cierre-total-sys').textContent = recepciones.length;
  document.getElementById('cierre-tb-sys').textContent = recepcionesTB.length;
}

function checkCierre(val) {
  const v = parseInt(val);
  const esperado = recepciones.length;
  const el = document.getElementById('cierre-resultado');
  const cmp = document.getElementById('cmp-conteo');
  if (!val || isNaN(v)) {
    el.style.display = 'none';
    if (cmp) cmp.classList.remove('count-match','count-nomatch');
    return;
  }
  const cuadra = v === esperado;
  el.style.display = 'block';
  el.style.cssText = `display:block;margin-bottom:12px;padding:8px 12px;border-radius:var(--radius);font-size:12px;font-weight:500;
    background:${cuadra?'var(--green-bg)':'var(--yellow-bg)'};
    border:0.5px solid ${cuadra?'var(--green-border)':'var(--yellow-border)'};
    color:${cuadra?'var(--green)':'var(--yellow)'}`;
  if (cuadra) {
    el.innerHTML = `<i class="ti ti-circle-check"></i> ✅ ¡Conteo cuadra! ${v} físico = ${esperado} sistema`;
  } else {
    const diff = v - esperado;
    el.innerHTML = `<i class="ti ti-alert-triangle"></i> ⚠️ No cuadra — diferencia de <strong>${Math.abs(diff)}</strong> tubo${Math.abs(diff)!==1?'s':''} ${diff>0?'de más':'de menos'}`;
  }
  if (cmp) { cmp.classList.toggle('count-match', cuadra); cmp.classList.toggle('count-nomatch', !cuadra); }
}

async function cerrarTurno() {
  const fecha  = document.getElementById('cierre-fecha').value;
  const obs    = document.getElementById('cierre-obs').value;
  const fisico = parseInt(document.getElementById('cierre-fisico').value);

  if (!fecha) { toast('Ingresa la fecha de cierre', 'err'); return; }
  if (isNaN(fisico)) { toast('Ingresa el conteo físico de tubos', 'err'); return; }

  const totalSistema = recepciones.length;
  const cuadra = fisico === totalSistema;

  const btn = document.querySelector('#page-cierre .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...'; }

  // Guardar usando conteo_cervix como campo de conteo total (columna existente en la BD)
  // cerrado_por toma el nombre del usuario actual de la sesión
  const {error} = await sb.from('cierres_turno').insert({
    cerrado_por:      currentUser,
    fecha_cierre:     fecha,
    total_escaneadas: totalSistema,
    total_pruebas:    recepciones.reduce((a,r) => a + r.pruebas.length, 0),
    conteo_cervix:    fisico,       // usamos este campo para el conteo total
    conteo_plasma:    0,
    conteo_sangre:    0,
    conteo_otros:     0,
    observaciones:    (obs ? obs + ' | ' : '') + (cuadra ? 'Conteo OK' : `No cuadra: físico=${fisico} sistema=${totalSistema}`)
  });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Confirmar cierre'; }

  if (error) { toast('Error al cerrar turno: ' + error.message, 'err'); return; }

  const el = document.getElementById('cierre-ok');
  el.style.display = 'block';
  el.innerHTML = `<div style="background:var(--green-bg);border:0.5px solid var(--green-border);border-radius:var(--radius-lg);padding:16px;color:var(--green);margin-top:12px">
    <div style="font-weight:600;font-size:14px;margin-bottom:8px"><i class="ti ti-circle-check"></i> Turno cerrado — ${fecha}</div>
    <div style="font-size:12px">Cerrado por: <strong>${currentUser}</strong></div>
    <div style="font-size:12px;margin-top:4px">Sistema: <strong>${totalSistema}</strong> tubos · Físico: <strong>${fisico}</strong> · ${cuadra ? '✅ Conteo cuadra' : '⚠️ No cuadra'}</div>
    ${recepcionesTB.length > 0 ? `<div style="font-size:12px;margin-top:4px;color:var(--teal)">TB (sin numerar): <strong>${recepcionesTB.length}</strong></div>` : ''}
    <button class="btn" style="margin-top:12px;font-size:11px" onclick="nav('recepcion',document.querySelector('[onclick*=recepcion]'))">
      <i class="ti ti-arrow-left"></i> Volver a recepción
    </button>
  </div>`;

  toast('✓ Turno cerrado correctamente', 'ok');
  loadHistorialCierres();
}

