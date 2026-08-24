// ============================================================
// DASHBOARD
// ============================================================
function navToMuestrasFiltered(estado) {
  // Limpiar filtros primero
  activeEstado = estado;
  activePrueba = 'todas';
  document.getElementById('q-search').value = '';
  document.getElementById('f-desde').value = '';
  document.getElementById('f-hasta').value = '';
  document.getElementById('f-ingreso').value = '';
  // Navegar
  const navEl = document.querySelector('[onclick*="muestras"]');
  nav('muestras', navEl);
  // Activar chip correcto
  document.querySelectorAll('#chips-estado .chip').forEach(c => {
    c.classList.toggle('active', c.getAttribute('onclick') && c.getAttribute('onclick').includes("'"+estado+"'"));
  });
  applyFilters();
}

// Configuración de pruebas — scope global para uso en reprocesos y dashboard
const CONFIG_PRUEBA = {
  'CMV':      { limite: 2,  montajeDow: [2,5],         nombre: 'CMV' },
  'VHB':      { limite: 3,  montajeDow: [3],            nombre: 'VHB' },
  'VHC':      { limite: 3,  montajeDow: [4],            nombre: 'VHC' },
  'VIH':      { limite: 3,  montajeDow: [1,2,3,4,5],   nombre: 'VIH' },
  'HIV':      { limite: 3,  montajeDow: [1,2,3,4,5],   nombre: 'VIH' },
  'VPH':      { limite: 3,  montajeDow: [1,2,3,4,5,6], nombre: 'VPH' },
  'HLA B27':  { limite: 2,  montajeDow: [2,5],         nombre: 'HLA B27' },
  'HLA B57':  { limite: 2,  montajeDow: [2,5],         nombre: 'HLA B57' },
  'Hemocr.':  { limite: 2,  montajeDow: [3],            nombre: 'Hemocr.' },
  'Homocist.':{ limite: 10, montajeDow: [5],            nombre: 'Homocist.' },
  'MTHFR':    { limite: 10, montajeDow: [5],            nombre: 'MTHFR' },
  'TB':       { limite: 1,  montajeDow: [1,3,5],       nombre: 'TB' },
  'Geno HIV': { limite: 30, montajeDow: [1,2,3,4,5],   nombre: 'Geno HIV' },
  'Geno C':   { limite: 8,  montajeDow: [5],            nombre: 'Geno C' },
  'Integrasa':{ limite: 26, montajeDow: [1,2,3,4,5],   nombre: 'Integrasa' },
};

async function initDashboard() {
  // NO cargar validadas automáticamente — solo bajo demanda con el botón "Actualizar estadísticas"
  renderDashboard();
  const banner = document.getElementById('dash-banner-validadas');
  if (banner) banner.style.display = validadasCargadas ? 'none' : 'flex';
}

async function actualizarEstadisticasCompletas() {
  const btn = document.querySelector('#dash-banner-validadas button');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Cargando...'; }
  await loadMuestras({ force: true, incluirValidadas: true });
  renderDashboard();
  const banner = document.getElementById('dash-banner-validadas');
  if (banner) banner.style.display = 'none';
  toast('Estadísticas completas actualizadas', 'ok');
}

