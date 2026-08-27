// ============================================================
// MODAL CONTROLES (matrículas y TB)
// ============================================================
let controlModalContext = null; // 'mat' | 'tb'

function abrirModalControles(ctx) {
  controlModalContext = ctx;
  if (ctx === 'mat' && !matriculaActual) { toast('Crea una matrícula primero', 'err'); return; }
  if (ctx === 'tb' && !corridaTBActual) { toast('Crea una corrida primero', 'err'); return; }
  document.getElementById('ctrl-nombre').value = '';
  document.getElementById('ctrl-codigo').value = '';
  const m = document.getElementById('modal-controles');
  m.style.display = 'flex';
  m.style.pointerEvents = 'auto';
  setTimeout(() => document.getElementById('ctrl-nombre').focus(), 100);
}
function cerrarModalControles() {
  const m = document.getElementById('modal-controles');
  m.style.display = 'none';
  m.style.pointerEvents = 'none';
  controlModalContext = null;
}

async function agregarControl() {
  const nombre = document.getElementById('ctrl-nombre').value.trim();
  const tipo = document.getElementById('ctrl-tipo').value;
  const codigoInput = document.getElementById('ctrl-codigo').value.trim();
  // El nro_muestra es el código si lo pusieron, si no es el nombre del control
  const nro_muestra = codigoInput || nombre;
  if (!nombre) { toast('Ingresa el nombre del control', 'err'); return; }

  if (controlModalContext === 'mat') {
    if (!matriculaActual) { toast('Sin matrícula activa', 'err'); return; }
    const posicion = posicionesActual.length + 1;
    const {data, error} = await sb.from('matricula_posiciones').insert({
      matricula_id: matriculaActual.id,
      posicion,
      nro_muestra,
      es_control: true,
      nombre_control: nombre,
      registrado_por: currentUser
    }).select().single();
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    posicionesActual.push(data);
    toast(`Control "${nombre}" agregado en posición ${posicion}`, 'ok');
    renderMatriculaActiva();
  } else if (controlModalContext === 'tb') {
    if (!corridaTBActual) { toast('Sin corrida activa', 'err'); return; }
    const posicion = posicionesTB.length + 2;
    const {data, error} = await sb.from('corrida_tb_posiciones').insert({
      corrida_id: corridaTBActual.id,
      posicion,
      nro_muestra,
      es_control: true,
      nombre_control: nombre,
      tipo_muestra: tipo,
      registrado_por: currentUser
    }).select().single();
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    posicionesTB.push(data);
    toast(`Control "${nombre}" (${tipo}) agregado en posición ${posicion}`, 'ok');
    renderCorridaTB();
  }
  cerrarModalControles();
}

// ============================================================
// MODAL INGRESO MANUAL
// ============================================================
function abrirModalIngresoManual(nroPrelleno) {
  // Poblar selector de pruebas
  const sel = document.getElementById('im-estudio-codigo');
  sel.innerHTML = '<option value="">— Selecciona la prueba —</option>';
  pruebasData.forEach(p => {
    const o = document.createElement('option');
    o.value = p.codigo; o.textContent = p.nombre_corto + (p.nombre_largo ? ' — ' + p.nombre_largo : '');
    sel.appendChild(o);
  });
  // Si no hay pruebas cargadas, usar hardcoded
  if (!pruebasData.length) {
    const fallback = [
      {v:'1000107',l:'VPH'},{v:'1000165',l:'VIH'},{v:'1001953',l:'Hepatitis B'},
      {v:'1001955',l:'Hepatitis C'},{v:'1001543',l:'CMV'},{v:'1001662',l:'Tuberculosis'},
      {v:'1005655',l:'HLA B27'},{v:'1004472',l:'HLA B57'},{v:'1004512',l:'Homocisteína'},
      {v:'1004658',l:'Hemocromatosis'},{v:'1005081',l:'MTHFR'},{v:'1001683',l:'Genotipificación C'},
      {v:'1001882',l:'Genotipificación VIH'},{v:'1004394',l:'Integrasa'}
    ];
    fallback.forEach(f => { const o = document.createElement('option'); o.value=f.v; o.textContent=f.l; sel.appendChild(o); });
  }
  // Poblar datalist de sedes
  const dl = document.getElementById('im-sedes-list');
  dl.innerHTML = Object.keys(SEDE_REGIONAL).map(s => `<option value="${s}">`).join('');
  // Mostrar código de muestra conocido por separado (NO pre-llenar OD_ID con él)
  const wrapConocido = document.getElementById('im-nro-conocido-wrap');
  if (nroPrelleno) {
    document.getElementById('im-nro-conocido').textContent = nroPrelleno;
    wrapConocido.style.display = 'block';
  } else {
    wrapConocido.style.display = 'none';
  }
  window._imNroConocido = nroPrelleno || null;
  document.getElementById('im-od-id').value = '';
  document.getElementById('im-nombres').value = '';
  document.getElementById('im-apellidos').value = '';
  document.getElementById('im-cedula').value = '';
  document.getElementById('im-tipo-muestra').value = '';
  document.getElementById('im-sede').value = '';
  document.getElementById('im-error').style.display = 'none';
  const m = document.getElementById('modal-ingreso-manual');
  m.style.display = 'flex';
  m.style.pointerEvents = 'auto';
  setTimeout(() => document.getElementById('im-od-id').focus(), 100);
}
function cerrarModalIngresoManual() {
  const m = document.getElementById('modal-ingreso-manual');
  m.style.display = 'none';
  m.style.pointerEvents = 'none';
}
function imActualizarNombreEstudio() {}

