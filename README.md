# BioMol Lab — Gestor de trazabilidad de muestras

Aplicación de trazabilidad y gestión del ciclo de vida de muestras clínicas para el área de **Biología Molecular de SURA Medellín**. Autor: Mateo Morales V. Uso diario por el equipo de biólogos y auxiliares del laboratorio.

## Estado del proyecto

Migrado de un **single-file HTML** (`biomol_lab.html`, ~6500 líneas) a una estructura **modular** (HTML + CSS + JS separados por sección), **sin cambiar la funcionalidad ni la lógica de negocio**. El objetivo de esta separación es:

- No tener que leer/pegar todo el código para cada cambio.
- Evitar reintroducir bugs ya resueltos (cada función vive en **un solo lugar**).
- Tener memoria persistente real vía Git en lugar de una sesión de chat.

> La división fue **mecánica y verificada**: el JavaScript resultante es **byte-idéntico** al del archivo original (misma lógica, mismo orden de ejecución). Lo único que cambió a propósito es que las credenciales de Supabase se movieron a `js/config.js` (no versionado).

---

## Cómo correr el proyecto

No hay build ni dependencias que instalar (todo es vanilla JS + librerías por CDN). Solo hace falta un servidor estático porque el navegador no carga `<script src>` locales vía `file://` de forma fiable.

### 1. Crear tu `js/config.js` (una sola vez)

Las credenciales de Supabase **no están en el repositorio** (ver sección de Seguridad). Copia la plantilla y rellénala:

```bash
cp js/config.example.js js/config.js
```

Luego edita `js/config.js` con la URL y la anon key reales del proyecto Supabase
(Supabase Dashboard → *Project Settings* → *API*).

### 2. Servir la carpeta

Cualquier servidor estático sirve. Ejemplos:

```bash
# Python
python3 -m http.server 8080

# o Node
npx serve .
```

Abre `http://localhost:8080`.

> Para producción, publicar la carpeta en cualquier hosting estático (Netlify, Vercel, GitHub Pages, Supabase Hosting, etc.). `js/config.js` debe existir en el servidor pero **nunca** commitearse al repo.

---

## Estructura de archivos

```
biomol-lab/
├── index.html                 # Estructura HTML + modales + orden de carga de scripts
├── css/
│   └── styles.css             # Todos los estilos (antes en <style>)
├── js/
│   ├── config.example.js      # Plantilla de credenciales (SÍ versionado)
│   ├── config.js              # Credenciales reales (NO versionado — .gitignore)
│   ├── supabase-client.js     # Inicializa el cliente sb desde window.BIOMOL_CONFIG
│   ├── state.js               # Estado global + nombreCorto() + utilidades de fecha (fmt, fmtHora, localCOtoUTC, excelSerialToUTC)
│   ├── auth.js                # loadUsers, loginUser, logout (selector de usuario)
│   ├── app-init.js            # initApp, loadPruebas, loadMuestras (carga diferida), setupRealtime
│   ├── nav.js                 # nav() dispatcher + navToMuestrasFiltered + PAGE_TITLES
│   ├── dashboard.js           # initDashboard, renderDashboard, gráficas + CONFIG_PRUEBA
│   ├── ingresos.js            # Importador Excel de LabCore + normalización
│   ├── recepcion.js           # Escaneo físico + escáner TB + cierre de turno de auxiliares
│   ├── validacion.js          # Importador de validados
│   ├── reprocesos.js          # Reprocesos + autocompletar de motivos
│   ├── nuevas-muestras.js     # Solicitudes de nueva muestra
│   ├── tablas.js              # sortTable + renderPaginacion (reutilizables)
│   ├── pendientes.js          # Pendientes / gestiones (por recibir y por validar)
│   ├── anulados.js            # Anulados
│   ├── todas-las-muestras.js  # Filtros + cambio manual de estado + drawer de detalle + toast
│   ├── matriculas.js          # Pruebas manuales (gradillas de 48 posiciones)
│   ├── tuberculosis.js        # Corridas TB
│   ├── sin-ingreso.js         # Muestras fantasma + historial de cierres de turno
│   ├── modales.js             # Modal de controles + modal de ingreso manual
│   ├── correo.js              # Generador de correo de solicitud de nueva muestra
│   ├── revision-pendientes.js # seguimiento_manuales (área manuales / tb)
│   ├── remisiones.js          # Remisiones a Colcan + PDF
│   ├── checklist.js           # Checklist de cierre de turno de bacteriólogos + modal de entrega
│   ├── descarte.js            # Registro de descartes (VPH/VIH/VHB/VHC/CMV)
│   ├── estadistica.js         # Estadística mensual de equipos (backup QC/CAL)
│   └── main.js                # Bootstrap: loadUsers() + verificarEntregaTurno()
├── .gitignore
└── README.md
```

