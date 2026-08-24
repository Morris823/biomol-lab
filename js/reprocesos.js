// ============================================================
// REPROCESOS
// ============================================================
const MOTIVOS = [
  {cod:'0008', desc:'Error de tarjeta controladora'},
  {cod:'0103', desc:'Pérdida de pasos en el motor'},
  {cod:'0120', desc:'Error de análisis, analizador detenido'},
  {cod:'0121', desc:'No se pudo procesar el análisis'},
  {cod:'0188', desc:'Fallo al iniciar la tarjeta controladora 4'},
  {cod:'0697', desc:'No hay una curva de calibración para el ensayo y el lote del conjunto de reactivos'},
  {cod:'1983', desc:'No se pudo procesar el resultado — la desviación estándar de referencia es demasiado alta'},
  {cod:'1987', desc:'La respuesta de la señal no es normal'},
  {cod:'1990', desc:'Valor objetivo no válido'},
  {cod:'1991', desc:'Fluorescencia no cumple criterios esperados'},
  {cod:'1992', desc:'Fluorescencia no cumple criterios esperados'},
  {cod:'1993', desc:'Fluorescencia no cumple criterios esperados'},
  {cod:'1996', desc:'Fluorescencia normalizada demasiado alta'},
  {cod:'1998', desc:'Fluorescencia no cumple criterios esperados'},
  {cod:'3000', desc:'Enviado a excepción manualmente por supervisor'},
  {cod:'3010', desc:'Macrofallida en unidad de amplificación — detección'},
  {cod:'3014', desc:'La temperatura del termociclador eléctrico no se encuentra dentro de los parámetros'},
  {cod:'3024', desc:'Verificación de lectura de fondo fallida en unidad de amplificación'},
  {cod:'3041', desc:'Error al recuperar los datos ópticos brutos'},
  {cod:'3043', desc:'Analizador detenido — análisis programado enviado a excepción'},
  {cod:'3044', desc:'Los análisis en curso se enviarán a las excepciones — el analizador se detuvo'},
  {cod:'4442', desc:'m2000 — código de error 4442'},
  {cod:'4496', desc:'m2000 — código de error 4496'},
  {cod:'5002', desc:'Error de movimiento en unidad Z'},
  {cod:'5009', desc:'Error en movimiento en unidad de pipeteo'},
  {cod:'5011', desc:'Error de aspiración de la muestra'},
  {cod:'5013', desc:'Código de error de detección de nivel de líquido'},
  {cod:'5017', desc:'Código de error de aspiración del brazo'},
  {cod:'5305', desc:'Fallo brazo de pipeteo / error brazo de pipeteo'},
  {cod:'5622', desc:'Error brazo de pipeteo (3) — error de aspiración 72'},
  {cod:'6011', desc:'Muestra caducada'},
  {cod:'6122', desc:'Error de uso del kit de amplificación'},
  {cod:'7005', desc:'Temperatura de Sample Prep / Lysis Heater fuera de márgenes'},
  {cod:'8199', desc:'El equipo está detenido o desconectado'},
  {cod:'9070', desc:'Fluorescencia no ha cumplido criterios esperados'},
  {cod:'9210', desc:'Número de ciclos del CI demasiado alto'},
  {cod:'9211', desc:'El número de ciclos del control interno es demasiado bajo'},
  {cod:'9212', desc:'Control interno fallido'},
  {cod:'9270', desc:'Fluorescencia no cumple criterios esperados'},
  {cod:'9271', desc:'Fluorescencia no cumple criterios esperados'},
  {cod:'9274', desc:'Control celular fallido'},
  {cod:'9392', desc:'Se ha producido un error inesperado al ejecutar la operación solicitada'},
  {cod:'CONF',  desc:'Confirmación de carga y/o resultado'},
  {cod:'CTRL+', desc:'Fallo de control positivo'},
  {cod:'OTRO',  desc:'Otro — especificar en observaciones'},
];
let acIdx = -1;

