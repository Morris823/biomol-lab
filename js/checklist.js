// ============================================================
// CHECKLIST CIERRE DE TURNO — BACTERIÓLOGOS
// ============================================================
let checklistActual = null;
let checklistSoloLectura = false;
let semanalManualesInfo = null; // {hecho, dia, por} para la semana actual

const FESTIVOS_CL = new Set([
  '2025-01-01','2025-01-06','2025-03-24','2025-04-17','2025-04-18',
  '2025-05-01','2025-06-02','2025-06-23','2025-06-30','2025-07-20',
  '2025-08-07','2025-08-18','2025-10-13','2025-11-03','2025-11-17',
  '2025-12-08','2025-12-25',
  '2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03',
  '2026-05-01','2026-05-18','2026-06-08','2026-06-15','2026-06-29',
  '2026-07-20','2026-08-07','2026-08-17','2026-10-12','2026-11-02',
  '2026-11-16','2026-12-08','2026-12-25'
]);
function esFestivoCL(fechaISO) { return FESTIVOS_CL.has(fechaISO); }

function rangoSemanaISO(fechaISO) {
  const d = new Date(fechaISO + 'T12:00:00');
  const dow = d.getDay(); // 0=dom
  const diffLunes = dow === 0 ? -6 : 1 - dow;
  const lunes = new Date(d); lunes.setDate(d.getDate() + diffLunes);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  return { inicio: lunes.toISOString().slice(0,10), fin: domingo.toISOString().slice(0,10) };
}