function renderDashboard() {
  const c = {};
  allMuestras.forEach(m => { c[m.estado] = (c[m.estado]||0)+1; });
  const total = allMuestras.length;
  const recibidas = (c.recibido||0) + (c['sin-validar']||0) + (c.validado||0) + (c.reproceso||0) + (c['nueva-muestra']||0);
  const sinValidar = c['sin-validar']||0;
  const validadas = c.validado||0;
  const pendientes = c.pendiente||0;
  const gestionadas = allMuestras.filter(m => m.estado === 'pendiente' && m.gestion).length;
  const reprocesos = c.reproceso||0;

  // Embudo interactivo
  const funnelItems = [
    { label:'Total ingresos', val:total, color:'var(--text)', bg:'var(--bg2)', border:'var(--border2)', estado:'todos', icon:'ti-file-import' },
    { label:'Recibidas', val:recibidas, color:'var(--accent)', bg:'var(--accent-bg)', border:'#A8CFEF', estado:'recibido', icon:'ti-package' },
    { label:'Validadas', val:validadas, color:'var(--green)', bg:'var(--green-bg)', border:'var(--green-border)', estado:'validado', icon:'ti-circle-check' },
    { label:'Sin validar', val:sinValidar, color:'var(--purple)', bg:'var(--purple-bg)', border:'#BDB9F5', estado:'sin-validar', icon:'ti-hourglass' },
    { label:'Pendientes', val:pendientes, color:'var(--yellow)', bg:'var(--yellow-bg)', border:'var(--yellow-border)', estado:'pendiente', icon:'ti-clock' },
    { label:'Gestionadas', val:gestionadas, color:'var(--teal)', bg:'var(--teal-bg)', border:'#5EC4A1', estado:'todos', icon:'ti-message-check', noFilter:true },
  ];
  const funnelEl = document.getElementById('dash-funnel');
  funnelEl.innerHTML = '';
  funnelItems.forEach(f => {
    const div = document.createElement('div');
    div.style.cssText = 'flex:1;min-width:110px;border-radius:var(--radius-lg);padding:14px 16px;background:' + f.bg + ';border:0.5px solid ' + f.border + ';transition:box-shadow .12s,opacity .12s;' + (f.noFilter ? 'cursor:default' : 'cursor:pointer;opacity:.95');
    if (!f.noFilter) {
      div.addEventListener('mouseenter', () => { div.style.opacity = '1'; div.style.boxShadow = '0 2px 12px rgba(0,0,0,.1)'; });
      div.addEventListener('mouseleave', () => { div.style.opacity = '.95'; div.style.boxShadow = 'none'; });
      div.addEventListener('click', () => navToMuestrasFiltered(f.estado));
    }
    const pct = total > 0 && !f.noFilter ? '<div style="font-size:10px;margin-top:4px;color:' + f.color + ';opacity:.7">' + Math.round(f.val/total*100) + '% del total</div>' : '';
    const arrow = !f.noFilter ? '<i class="ti ti-arrow-right" style="margin-left:auto;font-size:11px;color:' + f.color + '"></i>' : '';
    div.innerHTML = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
      + '<i class="ti ' + f.icon + '" style="color:' + f.color + ';font-size:14px"></i>'
      + '<span style="font-size:10px;color:' + f.color + ';font-weight:500;text-transform:uppercase;letter-spacing:.04em">' + f.label + '</span>'
      + arrow + '</div>'
      + '<div style="font-size:26px;font-weight:600;color:' + f.color + ';line-height:1">' + f.val.toLocaleString('es-CO') + '</div>'
      + pct;
    funnelEl.appendChild(div);
  });

  // Por estado sidebar
  document.getElementById('dash-estados').innerHTML = Object.entries(c)
    .sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid var(--border);font-size:12px"><span>${pill(k)}</span><strong>${v}</strong></div>`).join('');

  // Tabla recientes
  document.getElementById('dash-tabla').innerHTML = allMuestras.slice(0,8).map(m=>`
    <tr onclick="openD('${m.od_id}')">
      <td class="mono">${m.nro_muestra}</td><td style="font-size:11px">${m.paciente||''}</td>
      <td style="font-size:11px">${nombreCorto(m.estudio_nombre, m.estudio_codigo)}</td><td style="font-size:11px;color:var(--text2)">${m.tipo_muestra||''}</td>
      <td>${pill(m.estado)}</td>
    </tr>`).join('');

  // Gráficas
  renderDashCharts();
}

