// ============================================================
// REVISIÓN DE PENDIENTES (separada: manuales / tb)
// ============================================================
let segFiltro = { manuales: 'activos', tb: 'activos' };
let segRows = { manuales: [], tb: [] };
let enMatriculaGlobal = new Set();
let enCorridaTBGlobal = new Set();

async function cargarEnMatriculaGlobal() {
  const {data} = await sb.from('matricula_posiciones').select('nro_muestra').eq('es_control', false);
  enMatriculaGlobal = new Set((data||[]).map(p => p.nro_muestra));
}

async function cargarEnCorridaTBGlobal() {
  const {data} = await sb.from('corrida_tb_posiciones').select('nro_muestra').eq('es_control', false);
  enCorridaTBGlobal = new Set((data||[]).map(p => p.nro_muestra));
}

function chipSeg(el, val, area) {
  document.querySelectorAll(`[id^="seg-chip-"][id$="-${area}"]`).forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  segFiltro[area] = val;
  renderSegTabla(area);
}

async function cargarSeguimiento(area) {
  const {data} = await sb.from('seguimiento_manuales')
    .select('*').eq('area', area).order('fecha', { ascending: false });
  segRows[area] = data || [];

  // Verificar cuáles están validadas en BD aunque no estén en allMuestras
  const pendientes = segRows[area].filter(r => r.estado !== 'validado' && r.estado !== 'gestionado');
  if (pendientes.length) {
    const nros = [...new Set(pendientes.map(r => r.nro_muestra).filter(Boolean))];
    const {data: ings} = await sb.from('ingresos').select('od_id,nro_muestra').in('nro_muestra', nros);
    if (ings && ings.length) {
      const odIds = ings.map(i => i.od_id);
      const {data: vals} = await sb.from('validaciones').select('od_id').in('od_id', odIds);
      if (vals && vals.length) {
        const validadasOdIds = new Set(vals.map(v => v.od_id));
        const nrosValidados = new Set(ings.filter(i => validadasOdIds.has(i.od_id)).map(i => i.nro_muestra));
        for (const r of pendientes) {
          if (nrosValidados.has(r.nro_muestra)) {
            await sb.from('seguimiento_manuales').update({ estado: 'validado' }).eq('id', r.id);
            r.estado = 'validado';
          }
        }
      }
    }
  }

  if (area === 'manuales') {
    await cargarEnMatriculaGlobal();
  } else {
    await cargarEnCorridaTBGlobal();
  }

  // Auto-completar observación con "En proceso" si ya está en matrícula/corrida y no tiene observación
  const setGrupo = area === 'manuales' ? enMatriculaGlobal : enCorridaTBGlobal;
  for (const r of segRows[area]) {
    if (!r.observacion && setGrupo.has(r.nro_muestra)) {
      await sb.from('seguimiento_manuales').update({ observacion: 'En proceso' }).eq('id', r.id);
      r.observacion = 'En proceso';
    }
  }

  renderSegTabla(area);
}

