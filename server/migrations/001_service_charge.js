export const name = "001_service_charge";
export function up(db) {
  const cols = db.prepare(`PRAGMA table_info(settings)`).all().map(c=>c.name);
  // service charge settings are stored in settings table as key-value, not columns
  // But we need to add columns to orders for service charge tracking
  const orderCols = db.prepare(`PRAGMA table_info(orders)`).all().map(c=>c.name);
  if (!orderCols.includes("service_charge")) {
    db.exec(`ALTER TABLE orders ADD COLUMN service_charge REAL DEFAULT 0`);
  }
  if (!orderCols.includes("service_charge_percent")) {
    db.exec(`ALTER TABLE orders ADD COLUMN service_charge_percent REAL DEFAULT 0`);
  }
  // settings defaults
  const get = (k) => db.prepare("SELECT value FROM settings WHERE key=?").get(k)?.value;
  if (get("service_charge_enabled") === undefined) {
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("service_charge_enabled","0");
  }
  if (get("service_charge_percent") === undefined) {
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING").run("service_charge_percent","10");
  }
}