### Orden de carga (importante)

Los módulos son **scripts clásicos en scope global** (no módulos ES), porque la app usa
**226 handlers `onclick="funcion()"` inline** que requieren funciones globales. `index.html`
los carga **en el mismo orden en que aparecían en el archivo monolítico** — ese orden importa:
`config.js` → `supabase-client.js` → `state.js` → ... → `main.js`. Al agregar un módulo nuevo,
respetar dependencias (declarar antes de usar) y registrarlo en `index.html`.

> **Mejora futura (no hecha aún, para no cambiar comportamiento):** migrar a módulos ES
> (`import`/`export`) y reemplazar los `onclick` inline por `addEventListener`. Eso daría
> aislamiento real de scope, pero es un cambio grande que debe hacerse con pruebas.

---

## Seguridad — anon key de Supabase

La anon key se movió de estar **hardcodeada en el HTML** a `js/config.js`, que está en `.gitignore` y **no se sube al repositorio**. Esto mantiene la key fuera del historial de Git.

> **Nota honesta sobre el alcance:** como esta app corre 100% en el navegador, la anon key
> **siempre será visible** para cualquier persona que use el aplicativo (está en el tráfico de
> red / en el `config.js` servido). Sacarla del repo evita exponerla en GitHub, pero **no** la
> vuelve secreta frente a los usuarios de la app. La protección real de los datos es:
> 1. **RLS (Row Level Security)** activo en todas las tablas (ya está).
> 2. Mantener el **repositorio privado**.
> 3. A futuro: autenticación real (email+password) en lugar del selector de nombre.

### Historial de migraciones Supabase
- Proyecto original `ywdaoqtlreyvrmjuycze` agotó su cuota de egress gratuita (14.62GB de 5.5GB) y quedó bloqueado.
- Migrado a `exmwkjzogphyfqforerq` con exportación manual de CSVs.
- RLS está activado en todas las tablas con policy `acceso_app FOR ALL USING (true)` — acceso abierto vía anon key, sin autenticación de usuario real todavía (login es solo un selector de nombre, no email+password).

---

## Stack técnico

- **Frontend:** HTML + JavaScript vanilla (sin frameworks, sin bundler)
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth)
- **Librerías CDN:** `@supabase/supabase-js@2`, `xlsx@0.18.5` (SheetJS para leer Excel), `@tabler/icons-webfont` (iconos)
- **Proyecto Supabase actual:** `exmwkjzogphyfqforerq` (`https://exmwkjzogphyfqforerq.supabase.co`)

---

## Contexto del negocio

### Pruebas procesadas
CMV, VHB, VHC, VIH (carga viral), VPH, HLA B27, HLA B57, Hemocromatosis, Homocisteína, MTHFR, Tuberculosis (TB), Genotipificación de VIH, Genotipificación de Hepatitis C (Geno C), Integrasa.

### Equipo del laboratorio
**Biólogos:** Didier, Adriana, Willington, Lizet, Yadira, Marlon, Santiago, Laura Álvarez, Jefferson, Samanta, Mateo.
**Auxiliares:** Gloria Ramírez, Laura Pertuz.

