// ============================================================
// DESCARTE
// ============================================================
const PRUEBAS_DESCARTE = new Set(['VPH','VIH','HIV','VHB','VHC','CMV']);
function esPruebaDescarte(m) { return PRUEBAS_DESCARTE.has(nombreCorto(m.estudio_nombre, m.estudio_codigo)); }

let registrosDescarte = [];
let notasDescarte = [];

async function initDescarte() {
  document.getElementById('descarte-fecha-reg').value = hoyCO();
  renderDescarteCards();
  renderDescartePorPrueba();
  await cargarRegistrosDescarte();
  renderNotasDescarte();
}

function semaforo(dias) {
  if (dias <= 7)  return { color:'var(--green)',  bg:'var(--green-bg)',  border:'var(--green-border)',  icono:'ti-circle-check', texto:'Reciente' };
  if (dias <= 15) return { color:'var(--yellow)', bg:'var(--yellow-bg)', border:'var(--yellow-border)', icono:'ti-alert-triangle', texto:'Atención' };
  return           { color:'var(--red)',    bg:'var(--red-bg)',    border:'var(--red-border)',    icono:'ti-alert-circle', texto:'Urgente' };
}

function renderDescarteCards() {
  const hoy = new Date();
  const pendientesSinGest = allMuestras.filter(m => m.estado === 'pendiente' && !m.gestionada && esPruebaDescarte(m) && m.fecha_ingreso);
  const pendCard = document.getElementById('descarte-pendiente-card');
  if (pendientesSinGest.length) {
    pendientesSinGest.sort((a,b) => new Date(a.fecha_ingreso) - new Date(b.fecha_ingreso));
    const masViejo = pendientesSinGest[0];
    const dias = Math.floor((hoy - new Date(masViejo.fecha_ingreso)) / 86400000);
    const s = semaforo(dias);
    pendCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${s.bg};border:0.5px solid ${s.border};border-radius:var(--radius);margin-bottom:10px">
        <i class="ti ${s.icono}" style="font-size:22px;color:${s.color}"></i>
        <div><div style="font-size:22px;font-weight:600;color:${s.color}">${dias} días</div>
        <div style="font-size:11px;color:${s.color};opacity:.8">${s.texto} — desde ${fmt(masViejo.fecha_ingreso)}</div></div>
      </div>
      <div style="font-size:12px;font-weight:500">${masViejo.paciente||'—'}</div>
      <div style="font-size:11px;color:var(--text3)">${masViejo.nro_muestra} · ${nombreCorto(masViejo.estudio_nombre,masViejo.estudio_codigo)} · ${masViejo.sede||''}</div>
      <div style="margin-top:8px;font-size:11px;color:var(--text3)">${pendientesSinGest.length} pendientes sin gestionar en total</div>`;
  } else {
    pendCard.innerHTML = `<div style="color:var(--green);display:flex;align-items:center;gap:8px"><i class="ti ti-circle-check" style="font-size:20px"></i><span>Sin pendientes sin gestionar 🎉</span></div>`;
  }

  const sinVal = allMuestras.filter(m => m.estado === 'sin-validar' && m.fecha_recepcion && esPruebaDescarte(m));
  const sinValCard = document.getElementById('descarte-sinval-card');
  if (sinVal.length) {
    sinVal.sort((a,b) => new Date(a.fecha_recepcion) - new Date(b.fecha_recepcion));
    const masVieja = sinVal[0];
    const dias = Math.floor((hoy - new Date(masVieja.fecha_recepcion)) / 86400000);
    const s = semaforo(dias);
    sinValCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${s.bg};border:0.5px solid ${s.border};border-radius:var(--radius);margin-bottom:10px">
        <i class="ti ${s.icono}" style="font-size:22px;color:${s.color}"></i>
        <div><div style="font-size:22px;font-weight:600;color:${s.color}">${dias} días</div>
        <div style="font-size:11px;color:${s.color};opacity:.8">${s.texto} — recibida el ${fmt(masVieja.fecha_recepcion)}</div></div>
      </div>
      <div style="padding:8px 12px;background:var(--red-bg);border:0.5px solid var(--red-border);border-radius:var(--radius);margin-bottom:10px;font-size:11px;color:var(--red);font-weight:500">
        <i class="ti ti-lock"></i> NO descartes muestras recibidas desde ${fmt(masVieja.fecha_recepcion)} o después
      </div>
      <div style="font-size:12px;font-weight:500">${masVieja.paciente||'—'}</div>
      <div style="font-size:11px;color:var(--text3)">${masVieja.nro_muestra} · ${nombreCorto(masVieja.estudio_nombre,masVieja.estudio_codigo)} · ${masVieja.sede||''}</div>
      <div style="margin-top:8px;font-size:11px;color:var(--text3)">${sinVal.length} muestras sin validar en total</div>`;
  } else {
    sinValCard.innerHTML = `<div style="color:var(--green);display:flex;align-items:center;gap:8px"><i class="ti ti-circle-check" style="font-size:20px"></i><span>Todas las muestras validadas 🎉</span></div>`;
  }
}

