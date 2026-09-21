export const name = "004_idempotency";
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      status INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);
  `);
  
  // Limpa chaves antigas >24h periodicamente via cron? Vamos fazer no startup
  try {
    db.prepare("DELETE FROM idempotency_keys WHERE created_at < ?").run(Date.now() - 24*60*60*1000);
  } catch {}
}
