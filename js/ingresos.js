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

// ---- Órdenes con dos tubos (mismo OD_ID, dos códigos de LabCore) ----
// LabCore exporta una fila por tubo con el MISMO OD_ID (pasa sobre todo en Homocisteína).
// El ingreso se guarda una sola vez, con el tubo de número menor (el "principal"), y el
// otro código queda en tubos_adicionales. Los escáneres convierten el tubo adicional
// en el principal con resolverTubo(), así nunca cae en "Sin ingreso".
let tubosAdicionales = new Map();   // código adicional -> código principal

async function cargarTubosAdicionales() {
  const {data, error} = await sb.from('tubos_adicionales').select('nro_muestra,nro_principal');
  if (error) return; // si la tabla aún no existe, todo sigue funcionando como antes
  tubosAdicionales = new Map((data || []).map(t => [t.nro_muestra, t.nro_principal]));
}
const resolverTubo = cod => tubosAdicionales.get(String(cod || '').trim()) || cod;
const notaTuboAdicional = (original, principal) => original !== principal
  ? `<div style="font-size:11px;margin-top:4px;color:var(--accent)"><i class="ti ti-link"></i> <strong>${original}</strong> es el segundo tubo de la orden <strong>${principal}</strong> (mismo OD_ID): se registró con el código principal.</div>`
  : '';

async function processIngresosFile(file) {
  document.getElementById('imp-prog').style.display = 'block';
  document.getElementById('imp-result').style.display = 'none';
  setImpProgress(10, 'Leyendo archivo...');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, {type:'array'});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
  setImpProgress(30, 'Detectando formato...');
  const normalized = rows.map(r => detectAndNormalize(r)).filter(Boolean)
    .filter(r => !esHemoleucograma(r.estudio_codigo, r.estudio_nombre)); // nunca se guardan como ingreso
  // Hemoleucogramas (1001934): no se guardan como ingreso (el filtro de pruebas ya
  // los descarta); solo se usan para marcar las pruebas manuales del mismo tubo.
  const nrosHemo = nrosConHemograma(rows);

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

  // El mismo OD_ID puede venir repetido dentro del Excel. Si se manda dos veces en
  // el mismo lote, Supabase rechaza el lote COMPLETO (od_id es único) y se perdían
  // hasta 50 ingresos de golpe. Se deja una sola fila por OD_ID.
  // Si se repite con OTRO código de tubo, es una orden con dos tubos: se guarda el de
  // número menor como principal y los demás se registran como tubos adicionales.
  const tubosPorOd = new Map();
  for (const r of paraInsertar) { if (!tubosPorOd.has(r.od_id)) tubosPorOd.set(r.od_id, new Set()); tubosPorOd.get(r.od_id).add(r.nro_muestra); }
  const ordenados = [...paraInsertar].sort((a, b) => String(a.nro_muestra).localeCompare(String(b.nro_muestra)));
  const vistosOd = new Set();
  const unicos = ordenados.filter(r => { if (vistosOd.has(r.od_id)) return false; vistosOd.add(r.od_id); return true; });
  const repetidosArchivo = paraInsertar.length - unicos.length;

  setImpProgress(60, `Formato detectado. Insertando ${unicos.length} registros...`);
  let nuevos = 0, dups = 0;
  const guardados = new Set();   // nro_muestra con ingreso confirmado en la base (nuevo o ya existente)
  const fallidos = [];           // filas que no se pudieron guardar, con el motivo
  const fila = r => ({ ...r, subido_por: currentUser, fecha_ingreso: new Date().toISOString() });
  const BATCH = 50;
  for (let i = 0; i < unicos.length; i += BATCH) {
    const batch = unicos.slice(i, i+BATCH);
    const ods = batch.map(r => r.od_id);
    const {data: existing} = await sb.from("ingresos").select("od_id").in("od_id", ods);
    const existingSet = new Set((existing||[]).map(r=>r.od_id));
    batch.filter(r => existingSet.has(r.od_id)).forEach(r => guardados.add(r.nro_muestra));
    const toInsert = batch.filter(r => !existingSet.has(r.od_id));
    dups += batch.length - toInsert.length;
    if (toInsert.length > 0) {
      const {error} = await sb.from("ingresos").insert(toInsert.map(fila));
      if (!error) {
        nuevos += toInsert.length;
        toInsert.forEach(r => guardados.add(r.nro_muestra));
      } else {
        // El lote falló: se reintenta fila por fila para no perder las buenas
        console.error("Lote rechazado, reintentando fila por fila:", error);
        for (const r of toInsert) {
          const {error: e1} = await sb.from("ingresos").insert(fila(r));
          if (!e1) { nuevos++; guardados.add(r.nro_muestra); }
          else if (e1.code === '23505') { dups++; guardados.add(r.nro_muestra); } // ya existía
          else fallidos.push({ od_id: r.od_id, nro_muestra: r.nro_muestra, estudio: r.estudio_nombre, motivo: e1.message });
        }
      }
    }
    setImpProgress(60 + Math.round(((i+BATCH)/unicos.length)*35), `Insertando... ${Math.min(i+BATCH,unicos.length)}/${unicos.length}`);
  }
  setImpProgress(100, fallidos.length ? `Importación con ${fallidos.length} fila(s) sin guardar` : '¡Importación completada!');
  document.getElementById('imp-total').textContent = rows.length;
  document.getElementById('imp-nuevos').textContent = nuevos;
  document.getElementById('imp-dups').textContent = dups + repetidosArchivo;
  document.getElementById('imp-fmt').textContent = rows[0] && 'O_ID' in rows[0] ? 'Formato A' : 'Formato B';
  const fallEl = document.getElementById('imp-fallidos');
  if (fallEl) {
    fallEl.style.display = fallidos.length ? 'block' : 'none';
    fallEl.innerHTML = fallidos.length ? `<strong><i class="ti ti-alert-triangle"></i> ${fallidos.length} ingreso(s) NO se guardaron.</strong>
      Vuelve a subir el archivo; si siguen fallando, avísale al biólogo.
      <div style="margin-top:6px;font-family:var(--mono);font-size:11px;max-height:140px;overflow:auto">${fallidos.map(f => `${f.nro_muestra} · ${f.estudio || ''} — ${f.motivo}`).join('<br>')}</div>` : '';
  }
  if (fallidos.length) console.table(fallidos);
  document.getElementById('imp-result').style.display = 'block';
  const conHemo = await marcarConHemograma(unicos.filter(r => guardados.has(r.nro_muestra)), nrosHemo);
  await loadMuestras({force:true});

  const nTubos2 = await registrarTubosAdicionales(tubosPorOd);

  // Recepciones "sin ingreso" que ahora sí tienen ingreso: SOLO las de tubos cuyo
  // ingreso quedó guardado de verdad (antes se marcaban aunque el lote hubiera fallado)
  await reconciliarSinIngreso([...guardados]);

  if (fallidos.length) toast(`Atención: ${fallidos.length} ingreso(s) no se guardaron — revisa el resultado de la importación`, 'err');
  toast(`${nuevos} ingresos importados` +
        (nTubos2 ? ` · ${nTubos2} segundo(s) tubo(s) de la misma orden` : '') +
        (excluidas.length ? ` · ${excluidas.length} omitidos (VIH/VPH de otras regionales)` : '') +
        (conHemo ? ` · ${conHemo} con hemograma para rescatar de hematología` : ''), 'ok');
}