function acSearch(val) {
  const drop = document.getElementById('ac-drop');
  if (selectedMotivo) { drop.classList.remove('open'); return; }
  const q = val.trim().toLowerCase();
  if (!q) { drop.classList.remove('open'); return; }
  const results = MOTIVOS.filter(m => m.cod.startsWith(q) || m.desc.toLowerCase().includes(q));
  if (!results.length) { drop.innerHTML=`<div style="padding:9px 12px;font-size:11px;color:var(--text3)">Sin resultados</div>`; drop.classList.add('open'); return; }
  acIdx = -1;
  drop.innerHTML = results.map(m=>`
    <div class="ac-item" data-cod="${m.cod}" data-desc="${m.desc.replace(/"/g,'&quot;')}"
      onmousedown="selectMotivo('${m.cod}','${m.desc.replace(/'/g,"\\'")}')">
      <span class="ac-code">${m.cod}</span>
      <span style="color:var(--text2)">${m.desc}</span>
    </div>`).join('');
  drop.classList.add('open');
}

function acKey(e) {
  const items = document.querySelectorAll('#ac-drop .ac-item');
  if (e.key==='ArrowDown'){e.preventDefault();acIdx=Math.min(acIdx+1,items.length-1);}
  else if(e.key==='ArrowUp'){e.preventDefault();acIdx=Math.max(acIdx-1,0);}
  else if(e.key==='Enter'&&acIdx>=0){const it=items[acIdx];selectMotivo(it.dataset.cod,it.dataset.desc);}
  else if(e.key==='Escape')closeAc();
  items.forEach((it,i)=>it.classList.toggle('hi',i===acIdx));
}

function selectMotivo(cod, desc) {
  selectedMotivo = {cod, desc};
  document.getElementById('rep-motivo-input').value='';
  document.getElementById('rep-motivo-input').placeholder=`${cod} — ${desc}`;
  const el=document.getElementById('sel-motivo');
  el.style.display='flex';
  document.getElementById('sel-motivo-txt').textContent=`${cod} — ${desc}`;
  closeAc();
}

function clearMotivo() {
  selectedMotivo=null;
  document.getElementById('rep-motivo-input').value='';
  document.getElementById('rep-motivo-input').placeholder="Ej: 5011 o 'aspiración'...";
  document.getElementById('sel-motivo').style.display='none';
  document.getElementById('rep-motivo-input').focus();
}

function closeAc(){document.getElementById('ac-drop').classList.remove('open');acIdx=-1;}

async function registrarReproceso(esNuevaMuestra) {
  const cod = document.getElementById('rep-cod').value.trim();
  const prueba = document.getElementById('rep-prueba').value;
  if (!cod) { toast('Ingresa el código de muestra', 'err'); return; }
  if (!selectedMotivo) { toast('Selecciona un motivo', 'err'); return; }
  const ingreso = allMuestras.find(m => m.nro_muestra === cod || m.od_id === cod);
  const od = ingreso?.od_id || cod;

  // Contar cuántas veces ha estado en reproceso para alertar
  const {count: vecesRep} = await sb.from('reprocesos').select('*',{count:'exact',head:true}).eq('nro_muestra', cod);
  const vecesTotal = (vecesRep||0) + 1;
  if (vecesTotal > 1) toast(`⚠ Este código ya estuvo en reproceso ${vecesRep} vez(ces) antes`, 'info');

  if (esNuevaMuestra) {
    const {error} = await sb.from('nuevas_muestras').insert({
      od_id: od, nro_muestra: cod, estudio_nombre: prueba,
      motivo: selectedMotivo.cod + ' — ' + selectedMotivo.desc,
      registrado_por: currentUser
    });
    if (error) { toast('Error: '+error.message,'err'); return; }
    toast('Nueva muestra solicitada', 'ok');
  } else {
    const {error} = await sb.from('reprocesos').insert({
      od_id: od, nro_muestra: cod, estudio_nombre: prueba,
      codigo_motivo: selectedMotivo.cod, desc_motivo: selectedMotivo.desc,
      registrado_por: currentUser
    });
    if (error) { toast('Error: '+error.message,'err'); return; }
    toast('Reproceso registrado', 'ok');
  }
  document.getElementById('rep-cod').value='';
  clearMotivo();
  await loadMuestras({force:true});
  loadReprocesos();
}

let repFiltro = 'activos'; // 'activos' | 'historico'
function chipRep(el, val) {
  document.querySelectorAll('#page-reprocesos .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active'); repFiltro = val; loadReprocesos();
}

