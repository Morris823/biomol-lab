// ============================================================
// HISTORIAL DE SUBIDAS (Ingresos y Rescatar de hematología)
// ============================================================
// Cada vez que se sube un Excel queda una fila en `importaciones`, para que en la
// sección se vea cuándo fue la última subida, quién la hizo y qué archivos van hoy.
// ============================================================
async function registrarSubida(tipo, archivo, filas, nuevos, detalle) {
  const {error} = await sb.from('importaciones').insert({ tipo, archivo, filas, nuevos, detalle, importado_por: currentUser });
  if (error) console.error('No se pudo registrar la subida:', error);
  cargarUltimaSubida(tipo);
}

async function cargarUltimaSubida(tipo) {
  const el = document.getElementById('ultima-' + tipo);
  if (!el) return;
  const {data, error} = await sb.from('importaciones').select('created_at,archivo,filas,nuevos,importado_por')
    .eq('tipo', tipo).order('created_at', { ascending: false }).limit(20);
  let filas = error ? [] : (data || []);
  // Antes de existir este historial: para ingresos se toma el último ingreso subido
  if (!filas.length && tipo === 'ingresos') {
    const {data: ing} = await sb.from('ingresos').select('created_at,subido_por')
      .not('subido_por', 'ilike', '%manual%').order('created_at', { ascending: false }).limit(1);
    if (ing && ing.length) filas = [{ created_at: ing[0].created_at, importado_por: ing[0].subido_por }];
  }
  if (!filas.length) { el.innerHTML = '<i class="ti ti-history"></i> Todavía no hay subidas registradas'; return; }
  const u = filas[0];
  const hoy = hoyCO();
  const deHoy = filas.filter(f => new Date(f.created_at).toLocaleDateString('en-CA', { timeZone: TZ_CO }) === hoy);
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const horas = (Date.now() - new Date(u.created_at)) / 3600000;
  const hace = horas < 1 ? `hace ${Math.max(1, Math.round(horas * 60))} min` : horas < 24 ? `hace ${Math.round(horas)} h` : `hace ${Math.floor(horas / 24)} d`;
  el.innerHTML = `<i class="ti ti-history"></i> <b>Última subida:</b> ${fmt(u.created_at)} ${fmtHora(u.created_at)} <span style="color:var(--text3)">(${hace})</span>`
    + (u.importado_por ? ` · ${esc(u.importado_por)}` : '')
    + (u.archivo ? ` · <span class="mono" style="font-size:11px">${esc(u.archivo)}</span>` : '')
    + (u.nuevos != null ? ` · ${u.nuevos} nuevo${u.nuevos === 1 ? '' : 's'}` : '')
    + (deHoy.length > 1 ? `<div style="margin-top:4px;color:var(--text2)">Hoy van <b>${deHoy.length}</b> archivos: ${deHoy.slice().reverse().map(f => `${fmtHora(f.created_at)}${f.archivo ? ' ' + esc(f.archivo) : ''}${f.nuevos != null ? ' (' + f.nuevos + ')' : ''}`).join(' · ')}</div>` : '');
}