// Definición de ítems por bloque
function getItemsChecklist(fechaISO) {
  const d = new Date(fechaISO + 'T12:00:00');
  const dow = d.getDay();
  const festivo = esFestivoCL(fechaISO);

  // Controles VPH/VIH: se montan y se registran en Greenbelt el MISMO día en la mañana
  const diasControlVPH = festivo ? [2,4,5] : [1,3,5];
  const mostrarControlVPH = diasControlVPH.includes(dow);

  // Controles VHC/VHB/CMV: se montan L-M-V en la TARDE
  const diasControlVHC = [1,3,5];
  const mostrarControlVHC = diasControlVHC.includes(dow);

  // Se registran en Greenbelt al día hábil SIGUIENTE en la mañana
  // Lun monta -> se registra Martes. Mié monta -> se registra Jueves. Vie monta -> se registra Lunes (salta finde)
  const diasRegistroGreenbeltCMV = [2,4,1]; // martes, jueves, lunes
  const mostrarGreenbeltCMV = diasRegistroGreenbeltCMV.includes(dow);

  const mostrarSemanalEquipos = dow === 1;

  const equiposManana = [
    { key: 'mant_diario', label: 'Mantenimiento diario' },
  ];
  if (mostrarSemanalEquipos) equiposManana.push({ key: 'mant_semanal', label: 'Mantenimiento semanal' });
  equiposManana.push({ key: 'mant_mensual', label: 'Mantenimiento mensual', conFecha: true });
  if (mostrarControlVPH) {
    equiposManana.push({ key: 'control_vph_vih', label: `Controles VPH/VIH montados hoy` });
    equiposManana.push({ key: 'greenbelt_hiv_vph', label: 'Registro en Greenbelt — controles HIV/VPH montados hoy en la mañana' });
  }
  if (mostrarGreenbeltCMV) {
    equiposManana.push({ key: 'greenbelt_cmv', label: 'Registro en Greenbelt — controles CMV/VHC/VHB montados el día hábil anterior en la tarde' });
  }
  equiposManana.push({ key: 'formato_calidad', label: 'Formatos de calidad diligenciados (Teams)' });
  equiposManana.push({ key: 'formato_mantenimiento', label: 'Formatos de mantenimiento diligenciados (Teams)' });

  const equiposTarde = [];
  if (mostrarControlVHC) equiposTarde.push({ key: 'control_vhc_vhb_cmv', label: 'Controles VHC/VHB/CMV montados' });
  equiposTarde.push({ key: 'equipo_limpio_tarde', label: 'Equipo limpio al finalizar turno' });

  const validacion = [
    { key: 'val_gestor', label: 'Revisión de pendientes en el gestor', conHoras: true, prefijo: 'validacion_gestor' },
    { key: 'val_labcore', label: 'Revisión de pendientes en LabCore', conHoras: true, prefijo: 'validacion_labcore' },
    { key: 'val_listas', label: 'Cargar listas de validados' },
    { key: 'val_descarte', label: 'Notificación de descarte de muestras (aprox. cada 2 semanas — no es diario)' },
  ];

  const manuales = [
    { key: 'man_pendientes_subidos', label: 'Pendientes descargados de LabCore y subidos al gestor' },
    { key: 'man_gestion', label: 'Gestión de pendientes realizada' },
    { key: 'man_mant_equipo', label: 'Mantenimiento del equipo antes de montar' },
    { key: 'man_limpieza_cabinas', label: 'Limpieza cabina de reactivos y cabina de muestras' },
    { key: 'man_limpio', label: 'Equipo limpio al finalizar turno' },
    { key: 'man_mant_semanal', label: 'Mantenimiento semanal (una vez por semana, cualquier día)', semanal: true },
    { key: 'man_formato_calidad', label: 'Formato de calidad diligenciado' },
    { key: 'man_formato_mantenimiento', label: 'Formato de mantenimiento diligenciado' },
    { key: 'man_formato_estadistica', label: 'Formato de estadística diligenciado' },
  ];

  const tb = [
    { key: 'tb_hay_montaje', label: '¿Hay montaje de TB hoy?', esToggleMaestro: true },
    { key: 'tb_pendientes', label: 'Revisión de pendientes TB', requiereMontaje: true },
    { key: 'tb_resultados_anteriores', label: 'Revisión de resultados anteriores de pacientes a procesar', requiereMontaje: true },
    { key: 'tb_historia_clinica', label: 'Revisión de historia clínica de positivos', requiereMontaje: true },
    { key: 'tb_reporte_correo', label: 'Positivas reportadas por correo', requiereMontaje: true },
    { key: 'tb_discordancia', label: 'Si hay discordancia: contacto con Micobacdin para cultivo + comunicación con área y departamental', requiereMontaje: true },
    { key: 'tb_limpieza_cabina', label: 'Limpieza de la cabina', requiereMontaje: true },
    { key: 'tb_limpieza_bloque_seco', label: 'Limpieza del bloque seco', requiereMontaje: true },
    { key: 'tb_limpieza_microcentrifuga', label: 'Limpieza de la microcentrífuga', requiereMontaje: true },
    { key: 'tb_limpieza_cabina_reactivos_pcr', label: 'Limpieza de la cabina de reactivos y de PCR', requiereMontaje: true },
    { key: 'tb_equipos_apagados', label: 'Verificar que todos los equipos quedan limpios y apagados al final', requiereMontaje: true },
    { key: 'tb_formato_calidad', label: 'Formato de control de calidad diligenciado', requiereMontaje: true },
    { key: 'tb_formato_mantenimiento', label: 'Formato de mantenimiento diligenciado', requiereMontaje: true },
    { key: 'tb_formato_estadistica', label: 'Formato de estadística diligenciado', requiereMontaje: true },
  ];

  return { equiposManana, equiposTarde, validacion, manuales, tb };
}

function initChecklist() {
  const hoy = hoyCO();
  document.getElementById('cl-fecha').value = hoy;
  cargarChecklist(hoy);
  cargarHistorialChecklist();
}

function cambiarFechaChecklist() {
  const fecha = document.getElementById('cl-fecha').value;
  if (fecha) cargarChecklist(fecha);
}

async function cargarChecklist(fechaISO) {
  const hoy = hoyCO();
  const {data} = await sb.from('checklist_turno').select('*').eq('fecha', fechaISO).maybeSingle();
  if (data) {
    checklistActual = data;
  } else {
    const {data: nuevo, error} = await sb.from('checklist_turno').insert({ fecha: fechaISO, items: {} }).select().single();
    if (error) { toast('Error creando checklist: ' + error.message, 'err'); return; }
    checklistActual = nuevo;
  }
  // Solo lectura si no es hoy, o si el día ya se cerró manualmente
  checklistSoloLectura = (fechaISO !== hoy) || checklistActual.cerrado === true;

  // Cargar info de mantenimiento semanal de manuales para esta semana
  await cargarSemanalManuales(fechaISO);

  renderChecklist(fechaISO);
  renderBotonCerrar();
}