function renderSegTabla(area) {
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0,10);
  const enSet = area === 'manuales' ? enMatriculaGlobal : enCorridaTBGlobal;

  let rows = segFiltro[area] === 'activos'
    ? segRows[area].filter(r => r.estado !== 'validado')
    : segRows[area];

  const q = (document.getElementById(`seg-buscar-${area}`)?.value || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(r => {
      const muestra = allMuestras.find(m => m.nro_muestra === r.nro_muestra);
      return r.nro_muestra?.toLowerCase().includes(q) ||
             (muestra?.paciente || '').toLowerCase().includes(q) ||
             (r.estudio_nombre || '').toLowerCase().includes(q) ||
             (r.observacion || '').toLowerCase().includes(q);
    });
  }

  const countEl = document.getElementById(`seg-count-label-${area}`);
  const ultimaBusqueda = segRows[area].length ? segRows[area].reduce((a,b) => new Date(b.busqueda_hasta||0) > new Date(a.busqueda_hasta||0) ? b : a, segRows[area][0]) : null;
  if (countEl) {
    countEl.innerHTML = rows.length + ' registros' +
      (ultimaBusqueda?.busqueda_hasta
        ? ` <span style="color:var(--accent)">· Última búsqueda en LabCore hasta: ${fmt(ultimaBusqueda.busqueda_hasta)} ${fmtHora(ultimaBusqueda.busqueda_hasta)}</span>`
        : '');
  }

  const tbody = document.getElementById(`seg-tabla-${area}`);
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">${segFiltro[area] === 'activos' ? 'Sin pendientes activos 🎉' : 'Sin registros de revisión'}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const muestra = allMuestras.find(m => m.nro_muestra === r.nro_muestra);
    const notaAux = muestra?.gestion || '—';
    const fechaRef = muestra?.fecha_recepcion || muestra?.fecha_ingreso;
    const prueba = muestra ? nombreCorto(muestra.estudio_nombre, muestra.estudio_codigo) : (r.estudio_nombre || '—');
    const cfg = CONFIG_PRUEBA[prueba];
    const limite = cfg?.limite || 3;
    const dias = fechaRef ? diasHabilesGlobal(new Date(fechaRef).toISOString().slice(0,10), hoyISO) : null;
    const enRecepcion = !!(muestra?.fecha_recepcion);
    const enGrupo = area === 'manuales'
      ? enMatriculaGlobal.has(r.nro_muestra)
      : enCorridaTBGlobal.has(r.nro_muestra);
    const etiquetaGrupo = area === 'manuales' ? 'En matrícula' : 'En corrida TB';

    const rowBg = r.tipo === 'fantasma' ? 'background:var(--red-bg)'
      : r.estado === 'gestionado' ? 'background:var(--yellow-bg)'
      : enGrupo ? 'background:var(--green-bg)' : '';

    const estiloRecepcion = enRecepcion
      ? 'border-bottom:2px solid var(--green);color:var(--green);font-weight:500'
      : 'color:var(--text3)';

    return `<tr style="${rowBg}">
      <td class="mono">${r.nro_muestra}</td>
      <td style="font-size:11px">${muestra?.paciente || '—'}${enGrupo ? ` <span style="font-size:9px;color:var(--green);border:0.5px solid var(--green-border);padding:1px 5px;border-radius:8px;background:var(--green-bg)">${etiquetaGrupo}</span>` : ''}</td>
      <td style="font-size:11px">${prueba}</td>
      <td style="font-size:11px;color:var(--text2)">${muestra?.sede || '—'}</td>
      <td style="text-align:center">
        ${dias !== null
          ? `<span style="color:${dias > limite ? 'var(--red)' : 'var(--green)'};font-weight:600">${dias}d</span>`
          : '<span style="color:var(--text3)">—</span>'}
      </td>
      <td style="text-align:center">
        <span style="${estiloRecepcion};font-size:11px;padding-bottom:2px">${enRecepcion ? 'Recibida' : 'No recibida'}</span>
      </td>
      <td style="font-size:11px;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${notaAux}">${notaAux}</td>
      <td onclick="event.stopPropagation()">
        <input style="width:140px;font-size:11px;padding:2px 6px"
          value="${(r.observacion||'').replace(/"/g,'&quot;')}"
          placeholder="Observación..."
          onblur="actualizarObsSeguimiento('${r.id}','${area}',this.value)" />
      </td>
      <td style="font-size:11px;color:var(--text3)">${r.gestionado_por||'—'}</td>
      <td>
        <select style="font-size:10px;padding:2px 4px;border-radius:4px;border:0.5px solid var(--border2);background:var(--bg2)"
          onchange="cambiarEstadoSeguimiento('${r.id}','${area}',this.value)">
          <option value="pendiente" ${r.estado==='pendiente'?'selected':''}>Pendiente</option>
          <option value="gestionado" ${r.estado==='gestionado'?'selected':''}>Gestionado</option>
          <option value="validado" ${r.estado==='validado'?'selected':''}>Validado</option>
        </select>
      </td>
      <td onclick="event.stopPropagation()">
        <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
          onclick="eliminarSeguimiento('${r.id}','${area}')">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

async function actualizarObsSeguimiento(id, area, obs) {
  await sb.from('seguimiento_manuales').update({ observacion: obs, gestionado_por: currentUser }).eq('id', id);
  const row = segRows[area].find(r => r.id === id);
  if (row) { row.observacion = obs; row.gestionado_por = currentUser; }
}

async function cambiarEstadoSeguimiento(id, area, estado) {
  await sb.from('seguimiento_manuales').update({ estado, gestionado_por: currentUser, fecha: new Date().toISOString() }).eq('id', id);
  const row = segRows[area].find(r => r.id === id);
  if (row) { row.estado = estado; row.gestionado_por = currentUser; }
  renderSegTabla(area);
  toast(`Estado actualizado a ${estado}`, 'ok');
}

async function eliminarSeguimiento(id, area) {
  if (!confirm('¿Eliminar este registro de seguimiento?')) return;
  await sb.from('seguimiento_manuales').delete().eq('id', id);
  segRows[area] = segRows[area].filter(r => r.id !== id);
  renderSegTabla(area);
  toast('Registro eliminado', 'ok');
}

async function procesarSeguimientoPendientes(event, area) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const fechaBusqueda = document.getElementById(`seg-fecha-busqueda-${area}`).value;
  if (!fechaBusqueda) {
    toast('Indica hasta qué fecha y hora buscaste en LabCore antes de subir el Excel', 'err');
    document.getElementById(`seg-fecha-busqueda-${area}`).focus();
    return;
  }
  const busquedaUTC = localCOtoUTC(fechaBusqueda);
  toast('Procesando Excel...', 'info');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { toast('El archivo está vacío', 'err'); return; }

      function norm(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim(); }
      function getV(row, keys) {
        for (const k of Object.keys(row)) {
          if (keys.includes(norm(k))) return String(row[k]).trim();
        }
        return '';
      }

      const vistos = new Set();
      const muestrasUnicas = rows.map(row => ({
        od_id:    getV(row, ['OD_ID','ODID','OD ID','ID ORDEN']),
        nro:      getV(row, ['NRO_MUESTRA','NRO MUESTRA','NUMERO MUESTRA','CODIGO','CÓDIGO','NRO','MUESTRA']),
        estudio:  getV(row, ['ESTUDIO_NOMBRE','ESTUDIO NOMBRE','ESTUDIO','PRUEBA','EXAMEN']),
        paciente: getV(row, ['PACIENTE','APELLIDOS','NOMBRES']),
        cedula:   getV(row, ['IDENTIFICACION','CEDULA','DOCUMENTO']),
        sede:     getV(row, ['SEDE','INSTITUCION','INSTITUCIÓN']),
      })).filter(m => {
        const key = m.nro || m.od_id;
        if (!key || vistos.has(key)) return false;
        vistos.add(key); return true;
      });

      const nros = muestrasUnicas.map(m => m.nro).filter(Boolean);
      const {data: existentes} = await sb.from('seguimiento_manuales')
        .select('nro_muestra,estado').eq('area', area).in('nro_muestra', nros);
      const existentesMap = {};
      (existentes||[]).forEach(e => { existentesMap[e.nro_muestra] = e.estado; });

      const hoyISO = new Date().toISOString().slice(0,10);
      let nuevos = 0, yaExisten = 0, ignorados = 0;

      for (const m of muestrasUnicas) {
        const nro = m.nro;
        if (existentesMap[nro] === 'gestionado' || existentesMap[nro] === 'validado') { ignorados++; continue; }
        if (existentesMap[nro] === 'pendiente') { yaExisten++; continue; }

        const enGestor = allMuestras.find(x => x.nro_muestra === nro || x.od_id === m.od_id);
        let tipo = 'pendiente';
        if (!enGestor) {
          const {data: val} = await sb.from('validaciones').select('od_id').eq('od_id', m.od_id||'').limit(1);
          tipo = (val && val.length) ? 'validado_sin_ingreso' : 'fantasma';
        } else if (enGestor.estado === 'validado') { ignorados++; continue; }

        await sb.from('seguimiento_manuales').insert({
          nro_muestra: nro,
          od_id: m.od_id || enGestor?.od_id || null,
          estudio_nombre: m.estudio || enGestor?.estudio_nombre || null,
          observacion: null,
          estado: 'pendiente',
          tipo,
          area,
          gestionado_por: currentUser,
          revision_fecha: hoyISO,
          busqueda_hasta: busquedaUTC
        });
        nuevos++;
      }

      await cargarSeguimiento(area);
      document.getElementById(`seg-fecha-busqueda-${area}`).value = '';
      toast(`✓ ${nuevos} nuevas · ${yaExisten} ya existían · ${ignorados} ignoradas (gestionadas/validadas)`, 'ok');

    } catch(err) {
      toast('Error: ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

function diasHabilesGlobal(fechaInicio, fechaFin) {
  const FESTIVOS = new Set([
    '2025-01-01','2025-01-06','2025-03-24','2025-04-17','2025-04-18',
    '2025-05-01','2025-06-02','2025-06-23','2025-06-30','2025-07-20',
    '2025-08-07','2025-08-18','2025-10-13','2025-11-03','2025-11-17',
    '2025-12-08','2025-12-25',
    '2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03',
    '2026-05-01','2026-05-18','2026-06-08','2026-06-15','2026-06-29',
    '2026-07-20','2026-08-07','2026-08-17','2026-10-12','2026-11-02',
    '2026-11-16','2026-12-08','2026-12-25'
  ]);
  const start = new Date(fechaInicio + 'T12:00:00');
  const end = new Date(fechaFin + 'T12:00:00');
  if (end <= start) return 0;
  let count = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0,10);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !FESTIVOS.has(iso)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ============================================================
// INICIO
// ============================================================
