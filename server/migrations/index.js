import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER
    );
  `);

  const applied = new Set(db.prepare("SELECT id FROM migrations").all().map(r=>r.id));
  
  const files = fs.readdirSync(__dirname)
    .filter(f => f.match(/^\d+_.*\.js$/) && f !== "index.js")
    .sort();

  for (const file of files) {
    const id = file.replace(".js","");
    if (applied.has(id)) continue;
    console.log(`[migrations] aplicando ${id}...`);
    // dynamic import
    const modPath = path.join(__dirname, file);
    // Use synchronous require via import() not possible sync, so we use fs read and eval? Instead we import migrations manually
    // For simplicity, we will handle known migrations via direct import map
  }
}

// Versão síncrona com imports estáticos para evitar async no startup
import * as m001 from "./001_service_charge.js";
import * as m002 from "./002_geo.js";
import * as m003 from "./003_split_pay.js";
import * as m004 from "./004_idempotency.js";
import * as m005 from "./005_session_security.js";

const MIGRATIONS = [m001, m002, m003, m004, m005];

export function runMigrationsSync(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER
    );
  `);
  const applied = new Set(db.prepare("SELECT id FROM migrations").all().map(r=>r.id));
  for (const m of MIGRATIONS) {
    const id = m.name;
    if (applied.has(id)) continue;
    console.log(`[migrations] aplicando ${id}...`);
    try {
      m.up(db);
      db.prepare("INSERT INTO migrations (id, applied_at) VALUES (?,?)").run(id, Date.now());
      console.log(`[migrations] ${id} OK`);
    } catch (e) {
      console.error(`[migrations] falha em ${id}:`, e);
      throw e;
    }
  }
}