// Guarda los tubos adicionales de órdenes con dos tubos. El principal es el código
// con el que quedó el ingreso en la base (si ya existía de antes, se respeta ese).
async function registrarTubosAdicionales(tubosPorOd) {
  const multi = [...tubosPorOd].filter(([, nros]) => nros.size > 1);
  if (!multi.length) return 0;
  const ods = multi.map(([od]) => od);
  const {data: ings} = await sb.from('ingresos').select('od_id,nro_muestra').in('od_id', ods);
  const principalDe = new Map((ings || []).map(i => [i.od_id, i.nro_muestra]));
  const filas = [];
  for (const [od, nros] of multi) {
    const principal = principalDe.get(od);
    if (!principal) continue; // el ingreso no se guardó: queda en el recuadro rojo
    for (const n of nros) if (n !== principal) filas.push({ nro_muestra: n, nro_principal: principal, od_id: od });
  }
  if (!filas.length) return 0;
  const {error} = await sb.from('tubos_adicionales').upsert(filas, { onConflict: 'nro_muestra' });
  if (error) { console.error('Error guardando tubos adicionales:', error); toast('No se pudieron guardar los segundos tubos: ' + error.message, 'err'); return 0; }
  filas.forEach(f => tubosAdicionales.set(f.nro_muestra, f.nro_principal));
  // Si el segundo tubo ya se había escaneado (quedó "sin ingreso"), pasa al código principal
  for (const f of filas) {
    await sb.from('recepciones').update({ nro_muestra: f.nro_principal, sin_ingreso: false }).eq('nro_muestra', f.nro_muestra);
  }
  return filas.length;
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

