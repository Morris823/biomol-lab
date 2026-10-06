// ============================================================
// INGRESOS — importar Excel
// ============================================================
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').style.background = 'var(--bg2)';
  const file = e.dataTransfer.files[0];
  if (file) processIngresosFile(file);
}
function handleFileInput(e) { processIngresosFile(e.target.files[0]); }

async function processIngresosFile(file) {
  document.getElementById('imp-prog').style.display = 'block';
  document.getElementById('imp-result').style.display = 'none';
  setImpProgress(10, 'Leyendo archivo...');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, {type:'array'});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
  setImpProgress(30, 'Detectando formato...');
  const normalized = rows.map(r => detectAndNormalize(r)).filter(Boolean);

  // ---- Filtro: muestras que NO son del área y llegan por error de LabCore ----
  // Se excluyen VIH y ciertos VPH cuando vienen de sedes de OTRA regional.
  // IMPORTANTE: 1000107 (PAPILOMAVIRUS POR PCR) NUNCA se excluye — por ese código
  // llegan las de BASE LÍQUIDA de otras regionales que SÍ se procesan aquí, y no
  // se pueden distinguir por datos (solo por el envase físico).
  // Genotipificación de VIH (1001882) tampoco se toca: sí pertenece al área.
  const CODIGOS_EXCLUIR_OTRA_REGIONAL = new Set([
    '1000165', // VIH carga viral
    '1011771', // TAMIZAJE ADN-PVH POR PCR + CITOLOGIA VAGINAL
    '1009395', // TAMIZAJE ADN-PVH POR PCR + CCU LÍQUIDA
    '1002198', // VPH
  ]);
  const excluidas = [];
  const paraInsertar = normalized.filter(r => {
    const reg = getRegional(r.sede);
    // Solo excluye si la sede está catalogada en OTRA regional. Las sedes
    // desconocidas ('—') pasan (pueden ser nuevas de Antioquia) y quedan
    // visibles en "Sedes no reconocidas" para catalogarlas.
    const esOtraRegional = reg !== 'Antioquia' && reg !== '—';
    if (esOtraRegional && CODIGOS_EXCLUIR_OTRA_REGIONAL.has(String(r.estudio_codigo))) {
      excluidas.push(r);
      return false;
    }
    return true;
  });
  if (excluidas.length) console.table(excluidas.map(r => ({nro_muestra:r.nro_muestra, sede:r.sede, codigo:r.estudio_codigo, estudio:r.estudio_nombre})));

  setImpProgress(60, `Formato detectado. Insertando ${paraInsertar.length} registros...`);
  let nuevos = 0, dups = 0;
  const BATCH = 50;
  for (let i = 0; i < paraInsertar.length; i += BATCH) {
    const batch = paraInsertar.slice(i, i+BATCH);
    const ods = batch.map(r => r.od_id);
    const {data: existing} = await sb.from("ingresos").select("od_id").in("od_id", ods);
    const existingSet = new Set((existing||[]).map(r=>r.od_id));
    const toInsert = batch.filter(r => !existingSet.has(r.od_id));
    dups += batch.length - toInsert.length;
    if (toInsert.length > 0) {
      const {error} = await sb.from("ingresos").insert(toInsert.map(r => ({
        ...r,
        subido_por: currentUser,
        fecha_ingreso: new Date().toISOString()
      })));
      if (error) { console.error("Error batch:", error); toast("Error: "+error.message,"err"); }
      else nuevos += toInsert.length;
    }
    setImpProgress(60 + Math.round(((i+BATCH)/paraInsertar.length)*35), `Insertando... ${Math.min(i+BATCH,paraInsertar.length)}/${paraInsertar.length}`);
  }
  setImpProgress(100, '¡Importación completada!');
  document.getElementById('imp-total').textContent = rows.length;
  document.getElementById('imp-nuevos').textContent = nuevos;
  document.getElementById('imp-dups').textContent = dups;
  document.getElementById('imp-fmt').textContent = rows[0] && 'O_ID' in rows[0] ? 'Formato A' : 'Formato B';
  document.getElementById('imp-result').style.display = 'block';
  await loadMuestras({force:true});

  // Buscar recepciones sin ingreso que ahora sí tienen ingreso y actualizarlas
  await reconciliarSinIngreso(paraInsertar.map(r => r.nro_muestra));

  toast(`${nuevos} ingresos importados` +
        (excluidas.length ? ` · ${excluidas.length} omitidos (VIH/VPH de otras regionales)` : ''), 'ok');
}

