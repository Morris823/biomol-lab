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

