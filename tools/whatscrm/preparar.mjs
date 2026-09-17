#!/usr/bin/env node
/**
 * preparar.mjs — recebe o pacote comprado do WhatsCRM (ZIP ou pasta), organiza o
 * terreno e produz o inventário inicial da tradução.
 *
 * Uso:
 *   node tools/whatscrm/preparar.mjs --zip ~/Downloads/whatscrm.zip
 *   node tools/whatscrm/preparar.mjs --pasta whatscrm/
 *
 * O que ele faz:
 *   1. extrai o ZIP (via python3, sem dependências) para --dest
 *   2. mapeia a estrutura: pastas, tipos de arquivo, maiores arquivos
 *   3. procura o dicionário de idioma (JSON/SQL com pares chave→texto)
 *   4. identifica o build do front-end e roda o extrator de strings
 *   5. imprime o resumo com os próximos passos
 *
 * Nada do código de terceiros é versionado: --dest fica no .gitignore.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/* ------------------------------------------------------------------ opções */

const argv = process.argv.slice(2);
const opt = { zip: null, pasta: null, dest: 'whatscrm', out: 'traducao/strings' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const prox = () => argv[++i];
  if (a === '--zip') opt.zip = prox();
  else if (a === '--pasta') opt.pasta = prox();
  else if (a === '--dest') opt.dest = prox();
  else if (a === '--out') opt.out = prox();
  else {
    console.error(`Opção desconhecida: ${a}`);
    process.exit(1);
  }
}
if (!opt.zip && !opt.pasta) {
  console.error('Informe --zip <arquivo.zip> ou --pasta <diretório>.');
  process.exit(1);
}

const raiz = process.cwd();
const dest = path.resolve(opt.dest);

/* ----------------------------------------------------------------- extração */

function extrairZip(zip, destino) {
  fs.mkdirSync(destino, { recursive: true });
  const py = `
import sys, zipfile, os
zip_path, destino = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as z:
    nomes = z.namelist()
    z.extractall(destino)
print(len(nomes))
`;
  const r = spawnSync('python3', ['-c', py, path.resolve(zip), destino], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error('Falha ao extrair o ZIP. Detalhe:\n' + (r.stderr || r.error));
    console.error('Alternativa: extraia manualmente e use --pasta <diretório>.');
    process.exit(1);
  }
  return Number(r.stdout.trim());
}

let avisoZip = null;
if (opt.zip) {
  if (!fs.existsSync(opt.zip)) {
    console.error(`ZIP não encontrado: ${opt.zip}`);
    process.exit(1);
  }
  const mb = (fs.statSync(opt.zip).size / 1024 / 1024).toFixed(1);
  const n = extrairZip(opt.zip, dest);
  avisoZip = `${path.basename(opt.zip)} (${mb} MB) → ${n} entradas extraídas em ${opt.dest}/`;
} else {
  const orig = path.resolve(opt.pasta);
  if (!fs.existsSync(orig)) {
    console.error(`Pasta não encontrada: ${opt.pasta}`);
    process.exit(1);
  }
}

/* --------------------------------------------- raiz real (pasta única interna) */

function raizEfetiva(p) {
  const filhos = fs.readdirSync(p, { withFileTypes: true });
  const dirs = filhos.filter((f) => f.isDirectory());
  const arquivos = filhos.filter((f) => f.isFile());
  if (arquivos.length === 0 && dirs.length === 1) return path.join(p, dirs[0].name);
  return p;
}
let base = opt.pasta ? path.resolve(opt.pasta) : dest;
base = raizEfetiva(base);

/* ------------------------------------------------------------------ inventário */

const IGNORAR = ['node_modules', '.git', '__MACOSX'];
const porExt = new Map();
const candidatosIdioma = [];
const sqls = [];
const builds = [];
const maiores = [];
let arquivos = 0;
let bytes = 0;

function extensao(nome) {
  const e = path.extname(nome).toLowerCase() || '(sem extensão)';
  return e;
}

function varrer(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.includes(d.name)) continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      varrer(full);
      continue;
    }
    const st = fs.statSync(full);
    arquivos++;
    bytes += st.size;
    const rel = path.relative(base, full).replace(/\\/g, '/');
    const ext = extensao(d.name);
    porExt.set(ext, (porExt.get(ext) || 0) + 1);
    maiores.push({ rel, tamanho: st.size });

    if (/\.sql$/i.test(d.name)) sqls.push(rel);
    if (/\.json$/i.test(d.name) && st.size < 5 * 1024 * 1024) candidatosIdioma.push({ rel, tamanho: st.size });
    if (/\.(js|html)$/i.test(d.name) && /[\\/](build|dist|out|assets)[\\/]/i.test(full)) {
      builds.push(rel);
    }
  }
}
varrer(base);

maiores.sort((a, b) => b.tamanho - a.tamanho);

/* ------------------------------------------- dicionário de idioma: diagnóstico */

