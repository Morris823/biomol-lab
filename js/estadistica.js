// ============================================================
// ESTADÍSTICA MENSUAL DE EQUIPOS (backup)
// ============================================================
const PRUEBAS_ESTADISTICA = ['CMV','HIV','HBV','HCV','HPV'];

// Mapeo de nombres de ensayo (tal como aparecen en "Nombre del ensayo") a las columnas del reporte
const ENSAYO_A_PRUEBA = {
  'HIV-1': 'HIV',
  'HBV': 'HBV',
  'HCV': 'HCV',
  'CMV-PL': 'CMV',
  'HR HPV': 'HPV'
};

// Identificar tipo de archivo por su nombre
function detectarTipoArchivoEstadistica(nombreArchivo) {
  const n = nombreArchivo.toUpperCase();
  if (n.includes('QCEXCEPTION')) return 'EXCEP CTRL';
  if (n.includes('SPECIMENEXCEPTION')) return 'REPROCESOS';
  if (n.includes('QCRESULT')) return 'CONTROLES';
  if (n.includes('CALEXCEPTION')) return 'EXCEP CAL';
  if (n.includes('CALRESULT')) return 'CALIBRADORES';
  return null;
}

let estadisticaAcumulado = {}; // { 'CONTROLES': {CMV:0,HIV:0,...}, ... }
let estadisticaArchivosCargados = [];

function initEstadistica() {
  estadisticaAcumulado = {
    'CONTROLES':    { CMV:0, HIV:0, HBV:0, HCV:0, HPV:0 },
    'CALIBRADORES': { CMV:0, HIV:0, HBV:0, HCV:0, HPV:0 },
    'EXCEP CTRL':   { CMV:0, HIV:0, HBV:0, HCV:0, HPV:0 },
    'EXCEP CAL':    { CMV:0, HIV:0, HBV:0, HCV:0, HPV:0 },
    'REPROCESOS':   { CMV:0, HIV:0, HBV:0, HCV:0, HPV:0 },
  };
  estadisticaArchivosCargados = [];
  document.getElementById('est-archivos-cargados').innerHTML = '';
  document.getElementById('est-resultado-panel').style.display = 'none';
}

async function procesarArchivosEstadistica(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  event.target.value = '';

  for (const file of files) {
    const tipo = detectarTipoArchivoEstadistica(file.name);
    if (!tipo) {
      toast(`No se pudo identificar el tipo de archivo: ${file.name}`, 'err');
      continue;
    }
    await procesarUnArchivoEstadistica(file, tipo);
  }

  renderArchivosCargados();
  renderTablaEstadistica();
}

function procesarUnArchivoEstadistica(file, tipo) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) {
          toast(`${file.name} está vacío`, 'err');
          resolve();
          return;
        }

        // Buscar la columna "Nombre del ensayo" sin importar en qué posición esté
        const primeraFila = rows[0];
        const colEnsayo = Object.keys(primeraFila).find(k => k.trim().toLowerCase() === 'nombre del ensayo');

        if (!colEnsayo) {
          toast(`No se encontró la columna "Nombre del ensayo" en ${file.name}`, 'err');
          resolve();
          return;
        }

        let contadosEnEsteArchivo = { CMV:0, HIV:0, HBV:0, HCV:0, HPV:0 };
        let noMapeados = new Set();

        rows.forEach(row => {
          const nombreEnsayo = String(row[colEnsayo] || '').trim();
          const prueba = ENSAYO_A_PRUEBA[nombreEnsayo];
          if (prueba) {
            estadisticaAcumulado[tipo][prueba]++;
            contadosEnEsteArchivo[prueba]++;
          } else if (nombreEnsayo) {
            noMapeados.add(nombreEnsayo);
          }
        });

        estadisticaArchivosCargados.push({
          nombre: file.name, tipo, total: rows.length, contados: contadosEnEsteArchivo, noMapeados: [...noMapeados]
        });

        if (noMapeados.size) {
          toast(`${file.name}: ensayos no reconocidos — ${[...noMapeados].join(', ')}`, 'info');
        }
      } catch (err) {
        toast(`Error procesando ${file.name}: ${err.message}`, 'err');
      }
      resolve();
    };
    reader.readAsArrayBuffer(file);
  });
}

function renderArchivosCargados() {
  const el = document.getElementById('est-archivos-cargados');
  if (!estadisticaArchivosCargados.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<table>
    <thead><tr><th>Archivo</th><th>Tipo detectado</th><th style="text-align:center">Filas totales</th><th>Ensayos no reconocidos</th></tr></thead>
    <tbody>
      ${estadisticaArchivosCargados.map(a => `<tr>
        <td style="font-size:11px">${a.nombre}</td>
        <td><span style="font-size:10px;padding:2px 7px;border-radius:8px;background:var(--accent-bg);color:var(--accent)">${a.tipo}</span></td>
        <td style="text-align:center">${a.total}</td>
        <td style="font-size:11px;color:${a.noMapeados.length?'var(--red)':'var(--text3)'}">${a.noMapeados.length ? a.noMapeados.join(', ') : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderTablaEstadistica() {
  const panel = document.getElementById('est-resultado-panel');
  panel.style.display = 'block';

  const filas = ['CONTROLES','CALIBRADORES','EXCEP CTRL','EXCEP CAL','REPROCESOS'];

  const tabla = document.getElementById('est-tabla-resultado');
  tabla.innerHTML = `
    <thead>
      <tr>
        <th>CONTEO BACK UP</th>
        <th style="text-align:center">TOTAL</th>
        ${PRUEBAS_ESTADISTICA.map(p => `<th style="text-align:center">${p}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${filas.map(fila => {
        const datos = estadisticaAcumulado[fila];
        const total = PRUEBAS_ESTADISTICA.reduce((a,p) => a + (datos[p]||0), 0);
        return `<tr>
          <td style="font-weight:600">${fila}</td>
          <td style="text-align:center;font-weight:600">${total}</td>
          ${PRUEBAS_ESTADISTICA.map(p => `<td style="text-align:center">${datos[p]||0}</td>`).join('')}
        </tr>`;
      }).join('')}
    </tbody>`;
}

function copiarEstadistica() {
  const filas = ['CONTROLES','CALIBRADORES','EXCEP CTRL','EXCEP CAL','REPROCESOS'];
  const encabezado = ['CONTEO BACK UP','TOTAL',...PRUEBAS_ESTADISTICA].join('\t');
  const cuerpo = filas.map(fila => {
    const datos = estadisticaAcumulado[fila];
    const total = PRUEBAS_ESTADISTICA.reduce((a,p) => a + (datos[p]||0), 0);
    return [fila, total, ...PRUEBAS_ESTADISTICA.map(p => datos[p]||0)].join('\t');
  });
  const texto = [encabezado, ...cuerpo].join('\n');
  navigator.clipboard.writeText(texto).then(() => toast('Tabla copiada — pega en Excel', 'ok'));
}