async function cargarSemanalManuales(fechaISO) {
  const { inicio, fin } = rangoSemanaISO(fechaISO);
  const {data} = await sb.from('checklist_turno').select('fecha,items').gte('fecha', inicio).lte('fecha', fin);
  semanalManualesInfo = null;
  (data||[]).forEach(row => {
    const it = row.items?.man_mant_semanal;
    if (it?.checked) semanalManualesInfo = { dia: row.fecha, por: it.por };
  });
}

function renderBotonCerrar() {
  const hoy = hoyCO();
  const esHoy = checklistActual.fecha === hoy;
  const el = document.getElementById('cl-boton-cerrar-wrap');
  if (!el) return;
  if (checklistActual.cerrado) {
    el.innerHTML = `<div style="padding:8px 12px;background:var(--bg2);border-radius:var(--radius);font-size:11px;color:var(--text3)">
      <i class="ti ti-lock"></i> Checklist cerrado por <strong>${checklistActual.cerrado_por}</strong> el ${fmt(checklistActual.cerrado_fecha)} ${fmtHora(checklistActual.cerrado_fecha)} — ya no se puede modificar
    </div>`;
  } else if (esHoy) {
    el.innerHTML = `<button class="btn btn-yellow" onclick="cerrarChecklistDia()"><i class="ti ti-lock"></i> Cerrar checklist de hoy (ya no se podrá editar)</button>`;
  } else {
    el.innerHTML = `<div style="padding:8px 12px;background:var(--bg2);border-radius:var(--radius);font-size:11px;color:var(--text3)"><i class="ti ti-eye"></i> Modo solo lectura — solo se puede editar el checklist del día actual</div>`;
  }
}

