// ============================================================
// RESUMEN DEL DÍA — sale la primera vez que se abre el gestor en el día
// ============================================================
// Reemplaza la antigua entrega de turno: apenas la persona entra a su área (o al
// terminar de cargar el gestor, si ya entró), aparece una ventana con lo que está
// fuera de oportunidad o a punto de salir y los pendientes importantes. Una vez por
// día en cada computador; se puede volver a abrir con verResumenDiario().
// ============================================================
function irPagina(name) {
  nav(name, [...document.querySelectorAll('.sidebar .nav-item')].find(n => (n.getAttribute('onclick') || '').includes("nav('" + name + "'")));
}

// Lo que está fuera de oportunidad o a punto de salir, y los pendientes importantes. Sale de lo que ya está en memoria,
// más un conteo (sin descargar filas) de los sin ingreso.
async function renderUrgentes(el) {
  if (!el) return;
  const M = allMuestras || [];
  const corto = m => nombreCorto(m.estudio_nombre, m.estudio_codigo);
  const hoy = hoyCO();
  // Días hábiles que quedan (negativo = vencida), desde el primer montaje de la prueba
  const op = m => oportunidadMuestra(m)?.quedan ?? null;
  const tubos = arr => new Set(arr.map(m => m.nro_muestra)).size;
  const manuales = typeof PRUEBAS_MANUALES_SANGRE !== 'undefined' ? PRUEBAS_MANUALES_SANGRE : new Set();

  // Por recibir (todas las pruebas, desde el ingreso)
  const porRecibir = M.filter(m => m.estado === 'pendiente' && !m.gestionada && corto(m) !== 'TB');
  const recVenc = porRecibir.filter(m => (op(m) ?? 99) < 0), recPorVencer = porRecibir.filter(m => [0, 1].includes(op(m)));
  // Manuales sin resultado
  const man = M.filter(m => manuales.has(corto(m)) && ['pendiente', 'sin-validar'].includes(m.estado));
  const manVenc = man.filter(m => (op(m) ?? 99) < 0), manPorVencer = man.filter(m => [0, 1].includes(op(m)));
  // TB (meta 48 h)
  const tb = typeof resumenOportunidadTB === 'function' ? resumenOportunidadTB() : { espera: [], vencidas: 0, porVencer: 0 };
  const tbAlerta = tb.espera.filter(m => m.horas >= 36);
  // Sin ingreso y hematología
  const {count: sinIng} = await sb.from('recepciones').select('id', { count: 'exact', head: true }).eq('sin_ingreso', true);
  const rescate = typeof muestrasRescateHemato === 'function' ? tubos(muestrasRescateHemato().filter(m => !m.gestionada)) : 0;

  const fila = (icono, titulo, venc, porV, detalle, pagina) => {
    const col = venc ? 'var(--red)' : porV ? 'var(--yellow)' : 'var(--green)';
    const bg = venc ? 'var(--red-bg)' : porV ? 'var(--yellow-bg)' : 'var(--bg2)';
    return `<div style="display:flex;gap:10px;align-items:center;padding:9px 11px;border-radius:var(--radius);background:${bg};margin-bottom:8px">
      <i class="ti ${icono}" style="font-size:18px;color:${col}"></i>
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600">${titulo}</div>
        <div style="font-size:11px;color:var(--text2)">${detalle}</div></div>
      ${pagina ? `<button class="btn" style="font-size:11px;padding:3px 9px" onclick="cerrarResumenDiario();irPagina('${pagina}')">Ver</button>` : ''}
    </div>`;
  };
  const cods = arr => arr.slice(0, 4).map(m => `<span class="mono">${m.nro_muestra}</span>`).join(', ') + (arr.length > 4 ? '…' : '');
  el.innerHTML =
    fila('ti-lungs', `TB: ${tb.vencidas} vencida${tb.vencidas !== 1 ? 's' : ''} · ${tb.porVencer} por vencer`, tb.vencidas, tb.porVencer,
      tbAlerta.length ? 'Más de 36 h desde la recepción: ' + cods(tbAlerta) : 'Ninguna pasa de 36 h', 'tuberculosis') +
    fila('ti-package', `Por recibir: ${tubos(recVenc)} tubo${tubos(recVenc) !== 1 ? 's' : ''} fuera de oportunidad · ${tubos(recPorVencer)} vencen hoy o mañana`, recVenc.length, recPorVencer.length,
      recVenc.length ? 'Ingresadas y sin llegar: ' + cods(recVenc) : `${tubos(porRecibir)} tubos pendientes por recibir en total`, 'pendientes') +
    fila('ti-flask-2', `Manuales: ${manVenc.length} fuera de oportunidad · ${manPorVencer.length} vencen hoy o mañana`, manVenc.length, manPorVencer.length,
      manVenc.length ? cods(manVenc) : `${man.length} pruebas manuales sin resultado`, 'revision-manuales') +
    fila('ti-alert-circle', `Sin ingreso: ${sinIng || 0}`, 0, sinIng || 0, sinIng ? 'Tubos escaneados que todavía no tienen ingreso' : 'Todo lo escaneado tiene ingreso', 'sin-ingreso') +
    fila('ti-droplet', `Por rescatar de hematología: ${rescate}`, 0, rescate, rescate ? 'Tubos con hemograma que hay que pedir a hematología' : 'Nada por rescatar', 'hematologia') +
    '<div style="font-size:10.5px;color:var(--text3);margin-top:4px">Oportunidad en días hábiles según cada prueba; TB en horas (meta 48 h).</div>';
}

function cerrarResumenDiario() {
  if (window._modalResumen) { window._modalResumen.remove(); window._modalResumen = null; }
}

async function mostrarResumenDiario(forzar) {
  const key = 'resumenShown_' + hoyCO();
  if (!forzar) { try { if (localStorage.getItem(key)) return; } catch (e) {} }
  if (window._modalResumen) return;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:8500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--radius-lg);max-width:600px;width:100%;padding:20px 22px;max-height:90vh;overflow-y:auto">
      <div style="font-size:17px;font-weight:600;margin-bottom:2px"><i class="ti ti-alert-triangle"></i> Lo urgente de hoy</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Lo que está fuera de oportunidad o a punto de salir, y los pendientes importantes</div>
      <div id="resumen-diario-cuerpo"><div class="empty-state">Cargando...</div></div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-primary" onclick="cerrarResumenDiario()">Entendido</button></div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) cerrarResumenDiario(); });
  document.body.appendChild(modal);
  window._modalResumen = modal;
  try { localStorage.setItem(key, '1'); } catch (e) {}
  await renderUrgentes(document.getElementById('resumen-diario-cuerpo'));
}
const verResumenDiario = () => mostrarResumenDiario(true);