const idiomas = [];
for (const c of candidatosIdioma) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(path.join(base, c.rel), 'utf8'));
  } catch {
    continue;
  }
  const ehMapaDeTexto = (o) =>
    o && typeof o === 'object' && !Array.isArray(o) &&
    Object.values(o).slice(0, 30).every((v) => typeof v === 'string');
  if (ehMapaDeTexto(json)) {
    const chaves = Object.keys(json);
    const amostra = chaves.slice(0, 4).map((k) => `"${k}": "${String(json[k]).slice(0, 40)}"`);
    idiomas.push({ rel: c.rel, chaves: chaves.length, amostra });
  } else if (json && typeof json === 'object') {
    for (const [k, v] of Object.entries(json)) {
      if (ehMapaDeTexto(v) && Object.keys(v).length > 20) {
        idiomas.push({
          rel: `${c.rel} → "${k}"`,
          chaves: Object.keys(v).length,
          amostra: Object.keys(v).slice(0, 4).map((kk) => `"${kk}": "${String(v[kk]).slice(0, 40)}"`),
        });
      }
    }
  }
}

/* ---------------------------------------------------- versão do sistema */

let versao = null;
for (const p of ['backend/package.json', 'package.json', 'server/package.json']) {
  const full = path.join(base, p);
  if (fs.existsSync(full)) {
    try {
      const j = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (j.version) {
        versao = `${j.name || 'app'} v${j.version} (${p})`;
        break;
      }
    } catch {}
  }
}

/* --------------------------------------------------- extração de strings */

let extracao = null;
// se `build/` e `build/assets/` entrarem juntas, o mesmo texto é contado duas vezes:
// mantém só as pastas mais externas.
const todasBuilds = [...new Set(builds.map((b) => path.dirname(toAbs(b))))].sort(
  (a, b) => a.length - b.length
);
const dirsBuild = todasBuilds.filter(
  (d) => !todasBuilds.some((outro) => outro !== d && d.startsWith(outro + path.sep))
);
if (dirsBuild.length) {
  const extrator = path.resolve('tools/i18n/extrair-strings.mjs');
  const r = spawnSync(
    process.execPath,
    [extrator, ...dirsBuild.map((d) => caminhoCurto(d)), '--out', opt.out],
    { encoding: 'utf8' }
  );
  extracao = {
    dirs: dirsBuild.map((d) => caminhoCurto(d)),
    saida: (r.stdout || '').trim(),
    erro: r.stderr?.trim(),
  };
}
function toAbs(rel) {
  return path.join(base, rel);
}
/** Caminho relativo quando está dentro do projeto; absoluto quando está fora. */
function caminhoCurto(abs) {
  const rel = path.relative(raiz, abs);
  return rel.startsWith('..') ? abs : rel;
}

/* -------------------------------------------------------------------- resumo */

const mb = (bytes / 1024 / 1024).toFixed(1);
const linhas = [];
linhas.push('# Inventário do pacote recebido');
linhas.push('');
linhas.push(`- Raiz analisada: \`${caminhoCurto(base) || '.'}\``);
if (avisoZip) linhas.push(`- Origem: ${avisoZip}`);
linhas.push(`- Versão detectada: ${versao || 'não identificada (conferir changelog/documentação)'}`);
linhas.push(`- Arquivos: **${arquivos}** (${mb} MB)`);
linhas.push('');
linhas.push('## Tipos de arquivo');
linhas.push('');
linhas.push('| Extensão | Arquivos |');
linhas.push('|---|---:|');
for (const [e, n] of [...porExt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
  linhas.push(`| \`${e}\` | ${n} |`);
}
linhas.push('');
linhas.push('## Maiores arquivos (o build do front fica aqui)');
linhas.push('');
linhas.push('| Arquivo | Tamanho |');
linhas.push('|---|---:|');
for (const m of maiores.slice(0, 10)) linhas.push(`| \`${m.rel}\` | ${(m.tamanho / 1024).toFixed(0)} KB |`);
linhas.push('');
linhas.push('## Dicionário(s) de idioma encontrado(s)');
linhas.push('');
if (idiomas.length) {
  for (const i of idiomas) {
    linhas.push(`- \`${i.rel}\` — **${i.chaves} chaves**`);
    linhas.push(`  - amostra: ${i.amostra.join(' · ')}`);
  }
} else {
  linhas.push('- nenhum JSON com pares chave→texto ainda identificado (pode estar no SQL ou embutido no bundle)');
}
linhas.push('');
linhas.push('## SQL / banco');
linhas.push('');
linhas.push(sqls.length ? sqls.slice(0, 12).map((s) => `- \`${s}\``).join('\n') : '- nenhum arquivo .sql');
linhas.push('');
linhas.push('## Build do front-end e extração de strings');
linhas.push('');
if (extracao) {
  linhas.push('Pastas varridas: ' + extracao.dirs.map((d) => `\`${d}\``).join(', '));
  linhas.push('');
  linhas.push('```');
  linhas.push(extracao.saida || '(sem saída)');
  linhas.push('```');
} else {
  linhas.push('- nenhuma pasta de build detectada (talvez o front venha com fontes ou noutro nome)');
}

const texto = linhas.join('\n');
fs.mkdirSync(opt.out, { recursive: true });
fs.writeFileSync(path.join(opt.out, 'inventario-pacote.md'), texto + '\n');
console.log(texto);
console.log(`\nInventário salvo em ${opt.out}/inventario-pacote.md`);