async function loadReprocesos() {
  const {data:reps} = await sb.from('reprocesos').select('*').order('fecha',{ascending:false}).limit(200);
  let all = (reps||[]).map(r=>({...r,tipo:'reproceso'}));
  all.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

  // Sincronizar estado_final permanente contra Supabase (no depende de allMuestras)
  // Reutiliza el mismo patrón de matrículas/TB: solo actualiza hacia validado/nueva-muestra, nunca revierte
  const pendientesSync = all.filter(r => r.estado_final !== 'validado' && r.estado_final !== 'nueva-muestra');
  if (pendientesSync.length) {
    const nros = [...new Set(pendientesSync.map(r => r.nro_muestra).filter(Boolean))];
    const odIdsDirectos = pendientesSync.map(r => r.od_id).filter(Boolean);

    const {data: ings} = nros.length
      ? await sb.from('ingresos').select('od_id,nro_muestra').in('nro_muestra', nros)
      : { data: [] };
    const odIdsTodos = [...new Set([...odIdsDirectos, ...(ings||[]).map(i=>i.od_id)])];

    const [{data: vals}, {data: nms}] = await Promise.all([
      odIdsTodos.length ? sb.from('validaciones').select('od_id').in('od_id', odIdsTodos) : Promise.resolve({data:[]}),
      odIdsTodos.length ? sb.from('nuevas_muestras').select('od_id').in('od_id', odIdsTodos) : Promise.resolve({data:[]})
    ]);

    const validadosSet = new Set((vals||[]).map(v=>v.od_id));
    const nmsSet = new Set((nms||[]).map(n=>n.od_id));
    const nroToOdId = {};
    (ings||[]).forEach(i => { nroToOdId[i.nro_muestra] = i.od_id; });

    for (const r of pendientesSync) {
      const odId = r.od_id || nroToOdId[r.nro_muestra];
      let nuevoEstado = null;
      if (odId && validadosSet.has(odId)) nuevoEstado = 'validado';
      else if (odId && nmsSet.has(odId)) nuevoEstado = 'nueva-muestra';
      if (nuevoEstado) {
        await sb.from('reprocesos').update({ estado_final: nuevoEstado }).eq('id', r.id);
        r.estado_final = nuevoEstado;
      }
    }
  }

  // Calcular conteo de reprocesos por nro_muestra
  const conteoRep = {};
  (reps||[]).forEach(r => { conteoRep[r.nro_muestra] = (conteoRep[r.nro_muestra]||0)+1; });

  // Filtrar según pestaña — usa estado_final (permanente) primero, allMuestras como respaldo
  if (repFiltro === 'activos') {
    all = all.filter(r => {
      if (r.estado_final === 'validado' || r.estado_final === 'nueva-muestra') return false;
      const muestra = allMuestras.find(m => m.nro_muestra === r.nro_muestra || m.od_id === r.od_id);
      if (!muestra) return true;
      return muestra.estado !== 'validado' && muestra.estado !== 'nueva-muestra';
    });
  }

  // Filtro de búsqueda
  const qRep = (document.getElementById('rep-buscar')?.value || '').trim().toLowerCase();
  if (qRep) {
    all = all.filter(r => {
      const muestra = allMuestras.find(m => m.nro_muestra === r.nro_muestra || m.od_id === r.od_id);
      return r.nro_muestra?.toLowerCase().includes(qRep) ||
             (muestra?.paciente||'').toLowerCase().includes(qRep) ||
             (r.estudio_nombre||'').toLowerCase().includes(qRep) ||
             (r.desc_motivo||'').toLowerCase().includes(qRep);
    });
  }

  // Opciones de prueba para el dropdown editable
  const pruebasOpts = Object.keys(CONFIG_PRUEBA).filter(k => k !== 'HIV')
    .map(k => `<option value="${k}">${k}</option>`).join('');

  document.getElementById('rep-tabla').innerHTML = all.length
    ? all.map(r => {
        const muestra = allMuestras.find(m => m.nro_muestra === r.nro_muestra || m.od_id === r.od_id);
        // estado_final permanente tiene prioridad sobre lo que haya (o no) en allMuestras
        const estadoActual = r.estado_final || (muestra ? muestra.estado : '—');
        const veces = conteoRep[r.nro_muestra] || 1;
        const vecesBadge = veces > 1
          ? `<span style="font-size:9px;padding:1px 5px;border-radius:8px;background:var(--red-bg);color:var(--red);border:0.5px solid var(--red-border);font-weight:600;margin-left:4px">×${veces}</span>`
          : '';
        const pruebaActual = r.estudio_nombre ? nombreCorto(r.estudio_nombre,'') : '';
        const tabla = 'reprocesos';
        return `<tr>
          <td class="mono">${fmt(r.fecha)}</td>
          <td class="mono">${r.nro_muestra}${vecesBadge}</td>
          <td onclick="event.stopPropagation()">
            <select style="font-size:11px;padding:2px 4px;border-radius:4px;border:0.5px solid var(--border2);background:var(--bg2)"
              onchange="editarPruebaReproceso('${r.id}','${tabla}',this.value)">
              <option value="" disabled ${!pruebaActual?'selected':''}>—</option>
              ${Object.keys(CONFIG_PRUEBA).filter(k=>k!=='HIV').map(k=>
                `<option value="${k}" ${k===pruebaActual?'selected':''}>${k}</option>`
              ).join('')}
            </select>
          </td>
          <td style="font-size:11px">${r.codigo_motivo} — ${r.desc_motivo||''}</td>
          <td style="font-size:11px;color:var(--text2)">${r.registrado_por}</td>
          <td>${estadoActual && estadoActual !== '—' ? pill(estadoActual) : '<span style="color:var(--text3);font-size:11px">—</span>'}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
              onclick="eliminarReproceso('${r.id}','${tabla}','${r.nro_muestra}')"
              title="Eliminar registro">
              <i class="ti ti-trash"></i>
            </button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6" class="empty-state">${repFiltro==='activos'?'Sin reprocesos activos 🎉':'Sin reprocesos registrados'}</td></tr>`;
}

async function eliminarReproceso(id, tabla, nroMuestra) {
  if (!confirm(`¿Eliminar el registro de reproceso para ${nroMuestra}?\n\nEsta acción no se puede deshacer.`)) return;
  const {error} = await sb.from(tabla).delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Registro eliminado', 'ok');
  loadReprocesos();
}

async function editarPruebaReproceso(id, tabla, nuevaPrueba) {
  const {error} = await sb.from(tabla).update({ estudio_nombre: nuevaPrueba }).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast(`Prueba actualizada a ${nuevaPrueba}`, 'ok');
}

// ============================================================
// NUEVAS MUESTRAS (separado de reprocesos)
// ============================================================
async function loadNuevasMuestras() {
  const {data} = await sb.from('nuevas_muestras').select('*').order('fecha',{ascending:false}).limit(300);
  let all = data || [];

  const q = (document.getElementById('nm-buscar')?.value || '').trim().toLowerCase();
  if (q) {
    all = all.filter(r => {
      const muestra = allMuestras.find(m => m.nro_muestra === r.nro_muestra || m.od_id === r.od_id);
      return r.nro_muestra?.toLowerCase().includes(q) ||
             (muestra?.paciente||'').toLowerCase().includes(q) ||
             (r.estudio_nombre||'').toLowerCase().includes(q) ||
             (r.motivo||'').toLowerCase().includes(q);
    });
  }

  document.getElementById('nm-count').textContent = all.length + ' registros';

  document.getElementById('nm-tabla').innerHTML = all.length
    ? all.map(r => {
        const muestra = allMuestras.find(m => m.nro_muestra === r.nro_muestra || m.od_id === r.od_id);
        const estadoActual = muestra ? muestra.estado : '—';
        const pruebaActual = r.estudio_nombre ? nombreCorto(r.estudio_nombre,'') : '';
        return `<tr>
          <td class="mono">${fmt(r.fecha)}</td>
          <td class="mono">${r.nro_muestra}</td>
          <td onclick="event.stopPropagation()">
            <select style="font-size:11px;padding:2px 4px;border-radius:4px;border:0.5px solid var(--border2);background:var(--bg2)"
              onchange="editarPruebaReproceso('${r.id}','nuevas_muestras',this.value)">
              <option value="" disabled ${!pruebaActual?'selected':''}>—</option>
              ${Object.keys(CONFIG_PRUEBA).filter(k=>k!=='HIV').map(k=>
                `<option value="${k}" ${k===pruebaActual?'selected':''}>${k}</option>`
              ).join('')}
            </select>
          </td>
          <td style="font-size:11px">${r.motivo||'—'}</td>
          <td style="font-size:11px;color:var(--text2)">${r.registrado_por}</td>
          <td>${muestra ? pill(estadoActual) : '<span style="color:var(--text3);font-size:11px">—</span>'}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
              onclick="eliminarReproceso('${r.id}','nuevas_muestras','${r.nro_muestra}')"
              title="Eliminar registro">
              <i class="ti ti-trash"></i>
            </button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty-state">Sin nuevas muestras registradas</td></tr>';
}