### LIS (Laboratory Information System)
**LabCore** — exporta Excel con fechas en formato serial de Excel y headers en español con tildes. Los códigos de muestra (`nro_muestra`) siempre empiezan con `AAMMDD` (año-mes-día, 2 dígitos cada uno) seguido de un número secuencial único.

### Zona horaria
**Todo el sistema opera en hora Colombia (UTC-5, `America/Bogota`)**, independientemente de la configuración del navegador/computador. Las funciones de formateo de fecha (`fmt`, `fmtHora`, en `js/state.js`) deben forzar `timeZone: 'America/Bogota'` explícitamente — depender de la configuración del sistema operativo del computador ha causado bugs de horas incorrectas repetidamente.

**Cuidado con doble conversión de zona horaria** — bug recurrente: `new Date()` ya interpreta strings sin sufijo de zona en la zona horaria local del navegador. Sumar manualmente 5 horas después de eso duplica la corrección. Usar offset explícito (`-05:00`) al construir fechas desde inputs `datetime-local`, y sumar el offset una sola vez al convertir seriales de Excel.

### Configuración de pruebas — días de montaje y límites de oportunidad

Definida en `CONFIG_PRUEBA` (en `js/dashboard.js`).

| Prueba | Días de montaje | Límite (días hábiles desde montaje) |
|---|---|---|
| CMV | Martes y viernes | 2 |
| VHB | Miércoles | 3 |
| VHC | Jueves | 3 |
| VIH (carga viral) | Lunes a viernes | 3 |
| VPH | Lunes a **sábado** | 3 |
| HLA B27 | Martes y viernes | 2 |
| HLA B57 | Martes y viernes | 2 |
| Hemocromatosis | Miércoles | 2 |
| Homocisteína | Viernes | 10 |
| MTHFR | Viernes | 10 |
| Tuberculosis | Lunes, miércoles, viernes | 1 |
| Geno HIV | Lunes a viernes | 30 |
| Geno C | Viernes | 8 |
| Integrasa | Lunes a viernes | 26 |

- Los **sábados no cuentan como día hábil** para el conteo de oportunidad, aunque VPH sí monte ese día.
- Si un día de montaje cae en festivo colombiano, el montaje se corre al siguiente día hábil de montaje de esa prueba (excepto VPH que igual monta sábado).
- Festivos colombianos 2025-2026 están hardcodeados como `Set` en varias funciones (`FESTIVOS_CO`, `FESTIVOS_CL`) — **deberían unificarse en una sola fuente** al continuar el desarrollo (hoy `FESTIVOS_CL` vive en `js/checklist.js`).

---

## Modelo de datos (Supabase)

