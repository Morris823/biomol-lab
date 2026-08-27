// Genera js/config.js en el build de Netlify a partir de variables de entorno.
// Así las credenciales NO viven en el repositorio.
const fs = require('fs');
const url = process.env.SUPA_URL;
const key = process.env.SUPA_KEY;
if (!url || !key) {
  console.error('ERROR: faltan las variables de entorno SUPA_URL y/o SUPA_KEY.');
  console.error('Configúralas en Netlify: Site settings -> Environment variables.');
  process.exit(1);
}
const contenido = `window.BIOMOL_CONFIG = {\n  SUPA_URL: ${JSON.stringify(url)},\n  SUPA_KEY: ${JSON.stringify(key)},\n};\n`;
fs.writeFileSync('js/config.js', contenido);
console.log('js/config.js generado desde variables de entorno.');
