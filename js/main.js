// ============================================================
// INICIO
// ============================================================
// initSession() puebla el selector de usuarios y, si hay sesión recordada,
// entra directo. verificarEntregaTurno se dispara DESPUÉS del login
// (dentro de entrarAlSistema), porque consulta tablas que exigen sesión.
initSession();
