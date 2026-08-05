// ============================================================
// VALIDACIÓN — importar validados
// ============================================================
async function loadValHist() {
  const {data} = await sb.from('importaciones_validados').select('*').order('created_at', {ascending:false}).limit(10);
  document.getElementById('val-hist').innerHTML = data && data.length
    ? data.map((d,i)=>`<div class="val-hist-item">
        <span>${d.importado_por}</span>
        <span style="color:var(--text2)">hasta ${fmt(d.hasta_fecha)} ${fmtHora(d.hasta_fecha)}</span>
        <span style="color:var(--green)">${d.total_validados} validados</span>
        ${i===0?'<span style="font-size:10px;padding:1px 7px;background:var(--accent-bg);color:var(--accent);border-radius:10px">← buscar desde aquí</span>':''}
      </div>`).join('')
    : '<div style="color:var(--text3);font-size:12px">Sin importaciones previas</div>';
}

async function handleValFile(e) {
  const hastaLocal = document.getElementById('val-hasta').value;
  if (!hastaLocal) { toast('Indica hasta qué fecha/hora buscaste en LabCore', 'err'); return; }
  // Convertir de hora Colombia a UTC antes de guardar en Supabase
  const hasta = localCOtoUTC(hastaLocal);
  const file = e.target.files[0];
  if (!file) return;

  // Mostrar progreso
  const progArea = document.getElementById('val-prog-area');
  const progBar = document.getElementById('val-prog-bar');
  const progLbl = document.getElementById('val-prog-lbl');
  if (progArea) { progArea.style.display='block'; progBar.style.width='5%'; progLbl.textContent='Leyendo archivo: ' + file.name; }

  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch(err) {
    toast('No se pudo leer el archivo: ' + err.message, 'err');
    if (progArea) progArea.style.display='none';
    return;
  }

  let wb, rows;
  try {
    wb = XLSX.read(buffer, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, {defval:''});
  } catch(err) {
    toast('Error al procesar el Excel: ' + err.message, 'err');
    if (progArea) progArea.style.display='none';
    return;
  }

  if (!rows.length) { toast('El archivo está vacío o no se pudo leer', 'err'); if(progArea) progArea.style.display='none'; return; }
  if (progBar) { progBar.style.width='20%'; progLbl.textContent='Detectando columnas (' + rows.length + ' filas)...'; }

  // Normalizar claves igual que en ingresos
  const nk = s => s.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ');
  const getV = (row, cands) => {
    for (const cand of cands) {
      const cn = nk(cand);
      const found = Object.keys(row).find(k => nk(k) === cn);
      if (found !== undefined && row[found] !== '' && row[found] !== null && row[found] !== undefined)
        return String(row[found]).trim();
    }
    return null;
  };

  let count = 0, errores = 0;
  const BATCH = 50;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const toUpsert = [];

    for (const row of batch) {
      // OD_ID es obligatorio
      const od = getV(row, ['OD_ID','OD ID','ODID']);
      if (!od) continue;

      // Filtrar solo pruebas del laboratorio por código
      const codEstudio = getV(row, ['ESTUDIO CODIGO','ESTUDIO CÓDIGO','COD ESTUDIO','CODIGO ESTUDIO']);
      if (codEstudio) {
        const setVal = codigosPruebas.size > 0 ? codigosPruebas : CODIGOS_VALIDOS;
        if (!setVal.has(codEstudio)) continue;
      }

      // Fecha de validación — si no viene en el archivo usar el "hasta" seleccionado
      let fechaVal = getV(row, ['FECHA VALIDACION','FECHA VALIDACIÓN','FECHA RESULTADO','FECHA_VALIDACION']) || hasta;

      // Convertir serial de Excel si aplica
      const num = parseFloat(fechaVal);
      if (!isNaN(num) && num > 40000) {
        fechaVal = excelSerialToUTC(num);
      } else if (typeof fechaVal === 'string' && fechaVal.includes('T') && !fechaVal.includes('Z') && !fechaVal.includes('+')) {
        // String datetime sin TZ — asumir Colombia
        fechaVal = localCOtoUTC(fechaVal.slice(0,16));
      }

      toUpsert.push({
        od_id: od,
        fecha_validacion: fechaVal,
        importado_por: currentUser,
        hasta_fecha: hasta
      });
    }

    if (!toUpsert.length) continue;
    if (progBar) {
      const pct = 20 + Math.round(((i+BATCH)/rows.length)*70);
      progBar.style.width = pct + '%';
      progLbl.textContent = `Importando... ${Math.min(i+BATCH, rows.length)} de ${rows.length}`;
    }
    try {
      const {error} = await sb.from('validaciones')
        .upsert(toUpsert, {onConflict: 'od_id'});
      if (error) {
        console.error('Batch val error:', error);
        errores += toUpsert.length;
        toast('Error en lote: ' + error.message, 'err');
      } else {
        count += toUpsert.length;
      }
    } catch(err) {
      console.error('Fetch error:', err);
      errores += toUpsert.length;
      toast('Error de red: ' + err.message + ' — intenta de nuevo', 'err');
    }
  }

  if (progBar) { progBar.style.width='100%'; progLbl.textContent='¡Listo! ' + count + ' validados importados.'; }

  try {
    await sb.from('importaciones_validados').insert({
      importado_por: currentUser,
      hasta_fecha: hasta,
      total_validados: count
    });
  } catch(err) { console.error('Error guardando historial:', err); }

  await loadMuestras({force:true});
  await loadValHist();
  e.target.value = '';
  setTimeout(() => { if(progArea) progArea.style.display='none'; }, 3000);
  if (errores > 0) toast(`${count} validados importados (${errores} con error)`, 'info');
  else toast(`✓ ${count} validados importados correctamente`, 'ok');
}

