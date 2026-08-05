// ============================================================
// ANULADOS
// ============================================================
async function registrarAnulado() {
  const cod = document.getElementById('anu-cod').value.trim();
  const motivo = document.getElementById('anu-motivo').value.trim();
  if (!cod) { toast('Ingresa el código','err'); return; }
  const ingreso = allMuestras.find(m=>m.nro_muestra===cod||m.od_id===cod);
  const {error} = await sb.from('anulados').insert({
    od_id: ingreso?.od_id||cod, nro_muestra: cod,
    motivo_anulacion: motivo, registrado_por: currentUser
  });
  if (error) { toast('Error: '+error.message,'err'); return; }
  toast('Anulado registrado','ok');
  document.getElementById('anu-cod').value='';
  document.getElementById('anu-motivo').value='';
  await loadMuestras({force:true});
  loadAnulados();
}

async function loadAnulados() {
  const {data} = await sb.from('anulados').select('*').order('fecha',{ascending:false}).limit(50);
  document.getElementById('anu-tabla').innerHTML = data && data.length
    ? data.map(a=>{
        const ing = allMuestras.find(m=>m.od_id===a.od_id);
        return`<tr>
          <td class="mono">${fmt(a.fecha)}</td>
          <td class="mono">${a.nro_muestra}</td>
          <td style="font-size:11px">${ing ? nombreCorto(ing.estudio_nombre,ing.estudio_codigo) : '—'}</td>
          <td style="font-size:11px">${ing?.paciente||'—'}</td>
          <td style="font-size:11px">${a.motivo_anulacion||'—'}</td>
          <td style="font-size:11px;color:var(--text2)">${a.registrado_por}</td>
        </tr>`;}).join('')
    : '<tr><td colspan="5" class="empty-state">Sin anulados</td></tr>';
}

