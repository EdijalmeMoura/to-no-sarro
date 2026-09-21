export const name = "002_geo";
export function up(db) {
  const orderCols = db.prepare(`PRAGMA table_info(orders)`).all().map(c=>c.name);
  if (!orderCols.includes("customer_lat")) {
    db.exec(`ALTER TABLE orders ADD COLUMN customer_lat REAL`);
  }
  if (!orderCols.includes("customer_lng")) {
    db.exec(`ALTER TABLE orders ADD COLUMN customer_lng REAL`);
  }
  if (!orderCols.includes("split_group")) {
    db.exec(`ALTER TABLE orders ADD COLUMN split_group TEXT`);
  }
  if (!orderCols.includes("split_people")) {
    db.exec(`ALTER TABLE orders ADD COLUMN split_people INTEGER DEFAULT 1`);
  }
}
