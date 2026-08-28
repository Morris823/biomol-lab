// ============================================================
// AUTH — usuario + PIN sobre Supabase Auth
// ============================================================
// Cada usuario tiene un correo interno (p.ej. mateo@biomol.local) creado en
// Supabase Authentication; el PIN es su contraseña. El correo se guarda en
// usuarios.email. El selector muestra el NOMBRE; el login usa el correo + PIN.
// currentUser sigue siendo el NOMBRE (lo usan los ~30 campos de auditoría).

const ROL_LABEL = {
  'biologo_molecular':'Biólogo Molecular', 'auxiliar':'Auxiliar', 'supervisor':'Supervisor',
  'Biólogo Molecular':'Biólogo Molecular', 'Auxiliar':'Auxiliar', 'Supervisor':'Supervisor'
};

async function loadUsers() {
  // usuarios es legible sin sesión (política RLS de solo-lectura para anon),
  // para poder poblar el selector antes de iniciar sesión.
  const {data} = await sb.from('usuarios').select('nombre,email,rol').eq('activo', true).order('nombre');
  const picker = document.getElementById('user-picker');
  if (!picker) return;
  // limpiar opciones previas (excepto el placeholder)
  picker.querySelectorAll('option[data-user]').forEach(o => o.remove());
  if (data) data.forEach(u => {
    const o = document.createElement('option');
    o.value = u.email || '';
    o.dataset.user = '1';
    o.dataset.nombre = u.nombre;
    o.textContent = u.nombre + ' (' + (ROL_LABEL[u.rol] || u.rol) + ')';
    picker.appendChild(o);
  });
}

async function loginUser() {
  const picker = document.getElementById('user-picker');
  const email = picker.value;
  const nombre = picker.options[picker.selectedIndex] ? picker.options[picker.selectedIndex].dataset.nombre : null;
  const pin = document.getElementById('user-pin').value;
  if (!email || !nombre) { toast('Selecciona tu nombre para continuar', 'err'); return; }
  if (!pin || pin.length < 6) { toast('Ingresa tu PIN (mínimo 6 dígitos)', 'err'); return; }

  const btn = document.querySelector('#user-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Entrando...'; }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pin });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-login"></i> Entrar al sistema'; }
  if (error || !data || !data.session) {
    toast('PIN incorrecto o usuario no habilitado', 'err');
    return;
  }
  entrarAlSistema(nombre);
}

// Muestra la app y arranca la carga. currentUser = NOMBRE.
function entrarAlSistema(nombre) {
  currentUser = nombre;
  const pinEl = document.getElementById('user-pin');
  if (pinEl) pinEl.value = '';
  document.getElementById('user-modal').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  document.getElementById('user-display').textContent = currentUser;
  initApp();
  setTimeout(verificarEntregaTurno, 800);
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  validadasCargadas = false;
  validadasSlim = [];
  validadasSlimCargadas = false;
  allMuestras = [];
  lastMuestrasLoad = 0;
  const pinEl = document.getElementById('user-pin');
  if (pinEl) pinEl.value = '';
  document.getElementById('user-modal').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

// Al abrir el gestor: si ya hay sesión de Supabase (recordada), entra directo;
// si no, deja el modal de login visible.
async function initSession() {
  await loadUsers();
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    // Ya está autenticado (sesión recordada). Recuperar el nombre por el correo.
    const { data: u } = await sb.from('usuarios').select('nombre').eq('email', session.user.email).maybeSingle();
    entrarAlSistema(u ? u.nombre : session.user.email);
  }
}