function renderDashCharts() {
  // 1. Muestras por prueba (mes actual) — usar fecha_RECEPCIÓN, deduplicar por nro_muestra+prueba
  // El problema: un tubo con 2 pruebas = 2 filas en v_muestras. Necesitamos contar TUBOS únicos por prueba.
  const hoy = new Date();
  const mesStart = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0,10);
  const mesMuestras = allMuestras.filter(m => m.fecha_recepcion && m.fecha_recepcion.slice(0,10) >= mesStart);

  // Contar tubos únicos por prueba: un nro_muestra+prueba solo cuenta una vez
  const porPrueba = {};
  const vistoPrueba = new Set(); // "nro_muestra|prueba"
  mesMuestras.forEach(m => {
    const k = nombreCorto(m.estudio_nombre, m.estudio_codigo);
    const clave = m.nro_muestra + '|' + k;
    if (!vistoPrueba.has(clave)) {
      vistoPrueba.add(clave);
      porPrueba[k] = (porPrueba[k]||0)+1;
    }
  });
  const ppEntries = Object.entries(porPrueba).sort((a,b)=>b[1]-a[1]);
  const maxPP = ppEntries.length ? ppEntries[0][1] : 1;
  const chartPruebaEl = document.getElementById('dash-chart-prueba');
  if (chartPruebaEl) {
    if (!ppEntries.length) {
      chartPruebaEl.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px">Sin recepciones en el mes actual</div>';
    } else {
      chartPruebaEl.innerHTML = ppEntries.map(([k,v]) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <div style="width:72px;font-size:11px;color:var(--text2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${k}</div>
          <div style="flex:1;height:18px;background:var(--bg2);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${Math.max(4,Math.round(v/maxPP*100))}%;background:var(--accent);border-radius:4px;transition:width .4s"></div>
          </div>
          <div style="width:28px;font-size:11px;font-weight:600;color:var(--text)">${v}</div>
        </div>`).join('');
    }
  }

  // 2. Volumen por día — últimas 5 semanas completas (lun-dom), con etiquetas de día
  const chartDiasEl = document.getElementById('dash-chart-dias');
  if (chartDiasEl) {
    // Construir 35 días hacia atrás desde hoy (5 semanas)
    const DAYS = 35;
    const diasMap = {};
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      diasMap[d.toISOString().slice(0,10)] = 0;
    }
    const diasVistos = new Set();
    allMuestras.forEach(m => {
      const fd = m.fecha_recepcion ? m.fecha_recepcion.slice(0,10) : null;
      if (fd && diasMap.hasOwnProperty(fd)) {
        // Contar tubos únicos por día, no filas (un tubo con 2 pruebas = 2 filas en v_muestras)
        const clave = fd + '|' + m.nro_muestra;
        if (!diasVistos.has(clave)) {
          diasVistos.add(clave);
          diasMap[fd]++;
        }
      }
    });
    const diasEntries = Object.entries(diasMap);
    const maxD = Math.max(...diasEntries.map(([,v])=>v), 1);

    const DOW_ES = ['D','L','M','X','J','V','S']; // 0=Dom
    const bw = 9, gap = 2, h = 60;
    const totalW = diasEntries.length * (bw + gap);

    // Agrupar por semana para etiquetas — marcar cada lunes
    const bars = diasEntries.map(([fecha, v], i) => {
      const dateObj = new Date(fecha + 'T12:00:00');
      const dow = dateObj.getDay(); // 0=dom
      const bh = Math.max(2, Math.round(v / maxD * h));
      const x = i * (bw + gap);
      const y = h - bh;
      const isWeekend = dow === 0 || dow === 6;
      const isHoy = fecha === hoy.toISOString().slice(0,10);
      const color = isHoy ? 'var(--green)' : isWeekend ? '#D4D2CC' : 'var(--accent)';
      const dd = dateObj.getDate();
      const mm = dateObj.getMonth() + 1;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="2" fill="${color}" opacity="${isHoy?'1':'.8'}">
        <title>${fecha} (${DOW_ES[dow]}): ${v} muestras</title></rect>`;
    }).join('');

    // Etiquetas: mostrar el día de semana encima de cada barra + fecha en lunes
    const dowLabels = diasEntries.map(([fecha], i) => {
      const dateObj = new Date(fecha + 'T12:00:00');
      const dow = dateObj.getDay();
      const x = i * (bw + gap) + bw / 2;
      const label = DOW_ES[dow];
      const isWeekend = dow === 0 || dow === 6;
      const isHoy = fecha === hoy.toISOString().slice(0,10);
      const color = isHoy ? 'var(--green)' : isWeekend ? '#C8C6C0' : '#9B9A96';
      // Mostrar número del día solo en lunes o en hoy
      const showDate = dow === 1 || isHoy;
      const dd = dateObj.getDate();
      const mm = dateObj.getMonth() + 1;
      return `<text x="${x}" y="${h + 10}" text-anchor="middle" font-size="7" fill="${color}" font-weight="${isHoy?'700':'400'}">${label}</text>`
        + (showDate ? `<text x="${x}" y="${h + 19}" text-anchor="middle" font-size="7" fill="${color}">${dd}/${mm}</text>` : '');
    }).join('');

    chartDiasEl.innerHTML = `
      <svg width="100%" viewBox="0 -4 ${totalW} ${h + 26}" style="overflow:visible">${bars}${dowLabels}</svg>
      <div style="display:flex;gap:14px;margin-top:6px;font-size:10px;color:var(--text3)">
        <span>Máx día: <strong>${maxD}</strong></span>
        <span>Total período: <strong>${Object.values(diasMap).reduce((a,b)=>a+b,0)}</strong></span>
        <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;background:var(--green);border-radius:2px;display:inline-block"></span> Hoy</span>
        <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;background:#D4D2CC;border-radius:2px;display:inline-block"></span> Finde</span>
      </div>`;
  }

  // ============================================================
  // 3. OPORTUNIDAD EN VALIDACIÓN — días hábiles Colombia
  // ============================================================

  // Festivos Colombia 2025 y 2026 (verificados oficialmente)
  const FESTIVOS_CO = new Set([
    // 2025
    '2025-01-01','2025-01-06','2025-03-24','2025-04-17','2025-04-18',
    '2025-05-01','2025-06-02','2025-06-23','2025-06-30','2025-07-20',
    '2025-08-07','2025-08-18','2025-10-13','2025-11-03','2025-11-17',
    '2025-12-08','2025-12-25',
    // 2026
    '2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03',
    '2026-05-01','2026-05-18','2026-06-08','2026-06-15','2026-06-29',
    '2026-07-20','2026-08-07','2026-08-17','2026-10-12','2026-11-02',
    '2026-11-16','2026-12-08','2026-12-25'
  ]);

  // Verifica si una fecha es día hábil (lun-vie, no festivo)
  function esHabil(fecha) {
    const d = new Date(fecha + 'T12:00:00');
    const dow = d.getDay(); // 0=dom, 6=sab
    if (dow === 0 || dow === 6) return false;
    if (FESTIVOS_CO.has(fecha)) return false;
    return true;
  }

  // Cuenta días hábiles entre dos fechas (excluyendo la fecha inicial)
  function diasHabiles(fechaInicio, fechaFin) {
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    if (end <= start) return 0;
    let count = 0;
    const cur = new Date(start);
    cur.setDate(cur.getDate() + 1); // empezar al día siguiente
    while (cur <= end) {
      const iso = cur.toISOString().slice(0,10);
      if (esHabil(iso)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  // CONFIG_PRUEBA está en scope global — disponible aquí directamente

  // Dado un día de recepción, calcular cuándo se monta por primera vez
  // El día de montaje puede ser sábado (ej. VPH) aunque no sea día hábil para el conteo
  function proximoMontaje(fechaRec, montajeDow) {
    const d = new Date(fechaRec + 'T12:00:00');
    for (let i = 0; i <= 7; i++) {
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      const iso = cur.toISOString().slice(0,10);
      const dow = cur.getDay();
      // El día debe estar en los días de montaje de la prueba
      // y no ser domingo (0) ni festivo — sábado sí puede ser día de montaje
      if (montajeDow.includes(dow) && dow !== 0 && !FESTIVOS_CO.has(iso)) return iso;
    }
    return fechaRec; // fallback
  }

  // Calcular datos de oportunidad por prueba
  const oporData = {};

  allMuestras.forEach(m => {
    if (!m.fecha_recepcion || !m.fecha_validacion) return;
    const rec = new Date(m.fecha_recepcion);
    const val = new Date(m.fecha_validacion);
    if (isNaN(rec) || isNaN(val) || val <= rec) return;

    const hrsRec = (val - rec) / 3600000;
    if (hrsRec < 0 || hrsRec > 2160) return;

    const k = nombreCorto(m.estudio_nombre, m.estudio_codigo);
    const cfg = CONFIG_PRUEBA[k] || null;
    if (!oporData[k]) oporData[k] = { hrsRec: [], dhRec: [], dhMontaje: [], hrsMontaje: [], dentroLimite: 0, dentroLimiteRec: 0, n: 0, cfg };

    const fechaRecISO = rec.toISOString().slice(0,10);
    const fechaValISO = val.toISOString().slice(0,10);

    oporData[k].hrsRec.push(hrsRec);
    oporData[k].n++;

    // Días hábiles desde recepción
    if (cfg) {
      const dhRec = diasHabiles(fechaRecISO, fechaValISO);
      oporData[k].dhRec.push(dhRec);
      if (dhRec <= cfg.limite) oporData[k].dentroLimiteRec++;
    }

    if (cfg) {
      const fechaMontaje = proximoMontaje(fechaRecISO, cfg.montajeDow);
      const dhMon = diasHabiles(fechaMontaje, fechaValISO);
      if (dhMon >= 0) {
        oporData[k].dhMontaje.push(dhMon);
        const montajeDate = new Date(fechaMontaje + 'T06:30:00');
        const hrsMon = (val - montajeDate) / 3600000;
        if (hrsMon >= 0) oporData[k].hrsMontaje.push(hrsMon);
        if (dhMon <= cfg.limite) oporData[k].dentroLimite++;
      }
    }
  });

  const chartOpEl = document.getElementById('dash-chart-oportunidad');
  if (!chartOpEl) return;

  const entries = Object.entries(oporData).filter(([,v]) => v.n >= 1);
  if (!entries.length) {
    chartOpEl.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px">Aún no hay muestras con fecha de recepción Y validación registradas</div>';
    return;
  }

  // Ordenar por promedio de días hábiles desde recepción desc
  entries.sort((a,b) => {
    const avgA = a[1].hrsRec.reduce((x,y)=>x+y,0)/a[1].hrsRec.length;
    const avgB = b[1].hrsRec.reduce((x,y)=>x+y,0)/b[1].hrsRec.length;
    return avgB - avgA;
  });

  // Escala: máximo días hábiles desde recepción
  const maxDH = Math.max(...entries.map(([,v]) => {
    return v.hrsRec.reduce((a,b)=>a+b,0)/v.hrsRec.length / 8; // aprox 8h laborables/día
  }), 1);

  chartOpEl.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">'
    + entries.map(([k, v]) => {
        const cfg = v.cfg || CONFIG_PRUEBA[k];
        const avgHrsRec = Math.round(v.hrsRec.reduce((a,b)=>a+b,0)/v.hrsRec.length * 10) / 10;
        // Días hábiles desde recepción (aproximado: horas / 24 pero solo días hábiles)
        const avgDHRec = v.hrsRec.length
          ? Math.round(v.hrsRec.reduce((a,b)=>a+b,0)/v.hrsRec.length / 24 * 10) / 10
          : 0;

        // Días hábiles desde montaje
        const hasMontaje = v.dhMontaje.length > 0;
        const avgDHMon = hasMontaje
          ? Math.round(v.dhMontaje.reduce((a,b)=>a+b,0)/v.dhMontaje.length * 10) / 10
          : null;
        const avgHrsMon = v.hrsMontaje.length
          ? Math.round(v.hrsMontaje.reduce((a,b)=>a+b,0)/v.hrsMontaje.length * 10) / 10
          : null;

        const limite = cfg?.limite || null;

        // Colores según si supera el límite
        const colorRec = !limite ? 'var(--accent)'
          : avgDHRec <= limite ? 'var(--green)'
          : avgDHRec <= limite * 1.5 ? 'var(--yellow)'
          : 'var(--red)';

        const colorMon = avgDHMon === null ? null
          : !limite ? 'var(--teal)'
          : avgDHMon <= limite ? 'var(--green)'
          : avgDHMon <= limite * 1.5 ? 'var(--yellow)'
          : 'var(--red)';

        // Barra proporcional al máximo del chart
        const barMaxDays = Math.max(avgDHRec, avgDHMon || 0, limite || 0, maxDH * 0.3);
        const pctRec = Math.max(4, Math.min(100, Math.round(avgDHRec / barMaxDays * 100)));
        const pctMon = avgDHMon !== null ? Math.max(4, Math.min(100, Math.round(avgDHMon / barMaxDays * 100))) : 0;
        const pctLim = limite ? Math.min(100, Math.round(limite / barMaxDays * 100)) : 0;

        return `<div style="background:var(--bg2);border-radius:var(--radius);padding:10px 12px;border:0.5px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:12px;font-weight:600">${k}</span>
            <span style="font-size:10px;color:var(--text3)">${v.n} muestra${v.n!==1?'s':''}</span>
          </div>

          <!-- Barra desde recepción -->
          <div style="margin-bottom:6px">
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
              <span style="font-size:10px;color:var(--text2)">Desde recepción</span>
              <span style="font-size:10px;font-weight:600;color:${colorRec}">${avgHrsRec}h · ~${avgDHRec}d háb.
                ${(() => {
                  if (!limite || !v.dhRec.length) return '';
                  const pct = Math.round(v.dentroLimiteRec / v.dhRec.length * 100);
                  const c = pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)';
                  return ` · <span style="color:${c};font-weight:700">${pct}%</span>`;
                })()}
              </span>
            </div>
            <div style="position:relative;height:10px;background:var(--bg3);border-radius:4px;overflow:hidden">
              <div style="position:absolute;left:0;top:0;height:100%;width:${pctRec}%;background:${colorRec};border-radius:4px;opacity:.85"></div>
              ${pctLim > 0 ? `<div style="position:absolute;left:${pctLim}%;top:0;width:2px;height:100%;background:var(--red);opacity:.7" title="Límite: ${limite}d"></div>` : ''}
            </div>
          </div>

          <!-- Barra desde montaje (si hay config) -->
          ${hasMontaje ? `
          <div style="margin-bottom:6px">
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
              <span style="font-size:10px;color:var(--text2)">Desde montaje</span>
              <span style="font-size:10px;font-weight:600;color:${colorMon}">${avgHrsMon}h · ~${avgDHMon}d háb.</span>
            </div>
            <div style="position:relative;height:10px;background:var(--bg3);border-radius:4px;overflow:hidden">
              <div style="position:absolute;left:0;top:0;height:100%;width:${pctMon}%;background:${colorMon};border-radius:4px;opacity:.6"></div>
              ${pctLim > 0 ? `<div style="position:absolute;left:${pctLim}%;top:0;width:2px;height:100%;background:var(--red);opacity:.7"></div>` : ''}
            </div>
          </div>` : ''}

          <!-- Límite y % dentro -->
          ${limite ? (() => {
            const total = v.dhMontaje.length;
            const dentro = v.dentroLimite;
            const pct = total > 0 ? Math.round(dentro / total * 100) : null;
            const pctColor = pct === null ? 'var(--text3)' : pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)';
            return `<div style="margin-top:6px;padding:5px 8px;background:var(--bg3);border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:10px;color:var(--text3)">Límite: <strong style="color:var(--red)">${limite}d háb.</strong></span>
              ${pct !== null ? `
                <span style="font-size:13px;font-weight:700;color:${pctColor}">${pct}%</span>
                <span style="font-size:10px;color:var(--text3)">${dentro}/${total} a tiempo</span>
              ` : '<span style="font-size:10px;color:var(--text3)">Sin datos de montaje</span>'}
            </div>`;
          })() : ''}
        </div>`;
      }).join('') + '</div>'
    + `<div style="display:flex;gap:16px;margin-top:10px;font-size:10px;color:var(--text3);padding:4px 0">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:6px;background:var(--accent);border-radius:2px;display:inline-block;opacity:.85"></span> Desde recepción</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:6px;background:var(--teal);border-radius:2px;display:inline-block;opacity:.6"></span> Desde montaje</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:2px;height:10px;background:var(--red);display:inline-block;opacity:.7"></span> Límite de la prueba</span>
        <span>🟢 Dentro · 🟡 Cerca · 🔴 Excedido</span>
      </div>`;
}

