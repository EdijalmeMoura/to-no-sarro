export const name = "003_split_pay";
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      person_index INTEGER DEFAULT 0,
      person_name TEXT,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
  `);

  const orderCols = db.prepare(`PRAGMA table_info(orders)`).all().map(c=>c.name);
  if (!orderCols.includes("tip_amount")) {
    db.exec(`ALTER TABLE orders ADD COLUMN tip_amount REAL DEFAULT 0`);
  }
  if (!orderCols.includes("tip_percent")) {
    db.exec(`ALTER TABLE orders ADD COLUMN tip_percent REAL DEFAULT 0`);
  }
  if (!orderCols.includes("waiter_name")) {
    db.exec(`ALTER TABLE orders ADD COLUMN waiter_name TEXT`);
  }

  const settings = (k) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value;
  if (settings("loyalty_enabled") === undefined) {
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("loyalty_enabled","0");
  }
  if (settings("loyalty_points_per_real") === undefined) {
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("loyalty_points_per_real","1");
  }
  if (settings("stock_alert_enabled") === undefined) {
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("stock_alert_enabled","1");
  }
}
