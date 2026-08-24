// ============================================================
// SEDES NO RECONOCIDAS EN SEDE_REGIONAL
// ============================================================
async function buscarSedesNoReconocidas() {
  const el = document.getElementById('sedes-no-reconocidas-result');
  el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0"><i class="ti ti-loader"></i> Consultando sedes...</div>';

  // Traer todas las sedes distintas de ingresos, paginando para no perder ninguna
  const sedesSet = new Set();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const {data, error} = await sb.from('ingresos').select('sede').range(from, from + PAGE - 1);
    if (error) { el.innerHTML = `<div style="color:var(--red);font-size:12px">Error: ${error.message}</div>`; return; }
    if (!data || data.length === 0) break;
    data.forEach(r => { if (r.sede) sedesSet.add(r.sede); });
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const sedesConocidas = new Set(Object.keys(SEDE_REGIONAL));
  const noReconocidas = [...sedesSet].filter(s => getRegional(s) === '—').sort();

  if (!noReconocidas.length) {
    el.innerHTML = `<div style="padding:10px 12px;background:var(--green-bg);border:0.5px solid var(--green-border);border-radius:var(--radius);color:var(--green);font-size:12px">
      <i class="ti ti-circle-check"></i> Todas las sedes (${sedesSet.size}) están reconocidas en el catálogo regional.
    </div>`;
    return;
  }

  window._sedesNoReconocidas = noReconocidas;
  el.innerHTML = `
    <div style="padding:10px 12px;background:var(--yellow-bg);border:0.5px solid var(--yellow-border);border-radius:var(--radius);margin-bottom:10px;color:var(--yellow);font-size:12px">
      <i class="ti ti-alert-triangle"></i> ${noReconocidas.length} sede${noReconocidas.length!==1?'s':''} sin clasificar de ${sedesSet.size} totales.
    </div>
    <table>
      <thead><tr><th>Sede sin clasificar</th></tr></thead>
      <tbody>${noReconocidas.map(s => `<tr><td class="mono" style="font-size:11px">${s}</td></tr>`).join('')}</tbody>
    </table>
    <button class="btn" style="margin-top:10px;font-size:11px" onclick="copiarSedesNoReconocidas()"><i class="ti ti-copy"></i> Copiar lista</button>
  `;
}

function copiarSedesNoReconocidas() {
  const lista = window._sedesNoReconocidas || [];
  navigator.clipboard.writeText(lista.join('\n')).then(() => toast(`${lista.length} sedes copiadas`, 'ok'));
}

// ============================================================
// INICIO
// ============================================================
loadUsers();
setTimeout(verificarEntregaTurno, 800);
