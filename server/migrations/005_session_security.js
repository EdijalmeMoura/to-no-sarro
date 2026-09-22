export const name = "005_session_security";
export function up(db) {
  // Adiciona colunas para rotação segura de sessão
  const cols = db.prepare(`PRAGMA table_info(sessions)`).all().map(c=>c.name);
  if (!cols.includes("previous_token")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN previous_token TEXT`);
  }
  if (!cols.includes("rotated_at")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN rotated_at INTEGER`);
  }
  if (!cols.includes("ip")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN ip TEXT`);
  }
  if (!cols.includes("user_agent")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN user_agent TEXT`);
  }
}