async function guardarIngresoManual() {
  const od_id = document.getElementById('im-od-id').value.trim();
  const estudio_codigo = document.getElementById('im-estudio-codigo').value;
  const nombres = document.getElementById('im-nombres').value.trim();
  const apellidos = document.getElementById('im-apellidos').value.trim();
  const cedula = document.getElementById('im-cedula').value.trim();
  const tipo_muestra = document.getElementById('im-tipo-muestra').value.trim();
  const sede = document.getElementById('im-sede').value.trim();
  const errEl = document.getElementById('im-error');

  if (!od_id || !estudio_codigo || !nombres || !apellidos || !cedula) {
    errEl.textContent = 'Completa los campos obligatorios: OD_ID, prueba, nombres, apellidos y cédula.';
    errEl.style.display = 'block'; return;
  }

  const prueba = pruebasData.find(p => p.codigo === estudio_codigo);
  const estudio_nombre = prueba?.nombre_largo || prueba?.nombre_corto || estudio_codigo;
  // Usar el código de muestra ya conocido (si viene de "Sin ingreso"); solo si no hay
  // ninguno, se asume que es un ingreso totalmente manual y el OD_ID hace de código también
  const nro_muestra = window._imNroConocido || od_id;

  if (window._imNroConocido && od_id === window._imNroConocido) {
    errEl.textContent = 'El OD_ID no puede ser igual al código de muestra — verifica el OD_ID real de LabCore.';
    errEl.style.display = 'block'; return;
  }

  const btn = document.getElementById('im-btn-guardar');
  btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Guardando...';

  const {error} = await sb.from('ingresos').insert({
    od_id,
    o_id: od_id,
    nro_muestra,
    identificacion: cedula,
    nombres,
    apellidos,
    estudio_codigo,
    estudio_nombre,
    tipo_muestra,
    sede,
    subido_por: currentUser + ' (manual)',
    fecha_solicitud: new Date().toISOString(),
    fecha_ingreso: new Date().toISOString()
  });

  btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Guardar ingreso';

  if (error) {
    if (error.code === '23505') {
      errEl.textContent = 'Ya existe un ingreso con ese OD_ID. Verifica el código.';
    } else {
      errEl.textContent = 'Error: ' + error.message;
    }
    errEl.style.display = 'block'; return;
  }

  // Marcar la recepción sin ingreso como resuelta si existe
  await sb.from('recepciones').update({sin_ingreso: false})
    .eq('nro_muestra', nro_muestra).eq('sin_ingreso', true);

  toast('✓ Ingreso manual registrado — la muestra pasa a estado recibida', 'ok');
  cerrarModalIngresoManual();
  await loadMuestras({force:true});
  if (document.getElementById('page-sin-ingreso').classList.contains('active')) loadSinIngreso();
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}

function abrirIngresoManualTB(nroMuestra) {
  abrirModalIngresoManual(nroMuestra);
}

async function guardarDatosManualesTB(posicionId, numPosicion) {
  const paciente = document.getElementById('tb-manual-pac')?.value.trim() || '';
  const cedula   = document.getElementById('tb-manual-ced')?.value.trim() || '';
  const sede     = document.getElementById('tb-manual-sede')?.value.trim() || '';

  const {error} = await sb.from('corrida_tb_posiciones').update({
    paciente: paciente || null,
    cedula:   cedula   || null,
    sede:     sede     || null
  }).eq('id', posicionId);

  if (error) { toast('Error guardando datos: ' + error.message, 'err'); return; }

  // Actualizar en memoria local
  const p = posicionesTB.find(x => x.id === posicionId);
  if (p) { p.paciente = paciente; p.cedula = cedula; p.sede = sede; }

  const fb = document.getElementById('tb-scan-fb');
  if (fb) {
    fb.className = 'scan-fb sf-ok';
    fb.innerHTML = `<strong><i class="ti ti-circle-check"></i> Posición ${numPosicion} — ${paciente||'Sin nombre'}</strong> · Datos manuales guardados`;
  }
  toast(`Datos de posición ${numPosicion} guardados`, 'ok');
  renderCorridaTB();
}