async function reconciliarSinIngreso(nrosImportados) {
  // Traer todas las recepciones marcadas como sin_ingreso
  const {data: sinIngreso} = await sb.from('recepciones')
    .select('nro_muestra')
    .eq('sin_ingreso', true);
  if (!sinIngreso || sinIngreso.length === 0) return;

  // Ver cuáles de esas ahora sí están en los ingresos recién subidos
  const importadosSet = new Set(nrosImportados.filter(Boolean));
  const aActualizar = sinIngreso.filter(r => importadosSet.has(r.nro_muestra));

  if (aActualizar.length === 0) return;

  // Actualizar a sin_ingreso = false
  for (const r of aActualizar) {
    await sb.from('recepciones').update({sin_ingreso: false}).eq('nro_muestra', r.nro_muestra);
  }

  toast(`${aActualizar.length} muestra(s) sin ingreso ahora reconciliadas ✓`, 'info');
  await loadMuestras({force:true});
}

function setImpProgress(pct, lbl) {
  document.getElementById('imp-bar').style.width = pct + '%';
  document.getElementById('imp-lbl').textContent = lbl;
}

function detectAndNormalize(row) {
  // Normalizar claves: quitar espacios, tildes, mayúsculas para comparación
  const normalize = s => s.trim()
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')  // quitar tildes
    .replace(/\s+/g,' ');

  // Buscar valor por lista de candidatos (comparación normalizada)
  const get = (candidates) => {
    for (const c of candidates) {
      const cn = normalize(c);
      const found = Object.keys(row).find(k => normalize(k) === cn);
      if (found !== undefined && row[found] !== '' && row[found] !== null && row[found] !== undefined) {
        return String(row[found]).trim();
      }
    }
    return null;
  };

  // Campos obligatorios
  const od  = get(['OD_ID', 'OD ID']);
  const nro = get(['NRO MUESTRA', 'CODIGO MUESTRA', 'CÓDIGO MUESTRA', 'NRO_MUESTRA', 'NUMERO MUESTRA']);
  const estudio = get([
    'ESTUDIO NOMBRE', 'ESTUDIO', 'NOMBRE ESTUDIO',
    'DESCRIPCION ESTUDIO', 'DESCRIPCIÓN ESTUDIO', 'PRUEBA'
  ]);

  if (!od || !nro || !estudio) {
    console.warn('Fila ignorada — faltan campos obligatorios:', {od, nro, estudio}, row);
    return null;
  }

  // Filtrar solo pruebas del laboratorio por código de estudio
  const codEstudio = get([
    'ESTUDIO CÓDIGO', 'ESTUDIO CODIGO', 'COD ESTUDIO', 'CODIGO ESTUDIO', 'CÓDIGO ESTUDIO'
  ]);
  if (codEstudio) {
    const setValidos = codigosPruebas.size > 0 ? codigosPruebas : CODIGOS_VALIDOS;
    if (!setValidos.has(codEstudio)) {
      return null; // prueba no pertenece a este laboratorio
    }
  }
  // Si no hay código de estudio en el archivo, intentar filtrar por nombre
  if (!codEstudio) {
    const nombreEstudio = (estudio||'').toUpperCase();
    const nombresValidos = [
      'CITOMEGALOVIRUS','HEMOCROMATOSIS','MYCOBACTERIUM TUBERCULOSIS',
      'HLA-B','PAPILOMAVIRUS','TAMIZAJE ADN-PVH','VIH CARGA VIRAL',
      'HEPATITIS B, CARGA VIRAL','HEPATITIS C, CARGA VIRAL',
      'HOMOCISTEINA','GENOTIPIFICAC','HLA-B27','INTEGRASA','MTHFR',
      'PAPILOMAVIRUS HUMANO'
    ];
    if (!nombresValidos.some(n => nombreEstudio.includes(n))) {
      return null;
    }
  }

  return {
    od_id:         od,
    o_id:          get(['O_ID', 'O ID']),
    nro_muestra:   nro,
    identificacion: get([
      'IDENTIFICACIÓN', 'IDENTIFICACION',
      'CEDULA', 'CÉDULA', 'NRO IDENTIFICACION', 'NRO IDENTIFICACIÓN'
    ]),
    apellidos:     get(['APELLIDOS', 'APELLIDO']),
    nombres:       get(['NOMBRES', 'NOMBRE']),
    estudio_codigo: get([
      'ESTUDIO CÓDIGO', 'ESTUDIO CODIGO',
      'COD ESTUDIO', 'CODIGO ESTUDIO', 'CÓDIGO ESTUDIO'
    ]),
    estudio_nombre: estudio,
    tipo_muestra:  get(['MUESTRA', 'TIPO MUESTRA', 'TIPO_MUESTRA', 'TIPO', 'SECCION', 'SECCIÓN']),
    sede:          get([
      'INSTITUCION QUE ATIENDE', 'INSTITUCIÓN QUE ATIENDE',
      'SEDE', 'SUCURSAL', 'PUNTO', 'UBICACION ATENCION', 'UBICACIÓN ATENCIÓN'
    ]),
    fecha_solicitud: (() => {
      const raw = get(['FECHA SOLICITUD', 'FECHA', 'FECHA_SOLICITUD']);
      if (!raw) return null;
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 40000) {
        return excelSerialToUTC(num);
      }
      return raw;
    })(),
  };
}