### Tablas principales
- **`ingresos`** — registro de cada muestra que llega según LabCore. Campos clave: `od_id` (PK lógica, único), `nro_muestra`, `identificacion`, `apellidos`, `nombres`, `estudio_codigo`, `estudio_nombre`, `sede`, `fecha_ingreso` (se asigna al momento de subir el archivo al gestor, **no** viene en el Excel de LabCore), `subido_por`.
- **`recepciones`** — escaneo físico del tubo al llegar al laboratorio. `nro_muestra`, `fecha_recepcion`, `recibido_por`, `es_tb` (bool, separa TB del conteo principal), `sin_ingreso` (bool, escaneado pero sin ingreso en `ingresos` — "muestra fantasma").
- **`validaciones`** — resultado validado. `od_id`, `fecha_validacion`, `importado_por`.
- **`reprocesos`** — muestras con reproceso. `od_id`, `nro_muestra`, `estudio_nombre`, `codigo_motivo`, `desc_motivo`, `registrado_por`.
- **`nuevas_muestras`** — solicitudes de nueva muestra (rechazo + reprocesamiento imposible). Estructura similar a reprocesos.
- **`anulados`** — muestras anuladas.
- **`gestiones`** — notas de gestión de pendientes (auxiliares). `od_id`, `nro_muestra`, `descripcion`, `gestionado_por`, `gestionada` (bool).
- **`matriculas`** / **`matricula_posiciones`** — matrículas de pruebas manuales (gradillas de 48 posiciones). Estado `abierta`/`cerrada`, se cierra automáticamente cuando todas las posiciones quedan validadas o en nueva-muestra.
- **`corridas_tb`** / **`corrida_tb_posiciones`** — igual que matrículas pero para TB. Las TB nunca se numeran físicamente, la posición 1 siempre es control de equipo.
- **`cierres_turno`** — cierre de turno de recepción (auxiliares). Conteo físico vs sistema.
- **`seguimiento_manuales`** — revisión de pendientes (LabCore vs gestor), separado por `area` (`'manuales'` | `'tb'`). Estados: `pendiente`, `gestionado`, `validado`. Campo `tipo`: `pendiente`, `fantasma` (no está en el gestor), `validado_sin_ingreso`.
- **`remisiones`** / **`remision_posiciones`** — muestras remitidas a laboratorio externo (Colcan). Incluye `codigo_colcan` (0118=MTHFR/Homocisteína, 0146=Hemocromatosis), `edad`.
- **`checklist_turno`** — checklist diario de cierre de turno de bacteriólogos. Un registro por fecha (`UNIQUE`), campo `items` tipo `jsonb` con estructura `{ [key]: { checked, por, fecha_marcado, observacion } }`. Campos especiales: `mantenimiento_mensual_fecha`, `validacion_gestor_desde/hasta`, `validacion_labcore_desde/hasta`, `obs_entrega_tarde`, `cerrado`/`cerrado_por`/`cerrado_fecha`.
- **`registros_descarte`** — historial de descartes de muestras (VPH/VIH/VHB/VHC/CMV únicamente).
- **`cambios_estado_manual`** — auditoría de cambios manuales de estado.
- **`importaciones_validados`** — log de cada carga de Excel de validados.
- **`pruebas`** — catálogo local de pruebas: código LabCore, nombre corto, nombre largo.
- **`usuarios`** — nombre, rol (`biologo_molecular`/`auxiliar`), activo.

### Vista crítica: `v_muestras`
Vista `SECURITY INVOKER` (no `SECURITY DEFINER` — bug de seguridad corregido) que unifica todo el estado de una muestra vía `LEFT JOIN LATERAL` sobre `recepciones` (toma la más reciente) + joins a `validaciones`, `reprocesos`, `nuevas_muestras`, `anulados`, `gestiones`, `remision_posiciones`.

**Jerarquía de estados (orden de prioridad en el `CASE`):**
```
anulado > validado > nueva-muestra > remitida > reproceso > sin-validar > pendiente
```
Esta jerarquía se ha corregido varias veces — validado debe evaluarse ANTES que nueva-muestra/reproceso, de lo contrario una muestra que pasó por reproceso y luego se validó queda mostrando "reproceso" incorrectamente. En el frontend, el orden vive en `ESTADO_JERARQUIA` (`js/todas-las-muestras.js`). El SQL de la vista **debe versionarse en una migración** aparte, no reescribirse de memoria.

---

## Optimización de egress (crítico — plan gratuito de Supabase)

Supabase free tier tiene límite de **5GB/mes de egress**. El proyecto ya superó este límite una vez por cargar todas las muestras (incluidas ~80% validadas) en cada sesión.

**Patrón de carga diferida implementado** (en `js/app-init.js` → `loadMuestras`; **frágil, se ha perdido varias veces al reconstruir el HTML — cuidado especial al modificar**):

1. `loadMuestras()` por defecto solo trae estados **activos** (`ESTADOS_ACTIVOS`): `pendiente, recibido, sin-validar, reproceso, nueva-muestra, remitida, anulado`. **Nunca** trae `validado` a menos que se pida explícitamente.
2. Flag global `validadasCargadas` (bool) evita recargar validadas más de una vez por sesión.
3. Las validadas se cargan **solo** cuando:
   - El Dashboard se actualiza manualmente (botón "Actualizar estadísticas" — el dashboard NO carga validadas automáticamente al entrar).
   - El usuario filtra por "Validado" o "Todos" en Todas las Muestras **por interacción explícita** (clic en chip o campo de búsqueda) — la carga inicial de la página nunca dispara el fetch aunque el filtro visual diga "Todos".
   - El usuario busca texto >3 caracteres en Todas las Muestras.
