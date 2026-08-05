// ============================================================
// SUPABASE  (cliente)
// ============================================================
// Las credenciales viven en js/config.js (NO versionado — ver README).
// config.js se carga ANTES que este archivo en index.html.
const SUPA_URL = window.BIOMOL_CONFIG.SUPA_URL;
const SUPA_KEY = window.BIOMOL_CONFIG.SUPA_KEY;
const sb = supabase.createClient(SUPA_URL, SUPA_KEY);
