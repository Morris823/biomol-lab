// ============================================================
// ORDENAMIENTO GENÉRICO DE TABLAS
// ============================================================
const sortState = {}; // { tablaId: { col, asc } }
let muestrasOrdenCol = null;
let muestrasOrdenAsc = true;

function sortTable(tablaId, colIdx) {
  // Para m-tabla, ordenar el array completo y repaginar
  if (tablaId === 'm-tabla') {
    const prev = sortState[tablaId] || {};
    const asc = (prev.col === colIdx) ? !prev.asc : true;
    sortState[tablaId] = { col: colIdx, asc };
    muestrasOrdenCol = colIdx;
    muestrasOrdenAsc = asc;
    muestrasPage = 0;
    applyFilters();
    return;
  }

  const tbody = document.getElementById(tablaId);
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length <= 1) return;
  const prev = sortState[tablaId] || {};
  const asc = (prev.col === colIdx) ? !prev.asc : true;
  sortState[tablaId] = { col: colIdx, asc };
  rows.sort((a, b) => {
    const aVal = (a.cells[colIdx]?.textContent || '').trim();
    const bVal = (b.cells[colIdx]?.textContent || '').trim();
    const aNum = parseFloat(aVal.replace(/[^0-9.\-]/g,''));
    const bNum = parseFloat(bVal.replace(/[^0-9.\-]/g,''));
    let cmp;
    if (!isNaN(aNum) && !isNaN(bNum)) { cmp = aNum - bNum; }
    else { cmp = aVal.localeCompare(bVal, 'es', { sensitivity: 'base' }); }
    return asc ? cmp : -cmp;
  });
  rows.forEach(r => tbody.appendChild(r));
}

// ============================================================
// PAGINACIÓN REUTILIZABLE
// ============================================================
function renderPaginacion(containerId, paginaActual, totalPaginas, totalItems, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalPaginas <= 1) { el.innerHTML = ''; return; }

  const desde = paginaActual * PAGE_SIZE + 1;
  const hasta = Math.min((paginaActual + 1) * PAGE_SIZE, totalItems);

  const btnStyle = 'padding:3px 9px;font-size:11px;border-radius:4px;border:0.5px solid var(--border2);background:var(--bg2);cursor:pointer;color:var(--text2)';
  const btnActiveStyle = 'padding:3px 9px;font-size:11px;border-radius:4px;border:0.5px solid var(--accent);background:var(--accent-bg);cursor:pointer;color:var(--accent);font-weight:600';

  // Páginas visibles: primera, última y las cercanas a la actual
  const paginas = new Set([0, totalPaginas-1]);
  for (let i = Math.max(0, paginaActual-2); i <= Math.min(totalPaginas-1, paginaActual+2); i++) paginas.add(i);
  const paginasArr = [...paginas].sort((a,b)=>a-b);

  let btns = '';
  let prev = -1;
  paginasArr.forEach(p => {
    if (prev !== -1 && p > prev + 1) btns += `<span style="font-size:11px;color:var(--text3);padding:0 4px">…</span>`;
    btns += `<button style="${p===paginaActual?btnActiveStyle:btnStyle}" onclick="(${onPageChange.toString()})(${p})">${p+1}</button>`;
    prev = p;
  });

  el.innerHTML = `
    <button style="${btnStyle}" ${paginaActual===0?'disabled':''} onclick="(${onPageChange.toString()})(${paginaActual-1})">
      <i class="ti ti-chevron-left"></i>
    </button>
    ${btns}
    <button style="${btnStyle}" ${paginaActual>=totalPaginas-1?'disabled':''} onclick="(${onPageChange.toString()})(${paginaActual+1})">
      <i class="ti ti-chevron-right"></i>
    </button>
    <span style="font-size:11px;color:var(--text3);margin-left:4px">${desde}–${hasta} de ${totalItems}</span>`;
}

