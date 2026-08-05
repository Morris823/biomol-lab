// ============================================================
// SIN INGRESO
// ============================================================
async function loadSinIngreso() {
  const {data, error} = await sb.from('recepciones')
    .select('*')
    .eq('sin_ingreso', true)
    .order('fecha_recepcion', {ascending: false});
  if (error) { toast('Error: '+error.message,'err'); return; }
  const rows = data || [];
  // Actualizar badge
  const badge = document.getElementById('badge-sin-ingreso');
  if (badge) {
    badge.textContent = rows.length;
    badge.style.display = rows.length > 0 ? 'inline' : 'none';
  }
  document.getElementById('sin-ingreso-count').textContent = rows.length + ' muestras';
  document.getElementById('sin-ingreso-tabla').innerHTML = rows.length
    ? rows.map(r => {
        // Verificar si ahora sí tiene ingreso
        const ingreso = allMuestras.find(m => m.nro_muestra === r.nro_muestra);
        const tieneAhora = !!ingreso;
        return `<tr>
          <td class="mono">${fmt(r.fecha_recepcion)} ${fmtHora(r.fecha_recepcion)}</td>
          <td class="mono">${r.nro_muestra}</td>
          <td style="font-size:11px;color:var(--text2)">${r.recibido_por}</td>
          <td>${tieneAhora
            ? `<span style="color:var(--green);font-size:11px;font-weight:500"><i class="ti ti-circle-check"></i> Sí apareció — ${nombreCorto(ingreso.estudio_nombre, ingreso.estudio_codigo)} · ${pill(ingreso.estado)}</span>`
            : `<span style="color:var(--red);font-size:11px;font-weight:500"><i class="ti ti-alert-triangle"></i> Aún sin ingreso</span>`}</td>
          <td style="display:flex;gap:4px">
            ${!tieneAhora ? `<button class="btn btn-primary" style="padding:2px 8px;font-size:10px"
              onclick="abrirModalIngresoManual('${r.nro_muestra}')">
              <i class="ti ti-file-plus"></i> Registrar
            </button>` : ''}
            <button class="btn btn-red" style="padding:2px 8px;font-size:10px"
              onclick="eliminarSinIngreso('${r.nro_muestra}')">
              <i class="ti ti-trash"></i>
            </button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="empty-state">Sin muestras pendientes de ingreso 🎉</td></tr>';
}

async function eliminarSinIngreso(nro_muestra) {
  if (!confirm('¿Eliminar la recepción de ' + nro_muestra + '?')) return;
  const {error} = await sb.from('recepciones').delete()
    .eq('nro_muestra', nro_muestra).eq('sin_ingreso', true);
  if (error) { toast('Error: '+error.message,'err'); return; }
  toast('Eliminada', 'ok');
  await loadSinIngreso();
  await loadMuestras({force:true});
}


const SEDE_REGIONAL = {
  'Ay Dx Sura Referencia Noroccide LAB':'Antioquia','Ay Dx IPS Sura Centro':'Antioquia',
  'Ay Dx Sura Itagui':'Antioquia','Ay Dx Sura Sabaneta':'Antioquia',
  'Ay Dx Salud Sura Sao Paulo':'Antioquia','Ay Dx Sura Bello':'Antioquia',
  'Ay Dx Salud Sura Industriales':'Antioquia','Ay Dx IPS Sura San Diego':'Antioquia',
  'Ay Dx Sura Tranvia Plaza':'Antioquia','Ay Dx IPS Sura Molinos':'Antioquia',
  'Ay Dx Sura Córdoba 1':'Antioquia','Ay Dx Sura Envigado':'Antioquia',
  'Ay Dx IPS Sura Saman':'Antioquia','Ay Dx Sura San Ignacio':'Antioquia',
  'Ay Dx Salud Sura City Medica':'Antioquia','Ay Dx Sura Industriales':'Antioquia',
  'Ay Dx Sura Rionegro Centro':'Antioquia','Ay Dx Sura El Porvenir':'Antioquia',
  'Ay Dx Sura Manila Laboratorio':'Antioquia','Ay Dx Sura Los Colores':'Antioquia',
  'Ay Dx Sura Aranjuez':'Antioquia','Ay Dx Sura Punto Clave':'Antioquia',
  'Ay Dx Sura La 49 Bello':'Antioquia','Ay Dx Sura Almacentro':'Antioquia',
  'Ay Dx Sura Calasanz':'Antioquia','Ay Dx Sura San Antonio De Prado':'Antioquia',
  'Ay Dx Sura Cristo Rey':'Antioquia','Ay Dx Sura Caldas':'Antioquia',
  'Ay Dx Sura La Ceja':'Antioquia','Ay Dx Sura Comfama El Retiro':'Antioquia',
  'Ay Dx Sura Mall del Este':'Antioquia','Ay Dx Sura Comfama Plaza Fabricato':'Antioquia',
  'Ay Dx Sura Comfama Sabaneta Norte':'Antioquia','Ay Dx Sura Central Especialista Apartadó':'Antioquia',
  'Ay Dx Sura Girardota':'Antioquia','Ay Dx Sura Manrique':'Antioquia',
  'Ay Dx IPS Sura Monterrey':'Antioquia','Ay Dx Sura Belén':'Antioquia',
  'Ay Dx Sura Almendros':'Antioquia','Ay Dx Clínica CES':'Antioquia',
  'Ay Dx Sura Comfama San Cristóbal':'Antioquia','Ay Dx Sura Santa María':'Antioquia',
  'Ay Dx Sura Lopez de Mesa':'Antioquia','Ay Dx Sura PAC la 33':'Antioquia',
  'Ay Dx Sura La Central':'Antioquia','Ay Dx Sura La Estrella Centro':'Antioquia',
  'Ay Dx Sura La Estrella':'Antioquia','Ay Dx Sura Turbo':'Antioquia',
  'Ay Dx Sura City Plaza':'Antioquia','Ay Dx Sura Mayorca':'Antioquia',
  'Ay Dx Sura Copacabana':'Antioquia','Ay Dx Sura Ciudad del Rio P9':'Antioquia',
  'Ay Dx Sura Amagá':'Antioquia','Ay Dx Sura Nueva Colonia':'Antioquia',
  'Ay Dx Sura Chigorodó':'Antioquia','Ay Dx Sura Vegas':'Antioquia',
  'Ay Dx Comfama el Santuario':'Antioquia','Ay Dx Sura Carepa Maria Cano':'Antioquia',
  'Ay Dx Drive Thru SaludSura Ind':'Antioquia','Ay Dx Sura El Retiro':'Antioquia',
  'Ay Dx Sura Santuario':'Antioquia','Ay Dx Sura Apartadó':'Antioquia',
  'Ay Dx Sura La Unión':'Antioquia','Ay Dx Sura Salud Plaza':'Antioquia',
  'Ay Dx Sura Andes':'Antioquia','Ay Dx Sura Viva Envigado':'Antioquia',
  'Ay Dx Ips Urg Clinica La Vegas':'Antioquia','Ay Dx Sura Robledo':'Antioquia',
  'Ay Dx Sura Referencia Centro LAB':'Bogotá','Ay Dx Sura Calle 49':'Bogotá',
  'Ay Dx IPS Sura Chapinero':'Bogotá','Ay Dx Sura Plaza Central':'Bogotá',
  'Ay Dx Sura A&G Zipaquirá':'Bogotá','Ay Dx Salud Sura Calle 100':'Bogotá',
  'Ay Dx IPS Sura Olaya':'Bogotá','Ay Dx Colsubsidio Nuestro BOG':'Bogotá',
  'Ay Dx Colsubsidio Sur':'Bogotá','Ay Dx Sura Darsalud':'Bogotá',
  'Ay Dx Sura Santa Fé Américas':'Bogotá','Ay Dx Salud Sura Usaquen':'Bogotá',
  'Ay Dx Colsubsidio Castellana':'Bogotá','Ay Dx Sura Domicilios Póliza Centro':'Bogotá',
  'Ay Dx Sura Domicilios Centro':'Bogotá','Ay Dx Colsubsidio Plaza Central':'Bogotá',
  'Ay Dx Colsubsidio Suba':'Bogotá','Ay Dx Sura A&G NIZA':'Bogotá',
  'Ay Dx Sura La Plazuela':'Barranquilla','Ay Dx Salud Sura Altos del Prado':'Barranquilla',
  'Ay Dx Sura Montería':'Barranquilla','Ay Dx Salud Sura Portal del Genovés':'Barranquilla',
  'Ay Dx Sura VIVA Barranquilla':'Barranquilla','Ay Dx Sura Toma IPS las Moras':'Barranquilla',
  'Ay Dx Sura Bucaramanga':'Barranquilla','Ay Dx Sura Portal del Prado':'Barranquilla',
  'Ay Dx Salud Sura Bquilla Cordialidad':'Barranquilla','Ay Dx Sura LAB Referente del Genovés':'Barranquilla',
  'Ay Dx Sura Malambo':'Barranquilla','Ay Dx Salud Sura Bucaramanga':'Barranquilla',
  'Ay Dx Sura Referencia Bucaramanga LAB':'Barranquilla','Ay Dx Sura Santa Marta':'Barranquilla',
  'Ay Dx Sura Domicilios Norte':'Barranquilla','Ay Dx Salud Sura Cúcuta':'Barranquilla',
  'Ay Dx Sura Pie de Popa Toma de Muestras':'Barranquilla','Ay Dx Sura VIVA Barranquilla Póliza':'Barranquilla',
  'Ay Dx Colsubsidio Aventura Plaza':'Cali','Ay Dx Sura CONFA Manizales':'Cali',
  'Ay Dx Colsubsidio Pereira Pinares':'Cali','Ay Dx Sura Armenia Norte':'Cali',
  'Ay Dx Sura Vivir Norte':'Cali','Ay Dx Sura La Flora':'Cali',
  'Ay Dx IPS Sura Tequendama':'Cali','Ay Dx Sura Referencia Suroccidente':'Cali',
  'Ay Dx Sura Tequendama':'Cali','Ay Dx Colsubsidio Cali':'Cali',
  'Ay Dx Sura VIP Cali Sur':'Cali','Ay Dx Sura Reina Isabel':'Cali',
  'Ay Dx Sura Chipichape TM':'Cali','Ay Dx Colsubsidio Pereira':'Cali',
  'Ay Dx Sura Domicilios Póli Suroccidente':'Cali','Ay Dx Sura Domicilios Suroccidente':'Cali',
  'Ay Dx IPS Sura Paso Ancho':'Cali','Ay Dx Sura Pereira':'Cali',
  'Ay Dx Salud Sura Pereira Laboratorio':'Cali','Ay Dx Centro Especial Armenia':'Cali',
  'Ay Dx Sura Dosquebradas Risaralda':'Cali','Ay Dx Sura Domicilios Manizales':'Cali',
};

function getRegional(sede) {
  if (!sede) return '—';
  // Búsqueda exacta primero
  if (SEDE_REGIONAL[sede]) return SEDE_REGIONAL[sede];
  // Búsqueda parcial como fallback
  const s = sede.toLowerCase();
  for (const [k,v] of Object.entries(SEDE_REGIONAL)) {
    if (s.includes(k.toLowerCase().slice(8))) return v; // quita 'Ay Dx ' del inicio
  }
  return '—';
}

// ============================================================
// HISTORIAL CIERRES DE TURNO
// ============================================================
let histCierresVisible = false;

function toggleHistCierres() {
  histCierresVisible = !histCierresVisible;
  document.getElementById('hist-cierres-body').style.display = histCierresVisible ? 'block' : 'none';
  document.getElementById('hist-cierres-icon').className = histCierresVisible ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
  if (histCierresVisible) loadHistorialCierres();
}

async function loadHistorialCierres() {
  const {data, error} = await sb.from('cierres_turno')
    .select('*')
    .order('fecha_cierre', {ascending: false})
    .limit(30);
  if (error) { console.error(error); return; }
  const rows = data || [];
  document.getElementById('hist-cierres-count').textContent = rows.length + ' cierres';
  document.getElementById('hist-cierres-tabla').innerHTML = rows.length
    ? rows.map(r => {
        const totalFisico = r.conteo_cervix || 0; // conteo_cervix = conteo total
        const cuadra = totalFisico > 0 && totalFisico === (r.total_escaneadas||0);
        return `<tr>
          <td class="mono">${fmt(r.fecha_cierre)}</td>
          <td style="font-size:12px;font-weight:500">${r.cerrado_por}</td>
          <td style="text-align:center"><strong>${r.total_escaneadas||0}</strong></td>
          <td style="text-align:center">${totalFisico || '—'}</td>
          <td style="text-align:center">${totalFisico > 0
            ? (cuadra
              ? '<span style="color:var(--green)">✅ Cuadra</span>'
              : '<span style="color:var(--red)">⚠️ No cuadra</span>')
            : '—'}</td>
          <td style="font-size:11px;color:var(--text2);max-width:200px;overflow:hidden;text-overflow:ellipsis">${r.observaciones||'—'}</td>
          <td>
            <button class="btn" style="padding:2px 7px;font-size:10px;color:var(--red);border-color:var(--red-border)"
              onclick="eliminarCierre('${r.id}',event)" title="Eliminar">
              <i class="ti ti-trash"></i>
            </button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty-state">Sin cierres registrados</td></tr>';
}

async function eliminarCierre(id, event) {
  event.stopPropagation();
  if (!confirm('¿Eliminar este registro de cierre de turno? Esta acción no se puede deshacer.')) return;
  const {error} = await sb.from('cierres_turno').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Cierre eliminado', 'ok');
  loadHistorialCierres();
}

async function eliminarMatricula(id, matId) {
  if (!confirm(`¿Eliminar la matrícula ${matId} y todas sus posiciones?\n\nEsta acción no se puede deshacer.`)) return;
  // Eliminar posiciones primero (FK constraint)
  await sb.from('matricula_posiciones').delete().eq('matricula_id', id);
  const {error} = await sb.from('matriculas').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast(`Matrícula ${matId} eliminada`, 'ok');
  cargarHistorialMatriculas();
}

async function eliminarCorridaTB(id, corrId) {
  if (!confirm(`¿Eliminar la corrida ${corrId} y todas sus muestras?\n\nEsta acción no se puede deshacer.`)) return;
  await sb.from('corrida_tb_posiciones').delete().eq('corrida_id', id);
  const {error} = await sb.from('corridas_tb').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast(`Corrida ${corrId} eliminada`, 'ok');
  cargarHistorialTB();
}