async function cerrarChecklistDia() {
  if (!confirm('¿Cerrar el checklist de hoy? Después de cerrarlo nadie podrá modificarlo.')) return;
  const {error} = await sb.from('checklist_turno').update({
    cerrado: true, cerrado_por: currentUser, cerrado_fecha: new Date().toISOString()
  }).eq('id', checklistActual.id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  checklistActual.cerrado = true;
  checklistActual.cerrado_por = currentUser;
  checklistActual.cerrado_fecha = new Date().toISOString();
  checklistSoloLectura = true;
  renderChecklist(checklistActual.fecha);
  renderBotonCerrar();
  toast('Checklist cerrado', 'ok');
}

function renderChecklist(fechaISO) {
  const { equiposManana, equiposTarde, validacion, manuales, tb } = getItemsChecklist(fechaISO);
  document.getElementById('cl-equipos-manana').innerHTML = renderBloqueItems(equiposManana);
  document.getElementById('cl-equipos-tarde').innerHTML = renderBloqueItems(equiposTarde) + renderObsEntregaTarde();
  document.getElementById('cl-validacion').innerHTML = renderBloqueItems(validacion);
  document.getElementById('cl-manuales').innerHTML = renderBloqueItems(manuales);

  const tbHayMontaje = checklistActual?.items?.tb_hay_montaje?.checked || false;
  const tbItemsVisibles = tb.filter(it => it.esToggleMaestro || (it.requiereMontaje && tbHayMontaje));
  document.getElementById('cl-tb').innerHTML = renderBloqueItems(tbItemsVisibles);
}

function renderObsEntregaTarde() {
  const obs = checklistActual?.obs_entrega_tarde || '';
  return `<div style="margin-top:10px;padding:10px;background:var(--yellow-bg);border:0.5px solid var(--yellow-border);border-radius:var(--radius)">
    <div style="font-size:11px;font-weight:600;color:var(--yellow);margin-bottom:4px"><i class="ti ti-notes"></i> Observaciones para quien abra el turno de mañana</div>
    <textarea rows="2" placeholder="Ej: el equipo X presentó falla, quedó pendiente..."
      style="width:100%;font-size:12px;padding:6px" ${checklistSoloLectura?'disabled':''}
      onblur="actualizarObsEntregaTarde(this.value)">${obs}</textarea>
  </div>`;
}

async function actualizarObsEntregaTarde(valor) {
  await sb.from('checklist_turno').update({ obs_entrega_tarde: valor, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  checklistActual.obs_entrega_tarde = valor;
}

function renderBloqueItems(items) {
  const data = checklistActual?.items || {};
  return items.map(item => {
    const it = data[item.key] || {};
    const checked = it.checked || false;
    const por = it.por || null;
    const fechaMarcado = it.fecha_marcado || null;
    const obs = it.observacion || '';
    const disabled = checklistSoloLectura ? 'disabled' : '';

    // Ítem semanal: si ya se hizo esta semana en otro día distinto al actual, mostrar como informativo
    if (item.semanal && semanalManualesInfo && semanalManualesInfo.dia !== checklistActual.fecha) {
      return `<div style="padding:8px 0;border-bottom:0.5px solid var(--border);opacity:.7">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <i class="ti ti-circle-check" style="color:var(--green);margin-top:2px"></i>
          <div style="flex:1">
            <div style="font-size:12px;color:var(--green)">${item.label}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Ya realizado esta semana el ${fmt(semanalManualesInfo.dia)} por ${semanalManualesInfo.por}</div>
          </div>
        </div>
      </div>`;
    }

    let extraHTML = '';
    if (item.conFecha) {
      const fechaMant = checklistActual.mantenimiento_mensual_fecha || '';
      extraHTML = `
        <div style="margin-left:26px;margin-top:4px">
          <label style="font-size:10px;color:var(--text3)">Fecha en que se realizó:</label>
          <input type="date" value="${fechaMant}" style="font-size:11px;padding:2px 6px;margin-left:6px" ${disabled}
            onchange="actualizarFechaMantMensual(this.value)" />
        </div>`;
    }
    if (item.conHoras) {
      const desde = checklistActual[`${item.prefijo}_desde`] || '';
      const hasta = checklistActual[`${item.prefijo}_hasta`] || '';
      extraHTML = `
        <div style="margin-left:26px;margin-top:4px;display:flex;gap:8px;align-items:center">
          <label style="font-size:10px;color:var(--text3)">Desde:</label>
          <input type="datetime-local" value="${desde ? desde.slice(0,16) : ''}" style="font-size:11px;padding:2px 6px" ${disabled}
            onchange="actualizarHorasValidacion('${item.prefijo}','desde',this.value)" />
          <label style="font-size:10px;color:var(--text3)">Hasta:</label>
          <input type="datetime-local" value="${hasta ? hasta.slice(0,16) : ''}" style="font-size:11px;padding:2px 6px" ${disabled}
            onchange="actualizarHorasValidacion('${item.prefijo}','hasta',this.value)" />
        </div>`;
    }

    const estiloMaestro = item.esToggleMaestro ? 'font-weight:600' : '';

    return `<div style="padding:8px 0;border-bottom:0.5px solid var(--border)">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <input type="checkbox" ${checked?'checked':''} ${disabled} style="margin-top:3px;cursor:pointer"
          onchange="toggleChecklistItem('${item.key}',this.checked)" />
        <div style="flex:1">
          <div style="font-size:12px;${estiloMaestro};${checked?'color:var(--green)':'color:var(--text)'}">${item.label}</div>
          ${checked && por ? `<div style="font-size:10px;color:var(--text3);margin-top:2px"><i class="ti ti-user"></i> ${por} · ${fechaMarcado ? fmt(fechaMarcado) + ' ' + fmtHora(fechaMarcado) : ''}</div>` : ''}
          ${!item.esToggleMaestro ? `<input placeholder="Observación (opcional — útil si no aplica o no se hizo)..."
            value="${obs.replace(/"/g,'&quot;')}" ${disabled}
            style="width:100%;font-size:11px;padding:3px 6px;margin-top:4px"
            onblur="actualizarObsChecklistItem('${item.key}',this.value)" />` : ''}
          ${extraHTML}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function toggleChecklistItem(key, checked) {
  if (checklistSoloLectura) return;
  const items = { ...(checklistActual.items || {}) };
  items[key] = {
    ...(items[key]||{}),
    checked,
    por: checked ? currentUser : null,
    fecha_marcado: checked ? new Date().toISOString() : null
  };
  const {error} = await sb.from('checklist_turno').update({ items, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  checklistActual.items = items;
  if (key === 'man_mant_semanal' && checked) semanalManualesInfo = { dia: checklistActual.fecha, por: currentUser };
  renderChecklist(checklistActual.fecha);
}

async function actualizarObsChecklistItem(key, obs) {
  if (checklistSoloLectura) return;
  const items = { ...(checklistActual.items || {}) };
  items[key] = { ...(items[key]||{}), observacion: obs };
  await sb.from('checklist_turno').update({ items, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  checklistActual.items = items;
}

async function actualizarFechaMantMensual(fecha) {
  if (checklistSoloLectura) return;
  await sb.from('checklist_turno').update({ mantenimiento_mensual_fecha: fecha || null, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  checklistActual.mantenimiento_mensual_fecha = fecha;
}

async function actualizarHorasValidacion(prefijo, tipo, valor) {
  if (checklistSoloLectura) return;
  const campo = `${prefijo}_${tipo}`;
  const utcVal = valor ? localCOtoUTC(valor) : null;
  await sb.from('checklist_turno').update({ [campo]: utcVal, updated_at: new Date().toISOString() }).eq('id', checklistActual.id);
  checklistActual[campo] = utcVal;
}

async function cargarHistorialChecklist() {
  const {data} = await sb.from('checklist_turno').select('fecha,items,cerrado').order('fecha',{ascending:false}).limit(30);
  const el = document.getElementById('cl-historial');
  if (!el) return;
  if (!data || !data.length) { el.innerHTML = '<div class="empty-state">Sin historial</div>'; return; }
  el.innerHTML = data.map(row => {
    const total = Object.keys(row.items||{}).length;
    const marcados = Object.values(row.items||{}).filter(i => i?.checked).length;
    return `<tr onclick="document.getElementById('cl-fecha').value='${row.fecha}';cambiarFechaChecklist()" style="cursor:pointer">
      <td class="mono">${fmt(row.fecha)}</td>
      <td style="text-align:center">${marcados}/${total}</td>
      <td>${row.cerrado ? '<span class="pill s-val"><span class="dot"></span>Cerrado</span>' : '<span class="pill s-rec"><span class="dot"></span>Abierto</span>'}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// MODAL ENTREGA DE TURNO — se muestra al abrir el gestor por primera vez en el día
// ============================================================
async function verificarEntregaTurno() {
  const hoy = hoyCO();
  const key = 'entregaShown_' + hoy;
  if (localStorage.getItem(key)) return;

  // Buscar checklist de ayer para traer sus observaciones
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  const ayerISO = ayer.toISOString().slice(0,10);
  const {data: ayerData} = await sb.from('checklist_turno').select('*').eq('fecha', ayerISO).maybeSingle();

  const obsAyer = ayerData?.obs_entrega_tarde || '';
  const totalAyer = ayerData ? Object.keys(ayerData.items||{}).length : 0;
  const marcadosAyer = ayerData ? Object.values(ayerData.items||{}).filter(i=>i?.checked).length : 0;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--radius-lg);max-width:560px;width:100%;padding:24px;max-height:90vh;overflow-y:auto">
      <div style="font-size:18px;font-weight:600;margin-bottom:4px"><i class="ti ti-clipboard-check"></i> Entrega de turno</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">Resumen de ayer (${fmt(ayerISO)}) antes de empezar hoy</div>

      ${obsAyer ? `<div style="padding:12px;background:var(--yellow-bg);border:0.5px solid var(--yellow-border);border-radius:var(--radius);margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--yellow);margin-bottom:6px"><i class="ti ti-alert-triangle"></i> Observaciones de ayer en la tarde</div>
        <div style="font-size:13px;color:var(--text)">${obsAyer}</div>
      </div>` : `<div style="padding:10px;background:var(--green-bg);border-radius:var(--radius);font-size:12px;color:var(--green);margin-bottom:14px"><i class="ti ti-circle-check"></i> Sin observaciones pendientes de ayer</div>`}

      <div style="font-size:12px;color:var(--text2);margin-bottom:16px">
        Checklist de ayer completado: <strong>${marcadosAyer}/${totalAyer}</strong> ítems
        ${ayerData?.cerrado ? ' · <span style="color:var(--green)">Cerrado</span>' : ' · <span style="color:var(--yellow)">No se cerró</span>'}
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="flex:1" onclick="cerrarModalEntrega(true)"><i class="ti ti-clipboard-check"></i> Ir al checklist de hoy</button>
        <button class="btn" onclick="cerrarModalEntrega(false)">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  window._modalEntrega = modal;
  localStorage.setItem(key, '1');
}

function cerrarModalEntrega(irAChecklist) {
  if (window._modalEntrega) { window._modalEntrega.remove(); window._modalEntrega = null; }
  if (irAChecklist) nav('checklist', document.querySelector('[onclick*="checklist"]'));
}

