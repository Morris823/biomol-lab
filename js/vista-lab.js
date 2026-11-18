// ============================================================
// VISTA DEL LABORATORIO — pantalla de entrada interactiva
// ============================================================
// Al entrar con el usuario aparece el plano del laboratorio (vista-lab.html, en un
// iframe aislado con su propio CSS y JS). La persona elige el área donde le toca
// hoy y el menú lateral muestra solo las secciones de esa área. "Cambiar de área"
// vuelve a abrir el plano y su personaje camina hasta la nueva zona.
// Las cifras de cada zona salen de allMuestras (ya en memoria) y de unas pocas
// consultas de solo conteo (head:true, no descargan filas); se recalculan como
// máximo cada minuto y solo mientras el plano está abierto.
// ============================================================
(function () {
  const miles = n => Number(n || 0).toLocaleString('es-CO');
  const fechaCorta = iso => iso ? new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota' }) : '—';
  const contar = async q => { try { const { count, error } = await q; return error ? 0 : (count || 0); } catch (e) { return 0; } };
  const uno = async q => { try { const { data } = await q; return (data && data[0]) || null; } catch (e) { return null; } };

  async function calcularZonas() {
    const M = allMuestras || [];
    const corto = m => nombreCorto(m.estudio_nombre, m.estudio_codigo);
    const tubos = arr => new Set(arr.map(m => m.nro_muestra)).size;
    const desde = hoyCO() + 'T00:00:00-05:00';
    const head = { count: 'exact', head: true };

    const [escHoy, sinIng, valHoy, ultMat, ultTB, ultDesc] = await Promise.all([
      contar(sb.from('recepciones').select('id', head).gte('fecha_recepcion', desde)),
      contar(sb.from('recepciones').select('id', head).eq('sin_ingreso', true)),
      contar(sb.from('validaciones').select('id', head).gte('fecha_validacion', desde)),
      uno(sb.from('matriculas').select('id,mat_id,created_at').order('created_at', { ascending: false }).limit(1)),
      uno(sb.from('corridas_tb').select('corr_id,created_at').order('created_at', { ascending: false }).limit(1)),
      uno(sb.from('registros_descarte').select('fecha_descarte').order('fecha_descarte', { ascending: false }).limit(1)),
    ]);
    // Cierre de turno de hoy (una fila)
    const cl = await uno(sb.from('checklist_turno').select('*').eq('fecha', hoyCO()).limit(1));
    const cierres = typeof cierresDe === 'function' ? cierresDe(cl) : {};
    const totalAreas = typeof AREAS_CIERRE !== 'undefined' ? AREAS_CIERRE.length : 5;
    const nCerradas = typeof AREAS_CIERRE !== 'undefined' ? AREAS_CIERRE.filter(a => cierres[a.id]?.fecha).length : 0;
    const txtCierre = area => { const x = cierres[area]; return x && x.fecha ? `Cerrada · ${(x.por || '').split(' ')[0]}${x.legado ? '' : ' ' + fmtHora(x.fecha)}` : 'Sin cerrar'; };
    const posUlt = ultMat ? await contar(sb.from('matricula_posiciones').select('id', head).eq('matricula_id', ultMat.id).eq('es_control', false)) : 0;

    // Recepción
    const pend = M.filter(m => m.estado === 'pendiente' && !m.gestionada);
    const rescate = typeof muestrasRescateHemato === 'function'
      ? new Set(muestrasRescateHemato().filter(m => !m.gestionada).map(m => m.nro_muestra)).size : 0;
    // Equipos
    const repAct = M.filter(m => m.estado === 'reproceso').length;
    const vphSV = M.filter(m => corto(m) === 'VPH' && m.estado === 'sin-validar').length;
    const vihSV = M.filter(m => corto(m) === 'HIV' && m.estado === 'sin-validar').length;
    // Pruebas manuales
    const manuales = typeof PRUEBAS_MANUALES_SANGRE !== 'undefined' ? PRUEBAS_MANUALES_SANGRE : new Set(['HLA B27', 'HLA B57']);
    const manSinVal = M.filter(m => manuales.has(corto(m)) && m.estado === 'sin-validar').length;
    // TB: misma regla del indicador de oportunidad (36 h alerta, 48 h vencida)
    const tb = typeof resumenOportunidadTB === 'function' ? resumenOportunidadTB() : { espera: [], vencidas: 0, porVencer: 0 };
    // Validación y neveras
    const sinVal = M.filter(m => m.estado === 'sin-validar').length;
    const remitidas = M.filter(m => m.estado === 'remitida');

    const z = {
      recepcion: { pin: miles(pend.length), cap: 'por recibir', st: pend.length > 150 ? 'warn' : 'ok',
        metrics: [['Escaneadas hoy', miles(escHoy)], ['Pendientes por recibir', `${miles(pend.length)} pruebas · ${miles(tubos(pend))} tubos`], ['Sin ingreso', miles(sinIng)], ['Por rescatar de hematología', miles(rescate)]] },
      extraccion: { name: 'Equipos · m2000sp / m2000rt', pin: miles(repAct), cap: 'reprocesos activos', st: repAct > 20 ? 'warn' : 'ok',
        metrics: [['Reprocesos activos', miles(repAct)], ['VPH sin validar', miles(vphSV)], ['VIH sin validar', miles(vihSV)]] },
      amplificacion: { name: 'Pruebas manuales · Genotipo', pin: ultMat ? miles(posUlt) : '—', cap: ultMat ? 'en la última matrícula' : 'sin matrículas', st: 'ok',
        metrics: [['Última matrícula', ultMat ? `${ultMat.mat_id} · ${fechaCorta(ultMat.created_at)}` : '—'], ['Muestras montadas', ultMat ? miles(posUlt) : '—'], ['Manuales sin validar', miles(manSinVal)]] },
      tb: { pin: miles(tb.vencidas || tb.porVencer || tb.espera.length), cap: tb.vencidas ? 'con más de 48 h' : tb.porVencer ? 'por vencer (36 h+)' : 'esperando resultado',
        st: tb.vencidas ? 'crit' : tb.porVencer ? 'warn' : 'ok',
        metrics: [['Esperando resultado', miles(tb.espera.length)], ['Por vencer (36–48 h)', miles(tb.porVencer)], ['Vencidas (más de 48 h)', miles(tb.vencidas)], ['Última corrida', ultTB ? fechaCorta(ultTB.created_at) : '—']] },
      validacion: { pin: miles(sinVal), cap: 'sin validar', st: 'info',
        metrics: [['Sin validar', miles(sinVal)], ['Validadas hoy', miles(valHoy)]] },
      descarte: { name: 'Neveras, remisiones y descarte', pin: miles(remitidas.length), cap: 'en laboratorio externo', st: 'ok',
        metrics: [['Remitidas sin resultado', miles(remitidas.length)], ['Último descarte', ultDesc ? fmt(ultDesc.fecha_descarte) : '—']] },
    };
    for (const id in z) z[id].metrics.push(['Cierre de turno', txtCierre(ZONA_A_CIERRE[id])]);
    return { zonas: z, cierre: { cerradas: nCerradas, total: totalAreas } };
  }
  // Zona del plano → área del cierre de turno
  const ZONA_A_CIERRE = { recepcion: 'recepcion', extraccion: 'equipos', amplificacion: 'manuales', tb: 'tb', validacion: 'validacion', descarte: 'validacion' };

  // ---------------- Áreas del laboratorio → secciones del gestor ----------------
  const AREAS = {
    recepcion:     { nombre: 'Recepción',                    icono: 'ti-scan',         inicio: 'recepcion',    secciones: ['ingresos', 'recepcion', 'pendientes', 'hematologia', 'sin-ingreso', 'anulados', 'correo'] },
    extraccion:    { nombre: 'Equipos m2000',                icono: 'ti-cpu',          inicio: 'reprocesos',   secciones: ['reprocesos', 'estadistica'] },
    amplificacion: { nombre: 'Pruebas manuales y Genotipo',  icono: 'ti-layout-grid',  inicio: 'matriculas',   secciones: ['matriculas', 'revision-manuales', 'remisiones', 'genotipo'] },
    tb:            { nombre: 'Tuberculosis',                 icono: 'ti-lungs',        inicio: 'tuberculosis', secciones: ['tuberculosis', 'revision-tb'] },
    validacion:    { nombre: 'Validación',                   icono: 'ti-circle-check', inicio: 'validacion',   secciones: ['validacion', 'reprocesos', 'estadistica', 'descarte'] },
    descarte:      { nombre: 'Neveras y descarte',           icono: 'ti-trash',        inicio: 'descarte',     secciones: ['descarte', 'remisiones'] },
  };
  const COMUNES = ['dashboard', 'checklist', 'muestras'];   // visibles en cualquier área
  let areaActual = null;
  let usuarios = null;

  const navName = el => ((el.getAttribute('onclick') || '').match(/nav\('([^']+)'/) || [])[1];
  const navEl = name => [...document.querySelectorAll('.sidebar .nav-item')].find(n => navName(n) === name);
  const etiqueta = name => { const el = navEl(name); if (!el) return name; const c = el.cloneNode(true); c.querySelectorAll('.badge').forEach(b => b.remove()); return c.textContent.trim(); };

  // ---------------- Pantalla del laboratorio ----------------
  const lobby = document.createElement('div');
  lobby.id = 'vista-lobby';
  lobby.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#F7F7F5;display:none;opacity:0;transition:opacity .25s ease';
  lobby.innerHTML = '<iframe id="vista-lab-frame" title="Vista del laboratorio" style="display:block;width:100%;height:100%;border:0;background:#F7F7F5"></iframe>';
  document.body.appendChild(lobby);
  const fr = lobby.querySelector('iframe');
  let frameListo = null;
  function cargarFrame() {
    if (!frameListo) frameListo = new Promise(res => { fr.addEventListener('load', () => res(), { once: true }); fr.src = 'vista-lab.html'; });
    return frameListo;
  }
  const post = msg => fr.contentWindow && fr.contentWindow.postMessage(msg, location.origin === 'null' ? '*' : location.origin);
  const abierta = () => lobby.style.display === 'block';
  let datosListos = false;
  let entregaPendiente = false;

  async function rolDe(nombre) {
    if (!usuarios) { const { data } = await sb.from('usuarios').select('nombre,rol'); usuarios = data || []; }
    const u = usuarios.find(x => x.nombre === nombre);
    return u ? u.rol : '';
  }

  async function abrirLobby(modo) {
    lobby.style.display = 'block';
    requestAnimationFrame(() => { lobby.style.opacity = '1'; });
    await cargarFrame();
    post({ type: 'vista-modo', modo, actual: areaActual && areaActual !== 'todas' ? areaActual : null, usuario: currentUser, rol: await rolDe(currentUser) });
    if (datosListos) enviarDatos(true);
    // Si la entrega de turno ya salió, se guarda para después de elegir el área
    if (window._modalEntrega && window._modalEntrega.style.display !== 'none') { window._modalEntrega.style.display = 'none'; entregaPendiente = true; }
    fr.focus();
  }
  function cerrarLobby() {
    lobby.style.opacity = '0';
    setTimeout(() => { lobby.style.display = 'none'; }, 260);
  }
  window.cambiarArea = () => abrirLobby('cambio');

  // ---------------- Menú lateral según el área ----------------
  const sidebar = document.querySelector('.sidebar');
  const tarjeta = document.createElement('div');
  tarjeta.id = 'area-card';
  tarjeta.style.cssText = 'margin:2px 10px 8px;padding:10px 11px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--accent-bg);display:none';
  sidebar.querySelector('.logo').after(tarjeta);

  const chip = document.createElement('button');
  chip.className = 'btn';
  chip.id = 'area-chip';
  chip.style.cssText = 'display:none;font-size:11px;margin-left:10px';
  chip.onclick = () => window.cambiarArea();
  document.getElementById('page-title').after(chip);

  function aplicarArea(id) {
    areaActual = id;
    const a = AREAS[id];
    sidebar.querySelectorAll('.nav-item').forEach(el => {
      const n = navName(el);
      el.style.display = (!a || COMUNES.includes(n) || a.secciones.includes(n)) ? '' : 'none';
    });
    sidebar.querySelectorAll('.nav-section').forEach(sec => {
      const vis = [...sec.querySelectorAll('.nav-item')].some(el => el.style.display !== 'none');
      sec.style.display = vis ? '' : 'none';
    });
    const nombre = a ? a.nombre : 'Todas las áreas';
    const icono = a ? a.icono : 'ti-building-hospital';
    tarjeta.innerHTML = `
      <div style="font-size:9.5px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.07em">Tu área ahora</div>
      <div style="display:flex;align-items:center;gap:6px;margin:4px 0 8px;font-size:13px;font-weight:600;color:var(--accent)"><i class="ti ${icono}"></i> ${nombre}</div>
      <button class="btn" style="width:100%;justify-content:center;font-size:11px;background:var(--surface)" onclick="cambiarArea()"><i class="ti ti-walk"></i> Cambiar de área</button>`;
    tarjeta.style.display = '';
    chip.innerHTML = `<i class="ti ti-map-pin"></i> ${nombre} · cambiar`;
    chip.style.display = '';
    const inicio = a ? a.inicio : 'dashboard';
    nav(inicio, navEl(inicio));
  }
  function limpiarArea() {
    areaActual = null;
    sidebar.querySelectorAll('.nav-item, .nav-section').forEach(el => { el.style.display = ''; });
    tarjeta.style.display = 'none'; chip.style.display = 'none';
  }

  // Mensajes desde el plano
  window.addEventListener('message', e => {
    if (e.source !== fr.contentWindow) return;
    const d = e.data; if (!d) return;
    if (d.type === 'vista-entrar') {
      const anterior = areaActual;
      aplicarArea(d.zona);
      cerrarLobby();
      const n = AREAS[d.zona] ? AREAS[d.zona].nombre : 'todas las áreas';
      if (anterior !== d.zona) toast(anterior ? `Te pasaste a ${n}` : `Bienvenido/a a ${n}`, 'ok');
    }
    if (d.type === 'vista-cerrar') cerrarLobby();
    // La puerta del laboratorio: ir al cierre de turno (del área donde está, si ya eligió una)
    if (d.type === 'vista-cierre') {
      if (!areaActual) aplicarArea('todas');
      cerrarLobby();
      irACierreArea(ZONA_A_CIERRE[areaActual] || null);
    }
    if ((d.type === 'vista-entrar' || d.type === 'vista-cerrar' || d.type === 'vista-cierre') && entregaPendiente) {
      entregaPendiente = false;
      setTimeout(() => { if (window._modalEntrega) window._modalEntrega.style.display = 'flex'; else entregaOriginal(); }, 350);
    }
  });

  let ultimoEnvio = 0, calculando = false;
  async function enviarDatos(force) {
    if (calculando || (!force && Date.now() - ultimoEnvio < 60000)) return;
    calculando = true;
    try {
      const { zonas, cierre } = await calcularZonas();
      for (const id in zonas) zonas[id].secciones = AREAS[id] ? [...AREAS[id].secciones, ...COMUNES.filter(c => c !== 'checklist')].map(etiqueta) : [];
      post({ type: 'vista-datos', zonas, cierre });
      ultimoEnvio = Date.now();
    } catch (err) { console.error('Vista del laboratorio:', err); }
    calculando = false;
  }

  // ---------------- Enganches con el gestor ----------------
  // Al entrar con el usuario: aparece el laboratorio primero
  const loginOriginal = loginUser;
  window.loginUser = loginUser = function () {
    loginOriginal();
    if (currentUser) { limpiarArea(); abrirLobby('entrada'); }
  };
  // Cuando el gestor termina de cargar, el plano recibe las cifras
  const initOriginal = initApp;
  window.initApp = initApp = async function () {
    await initOriginal();
    datosListos = true;
    await cargarFrame();
    enviarDatos(true);
    if (areaActual) { const a = AREAS[areaActual]; const ini = a ? a.inicio : 'dashboard'; nav(ini, navEl(ini)); }
  };
  // La entrega de turno aparece cuando la persona ya entró a su área, no encima del plano
  const entregaOriginal = verificarEntregaTurno;
  window.verificarEntregaTurno = verificarEntregaTurno = function () {
    if (abierta()) { entregaPendiente = true; return Promise.resolve(); }
    return entregaOriginal();
  };
  const logoutOriginal = logout;
  window.logout = logout = function () { logoutOriginal(); datosListos = false; limpiarArea(); cerrarLobby(); };
  // Mientras el plano está abierto, las cifras se refrescan (máximo cada minuto)
  setInterval(() => { if (abierta() && datosListos) enviarDatos(false); }, 20000);
})();
