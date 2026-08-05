// ============================================================
// GENERAR CORREO
// ============================================================
let correoItems = []; // { cod, cedula, paciente, sede }
let correoScanTimer = null;

function initCorreo() {
  // Limpiar al entrar solo si estaba vacío antes
  document.getElementById('correo-scan-in').value = '';
  document.getElementById('correo-scan-fb').className = 'scan-fb';
  document.getElementById('correo-scan-fb').innerHTML = '';
  renderCorreoTabla();
  setTimeout(() => document.getElementById('correo-scan-in').focus(), 100);
}

function onCorreoScanInput(val) {
  clearTimeout(correoScanTimer);
  if (val.length >= 6) correoScanTimer = setTimeout(() => procesarCorreoScan(val), 250);
}

function procesarCorreoScan(val) {
  document.getElementById('correo-scan-in').value = '';
  const fb = document.getElementById('correo-scan-fb');

  // Buscar en allMuestras — puede haber varias OD_IDs para el mismo tubo
  const muestras = allMuestras.filter(m => m.nro_muestra === val);

  if (!muestras.length) {
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<i class="ti ti-alert-triangle"></i> Código <strong>${val}</strong> no encontrado en el sistema`;
    setTimeout(() => document.getElementById('correo-scan-in').focus(), 50);
    return;
  }

  // Verificar duplicado en la lista actual
  if (correoItems.find(i => i.cod === val)) {
    fb.className = 'scan-fb sf-dup';
    fb.innerHTML = `<i class="ti ti-alert-triangle"></i> <strong>${val}</strong> ya está en la lista`;
    setTimeout(() => document.getElementById('correo-scan-in').focus(), 50);
    return;
  }

  const m = muestras[0];
  correoItems.push({
    cod:      val,
    cedula:   m.identificacion || '—',
    paciente: m.paciente || '—',
    sede:     m.sede || '—'
  });

  fb.className = 'scan-fb sf-ok';
  fb.innerHTML = `<i class="ti ti-circle-check"></i> <strong>${m.paciente || val}</strong> agregado`;

  renderCorreoTabla();
  setTimeout(() => document.getElementById('correo-scan-in').focus(), 50);
}

function renderCorreoTabla() {
  const wrap = document.getElementById('correo-tabla-wrap');
  const empty = document.getElementById('correo-empty');
  const preview = document.getElementById('correo-preview-panel');

  if (!correoItems.length) {
    wrap.style.display = 'none';
    empty.style.display = 'block';
    preview.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  empty.style.display = 'none';

  document.getElementById('correo-tabla').innerHTML = correoItems.map((item, i) => `
    <tr>
      <td class="mono">${item.cod}</td>
      <td class="mono">${item.cedula}</td>
      <td style="font-size:12px">${item.paciente}</td>
      <td style="font-size:12px;color:var(--text2)">${item.sede}</td>
      <td>
        <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
          onclick="eliminarCorreoItem(${i})">
          <i class="ti ti-x"></i>
        </button>
      </td>
    </tr>`).join('');
}

function eliminarCorreoItem(idx) {
  correoItems.splice(idx, 1);
  renderCorreoTabla();
}

function limpiarCorreo() {
  if (!correoItems.length) return;
  if (!confirm('¿Limpiar toda la lista?')) return;
  correoItems = [];
  document.getElementById('correo-preview-panel').style.display = 'none';
  renderCorreoTabla();
  document.getElementById('correo-scan-in').focus();
}

function copiarCorreo() {
  if (!correoItems.length) { toast('Agrega al menos un tubo primero', 'err'); return; }

  const motivo = document.getElementById('correo-motivo').value.trim();
  if (!motivo) {
    toast('Escribe el motivo de la solicitud antes de copiar', 'err');
    document.getElementById('correo-motivo').focus();
    return;
  }

  const fecha = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });

  // Encabezado
  const encabezado = `Cordial saludo, Fayrline Aristizabal Colorado,

Por medio del presente correo, solicitamos respetuosamente la toma de nueva muestra para los siguientes pacientes:

Motivo: ${motivo}

`;

  // Tabla con tabulaciones (queda como tabla al pegar en Outlook/Gmail)
  const sep = '\t';
  const filaEncabezado = ['Código', 'Cédula', 'Nombre completo', 'Sede'].join(sep);
  const filas = correoItems.map(i => [i.cod, i.cedula, i.paciente, i.sede].join(sep));
  const tabla = [filaEncabezado, ...filas].join('\n');

  // Cierre
  const cierre = `

Quedamos atentos, gracias!

Laboratorio de Biología Molecular`;

  const textoCompleto = encabezado + tabla + cierre;

  navigator.clipboard.writeText(textoCompleto).then(() => {
    const panel = document.getElementById('correo-preview-panel');
    document.getElementById('correo-preview').textContent = textoCompleto;
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(`✓ Correo copiado (${correoItems.length} paciente${correoItems.length!==1?'s':''}) — pega en tu correo`, 'ok');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = textoCompleto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('✓ Copiado', 'ok');
  });
}

// ============================================================
// INICIO
// ============================================================