4. `SELECT` siempre especifica columnas explícitas (`COLS_MUESTRAS`), nunca `SELECT *`.
5. Paginación de 1000 filas por request (límite de Supabase) con loop de `range()`.
6. Sin Supabase Realtime (7 WebSockets consumían egress constante) — reemplazado por polling manual.
7. Caché de 60 segundos antes de recargar `allMuestras` en memoria (`lastMuestrasLoad`).

---

## Filtros de negocio específicos (no evidentes, no perder al modificar)

1. **Importador de ingresos excluye automáticamente** VIH carga viral y VPH/Papiloma (códigos LabCore `1000107, 1009395, 1011771, 1002198, 1000165`) de 57 sedes fuera de Antioquia — error recurrente de LabCore que enviaba muestras de otras regionales al área. **Nunca excluir Genotipificación de VIH**, que sí pertenece al área aunque tenga "VIH" en el nombre. (`js/ingresos.js`)
2. **TB nunca se numera físicamente** — se excluye del conteo de tubos del cierre de turno de recepción. La posición 1 de cada corrida TB es siempre control de equipo. (`js/tuberculosis.js`, `js/recepcion.js`)
3. **Validaciones cruzan por `od_id`**, nunca por `nro_muestra` — un mismo tubo puede tener múltiples pruebas (múltiples `od_id`), cada una se valida independientemente.
4. **Duplicado real** = mismo `nro_muestra` escaneado más de una vez en `recepciones` (excluyendo TB). Múltiples `od_id` con el mismo `nro_muestra` (varias pruebas en un tubo) NO es duplicado.
5. **Remisiones a Colcan** — mapeo de prueba a código: MTHFR y Homocisteína → `0118`; Hemocromatosis → `0146`. El nombre completo a mostrar en el reporte se deriva del código Colcan, no del nombre interno de la prueba. (`js/remisiones.js`)
6. **Descarte** solo aplica a VPH, VIH, VHB, VHC, CMV (`PRUEBAS_DESCARTE` en `js/descarte.js`) — no a pruebas manuales ni TB.
7. **Checklist de cierre de turno** (`js/checklist.js`): los controles VPH/VIH se montan y registran en Greenbelt el mismo día en la mañana (L-M-V, o M-J-V si festivo). Los controles CMV/VHC/VHB se montan L-M-V en la tarde pero se registran en Greenbelt el día hábil **siguiente** en la mañana. El checklist de TB completo solo se habilita si se marca "¿Hay montaje de TB hoy?". El mantenimiento semanal de pruebas manuales puede hacerse cualquier día pero solo una vez por semana ISO (lunes-domingo). Un checklist cerrado o de una fecha pasada queda en solo lectura.

---

## Bugs recurrentes a vigilar

- **Nav dispatcher incompleto**: cada nueva sección debe registrar su `if (name === 'x') initX();` en el dispatcher de `nav()` (`js/nav.js`) — se ha olvidado más de una vez, causando pantallas que cargan vacías silenciosamente.
- **Doble corrección de zona horaria** al construir fechas desde inputs `datetime-local` o seriales de Excel — ver sección de zona horaria arriba.
- **Registros que solo viven en memoria (`let x = []`)** sin persistir a Supabase — ha pasado con notas de descarte; verificar que toda sección con formulario tenga su tabla y sus `insert`/`select` correspondientes.
- **Colores/leyendas de UI que quedan huérfanas** tras cambiar la lógica de negocio.
- **Orden de carga de scripts en `index.html`**: si un módulo usa algo declarado en otro, debe cargarse después. No reordenar los `<script>` sin revisar dependencias.

---

## Contacto / continuidad

Cualquier cambio en la lógica de negocio (días de montaje, límites de oportunidad, mapeos de Colcan, sedes excluidas) debe confirmarse con Mateo Morales V. antes de implementar — estas reglas vienen de decisiones operativas del laboratorio, no son inferibles del código.
