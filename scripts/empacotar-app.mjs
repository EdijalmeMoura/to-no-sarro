// Empacota o app num único IIFE (não-módulo) para o teste de fumaça
// rodar dentro do jsdom. Usado por `npm run check:paineis`.
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  entryPoints: [path.join(ROOT, "src", "main.jsx")],
  outfile: path.join(ROOT, "dist", "check", "app-iife.js"),
  bundle: true,
  format: "iife",
  jsx: "automatic",
  // No IIFE do jsdom não existe import.meta, então o env do Vite é
  // substituído por um objeto equivalente ao build de produção.
  banner: {
    js: "var __CHECK_ENV__ = { MODE: 'production', PROD: true, DEV: false, BASE_URL: '/', VITE_SENTRY_DSN: '' };",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env": "__CHECK_ENV__",
  },
  logLevel: "error",
});

console.log("  · dist/check/app-iife.js pronto");
