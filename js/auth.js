// ============================================================
// AUTH — selector de usuario
// ============================================================
async function loadUsers() {
  const {data} = await sb.from('usuarios').select('*').eq('activo', true).order('nombre');
  const picker = document.getElementById('user-picker');
  const rolLabel = {'biologo_molecular':'Biólogo Molecular','auxiliar':'Auxiliar','supervisor':'Supervisor','Biólogo Molecular':'Biólogo Molecular','Auxiliar':'Auxiliar','Supervisor':'Supervisor'};
  if (data) data.forEach(u => {
    const o = document.createElement('option');
    o.value = u.nombre;
    o.textContent = u.nombre + ' (' + (rolLabel[u.rol] || u.rol) + ')';
    picker.appendChild(o);
  });
}

function loginUser() {
  const val = document.getElementById('user-picker').value;
  if (!val) { toast('Selecciona tu nombre para continuar', 'err'); return; }
  currentUser = val;
  document.getElementById('user-modal').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  document.getElementById('user-display').textContent = currentUser;
  initApp();
}

function logout() {
  currentUser = null;
  validadasCargadas = false;
  allMuestras = [];
  lastMuestrasLoad = 0;
  document.getElementById('user-modal').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