function renderDescartePorPrueba() {
  const el = document.getElementById('descarte-por-prueba');
  const hoy = new Date();
  const sinVal = allMuestras.filter(m => m.estado === 'sin-validar' && m.fecha_recepcion && esPruebaDescarte(m));
  const porPrueba = {};
  sinVal.forEach(m => {
    const k = nombreCorto(m.estudio_nombre, m.estudio_codigo);
    if (!porPrueba[k]) porPrueba[k] = [];
    porPrueba[k].push(m);
  });
  if (!Object.keys(porPrueba).length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--green);font-size:12px"><i class="ti ti-circle-check"></i> Sin muestras sin validar</div>';
    return;
  }
  const rows = Object.entries(porPrueba).map(([prueba, muestras]) => {
    muestras.sort((a,b) => new Date(a.fecha_recepcion) - new Date(b.fecha_recepcion));
    const masVieja = muestras[0];
    const dias = Math.floor((hoy - new Date(masVieja.fecha_recepcion)) / 86400000);
    return { prueba, muestras, masVieja, dias };
  }).sort((a,b) => b.dias - a.dias);
  el.innerHTML = `<table><thead><tr><th>Prueba</th><th style="text-align:center">Cant.</th><th>Más antigua</th><th style="text-align:center">Días</th><th>Estado</th><th>Paciente más antigua</th></tr></thead><tbody>
    ${rows.map(r => {
      const s = semaforo(r.dias);
      return `<tr><td style="font-weight:500">${r.prueba}</td><td style="text-align:center"><strong>${r.muestras.length}</strong></td>
        <td class="mono">${fmt(r.masVieja.fecha_recepcion)}</td>
        <td style="text-align:center"><span style="padding:2px 8px;border-radius:8px;background:${s.bg};color:${s.color};border:0.5px solid ${s.border};font-size:11px;font-weight:600">${r.dias}d</span></td>
        <td><span style="font-size:10px;color:${s.color};font-weight:500"><i class="ti ${s.icono}"></i> ${s.texto}</span></td>
        <td style="font-size:11px;color:var(--text2)">${r.masVieja.paciente||'—'} · ${r.masVieja.sede||''}</td></tr>`;
    }).join('')}
  </tbody></table>`;
}

async function guardarRegistroDescarte() {
  const fecha = document.getElementById('descarte-fecha-reg').value;
  const hasta = document.getElementById('descarte-hasta').value;
  const obs   = document.getElementById('descarte-obs-reg').value.trim();
  if (!fecha) { toast('Ingresa la fecha de descarte', 'err'); return; }
  if (!hasta) { toast('Ingresa hasta qué fecha se descartó', 'err'); return; }

  const {error} = await sb.from('registros_descarte').insert({
    fecha_descarte: fecha,
    descarto_hasta: hasta,
    observaciones: obs || null,
    registrado_por: currentUser
  });
  if (error) { toast('Error guardando: ' + error.message, 'err'); return; }

  document.getElementById('descarte-fecha-reg').value = hoyCO();
  document.getElementById('descarte-hasta').value = '';
  document.getElementById('descarte-obs-reg').value = '';
  toast('Descarte registrado', 'ok');
  await cargarRegistrosDescarte();
}

async function cargarRegistrosDescarte() {
  const {data} = await sb.from('registros_descarte')
    .select('*').order('fecha_descarte', {ascending:false}).limit(50);
  registrosDescarte = data || [];
  renderRegistrosDescarte();
}

async function eliminarRegistroDescarte(id) {
  if (!confirm('¿Eliminar este registro de descarte?')) return;
  await sb.from('registros_descarte').delete().eq('id', id);
  await cargarRegistrosDescarte();
  toast('Registro eliminado', 'ok');
}

function renderRegistrosDescarte() {
  const el = document.getElementById('descarte-registros-lista');
  if (!registrosDescarte.length) { el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px">Sin registros de descarte aún</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>Fecha descarte</th><th>Descartó hasta</th><th>Por</th><th>Observaciones</th><th></th></tr></thead><tbody>
    ${registrosDescarte.map(r => `<tr>
      <td class="mono">${fmt(r.fecha_descarte)}</td><td class="mono">${fmt(r.descarto_hasta)}</td>
      <td style="font-size:11px">${r.registrado_por||'—'}</td>
      <td style="font-size:11px;color:var(--text2)">${r.observaciones||'—'}</td>
      <td><button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
        onclick="eliminarRegistroDescarte('${r.id}')"><i class="ti ti-x"></i></button></td>
    </tr>`).join('')}
  </tbody></table>`;
}

async function guardarNotaDescarte() {
  const cod = document.getElementById('descarte-nota-cod').value.trim();
  const texto = document.getElementById('descarte-nota-texto').value.trim();
  if (!cod || !texto) { toast('Completa el código y la nota', 'err'); return; }
  const m = allMuestras.find(x => x.nro_muestra === cod);
  notasDescarte.unshift({ cod, texto, paciente: m?.paciente||'—', prueba: m ? nombreCorto(m.estudio_nombre,m.estudio_codigo):'—', fecha: new Date().toISOString(), por: currentUser });
  if (m) await sb.from('gestiones').upsert({ od_id: m.od_id, nro_muestra: cod, descripcion: '[LabCore] '+texto, gestionado_por: currentUser, gestionada: false }, { onConflict: 'od_id' });
  document.getElementById('descarte-nota-cod').value = '';
  document.getElementById('descarte-nota-texto').value = '';
  toast('Nota guardada', 'ok');
  renderNotasDescarte();
}

function renderNotasDescarte() {
  const el = document.getElementById('descarte-notas-lista');
  if (!notasDescarte.length) { el.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:12px">Sin notas registradas aún</div>'; return; }
  el.innerHTML = `<table><thead><tr><th>Fecha</th><th>Código</th><th>Paciente</th><th>Prueba</th><th>Nota</th><th>Por</th><th></th></tr></thead><tbody>
    ${notasDescarte.map((n,i) => `<tr>
      <td class="mono">${fmt(n.fecha)}</td><td class="mono">${n.cod}</td>
      <td style="font-size:11px">${n.paciente}</td><td style="font-size:11px">${n.prueba}</td>
      <td style="font-size:11px;color:var(--text2)">${n.texto}</td>
      <td style="font-size:11px;color:var(--text3)">${n.por}</td>
      <td><button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
        onclick="notasDescarte.splice(${i},1);renderNotasDescarte()"><i class="ti ti-x"></i></button></td>
    </tr>`).join('')}
  </tbody></table>`;
}

