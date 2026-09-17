#!/usr/bin/env node
/**
 * extrair-strings.mjs — minera textos de interface para tradução.
 *
 * Serve para sistemas entregues SOMENTE com o build (JS/HTML minificado), caso
 * típico dos scripts da CodeCanyon: sem os fontes do front, o jeito de saber
 * exatamente o que precisa ser traduzido é varrer os arquivos compilados.
 *
 * Uso:
 *   node tools/i18n/extrair-strings.mjs <arquivo|pasta> [...] [opções]
 *
 * Opções:
 *   --out <pasta>         destino dos arquivos gerados (padrão: traducao/strings)
 *   --min <n>             tamanho mínimo do texto          (padrão: 2)
 *   --max <n>             tamanho máximo do texto          (padrão: 200)
 *   --ext <lista>         extensões varridas  (padrão: js,mjs,cjs,jsx,ts,tsx,html,htm)
 *   --ignorar <lista>     trechos ignorados no caminho (padrão: node_modules,.min.,chunk-vendors,map)
 *   --ja-traduzido <arq>  JSON { "English": "Português" } p/ marcar o que já tem tradução
 *   --limite <n>          linhas nas tabelas do relatório (padrão: 80)
 *
 * Saídas em <out>:
 *   strings.json   — dados completos (texto, ocorrências, arquivos, placeholders)
 *   strings.csv    — planilha pronta p/ tradução (texto_en, traducao_pt_br, ...)
 *   chaves.json    — chaves de i18n detectadas (ex.: "inbox.title"), sem tradução
 *   relatorio.md   — resumo: cobertura estimada, top textos, duvidosos (revisar)
 */

import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ opções */

const argv = process.argv.slice(2);
const opt = {
  out: 'traducao/strings',
  min: 2,
  max: 200,
  ext: 'js,mjs,cjs,jsx,ts,tsx,html,htm',
  ignorar: 'node_modules,.min.,chunk-vendors,.map,dist/',
  jaTraduzido: null,
  limite: 80,
};
const entradas = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const proximo = () => argv[++i];
  if (a === '--out') opt.out = proximo();
  else if (a === '--min') opt.min = Number(proximo());
  else if (a === '--max') opt.max = Number(proximo());
  else if (a === '--ext') opt.ext = proximo();
  else if (a === '--ignorar') opt.ignorar = proximo();
  else if (a === '--ja-traduzido') opt.jaTraduzido = proximo();
  else if (a === '--limite') opt.limite = Number(proximo());
  else if (a === '-h' || a === '--help') {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
    process.exit(0);
  } else if (a.startsWith('--')) {
    console.error(`Opção desconhecida: ${a}`);
    process.exit(1);
  } else entradas.push(a);
}

if (!entradas.length) {
  console.error('Informe ao menos um arquivo ou pasta. Ex.:');
  console.error('  node tools/i18n/extrair-strings.mjs whatscrm/frontend/build/');
  process.exit(1);
}

const EXT = new Set(opt.ext.split(',').map((e) => '.' + e.trim().replace(/^\./, '').toLowerCase()));
const IGNORAR = opt.ignorar.split(',').map((s) => s.trim()).filter(Boolean);
const jaTraduzido = opt.jaTraduzido
  ? JSON.parse(fs.readFileSync(opt.jaTraduzido, 'utf8'))
  : {};

/* ------------------------------------------------------- coleta dos arquivos */

const arquivos = [];
function varrer(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) {
    console.error(`Aviso: caminho inexistente — ${p}`);
    return;
  }
  const st = fs.statSync(abs);
  if (st.isFile()) {
    if (EXT.has(path.extname(abs).toLowerCase())) arquivos.push(abs);
    return;
  }
  for (const d of fs.readdirSync(abs, { withFileTypes: true })) {
    const full = path.join(abs, d.name);
    const rel = full.replace(/\\/g, '/');
    if (IGNORAR.some((t) => t && rel.includes(t))) continue;
    if (d.isDirectory()) varrer(full);
    else if (EXT.has(path.extname(d.name).toLowerCase())) arquivos.push(full);
  }
}
entradas.forEach(varrer);

if (!arquivos.length) {
  console.error('Nenhum arquivo compatível encontrado com as extensões: ' + [...EXT].join(', '));
  process.exit(1);
}

/* --------------------------------------------------------------- heurísticas */

// Ruído técnico que nunca é texto de tela.
const RUIDO = [
  /^https?:\/\//i,
  /^\/\//,
  /^www\./i,
  /^mailto:/i,
  /^tel:/i,
  /^data:/i,
  /^#([0-9a-f]{3,8})$/i,
  /^rgba?\(/i,
  /^hsla?\(/i,
  /^var\(--/i,
  /^\d+(\.\d+)?(px|rem|em|%|ms|s|vh|vw|fr|deg|ch|pt)?$/i,
  /^[{}[\]()<>.,;:'"`~!@#$%^&*_+=|\\/…—–-]+$/, // só pontuação/símbolos
  /^[A-Z0-9_]{2,}$/, // CONSTANTE / valor de enum enviado à API
  /^\$\{.*\}$/,
  /^[a-f0-9]{16,}$/i,
  /^\/[\w\-./[\]]*$/, // rotas e caminhos (/api/settings, /admin/login)
  /^\d+-[a-z]+$/, // valores técnicos (2-digit, 24-hour em contexto de opção)
  /^[\w-]+\.(json|js|mjs|cjs|css|png|jpe?g|svg|webp|gif|ico|woff2?|ttf|html?)$/i, // nomes de arquivo
];

// Código minificado que "parece" texto.
const CODIGO = /[{};]|=>|\|\||&&|===|!==|\breturn\b|\btypeof\b|\bvar\b|\blet\b|\bconst\b|\bfunction\b|\bundefined\b|\bnull\b|\.length\b|\bwindow\.|\bdocument\.|\brequire\(|\bimport\s/;

function decodificarEscapes(s) {
  return s
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\(['"`\\/])/g, '$1');
}

function normalizar(s) {
  return decodificarEscapes(s)
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Palavras típicas de CSS/estilo — usadas só para decidir se uma string com
// interpolação `${...}` é texto de tela ou pedaço de código (ex.: "1px solid ${cor}").
const PALAVRAS_ESTILO = new RegExp(
  '\\b(px|rem|em|vh|vw|fr|deg|ms|solid|dashed|dotted|none|auto|inherit|initial|unset|' +
    'important|rgba?|hsla?|var|calc|url|linear-gradient|radial-gradient|translate|translateX|' +
    'translateY|scale|rotate|skew|cubic-bezier|ease|ease-in|ease-out|ease-in-out|opacity|' +
    'z-index|border|border-radius|margin|padding|display|flex|grid|inline|block|absolute|' +
    'relative|fixed|sticky|static|hidden|visible|centre|center|font|bold|italic|uppercase|' +
    'lowercase|nowrap)\\b',
  'gi'
);

function placeholdersDe(s) {
  const achados = [
    ...(s.match(/\{\{\s*[\w.]+\s*\}\}/g) || []),
    ...(s.match(/\{[0-9]+\}/g) || []),
    ...(s.match(/%[sd]/g) || []),
    ...(s.match(/\$\{[\w.]+\}/g) || []),
  ];
  return [...new Set(achados)];
}

/** Palpite: é chave de i18n (ex.: "inbox.title", "form.errors.required")? */
function ehChaveDeI18n(s) {
  return /^[a-z][\w-]*(\.[\w-]+){1,5}$/.test(s) && s.length <= 60 && !/\s/.test(s);
}

/** Veredito: 'texto' | 'chave' | 'ruido' | 'duvidoso' */
function classificar(bruto) {
  const s = normalizar(bruto);
  if (!s) return 'ruido';
  if (s.length < opt.min || s.length > opt.max) return 'ruido';
  if (RUIDO.some((r) => r.test(s))) return 'ruido';
  if (ehChaveDeI18n(s)) return 'chave';

  // placeholders (`{{nome}}`, `{0}`, `%s`, `${x}`) são legítimos em texto de tela:
  // saem da checagem de "código" para não derrubar a frase inteira.
  const sChk = s
    .replace(/\{\{\s*[\w.]+\s*\}\}/g, 'X')
    .replace(/\{[0-9]+\}/g, 'X')
    .replace(/%[sd]/g, 'X')
    .replace(/\$\{[\w.]+\}/g, 'X');

  const letras = (s.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  if (letras < 2) return 'ruido';
  if (letras / s.length < 0.4) return 'ruido';
  if (CODIGO.test(sChk)) return 'ruido';

  // Interpolação de template (`${...}`) quase sempre é código. Só passa se,
  // removendo-se os valores interpolados, sobrar frase de verdade (≥3 palavras).
  if (/\$\{/.test(s)) {
    const semInterp = s
      .replace(/\$\{[\w.]+\}/g, ' ')
      .replace(/\b\d+(\.\d+)?\b/g, ' ')
      .replace(PALAVRAS_ESTILO, ' ')
      .replace(/[[\](){}#.,:;%/\\-]/g, ' ');
    const palavras = semInterp.split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ]{2,}$/.test(w));
    if (palavras.length < 3) return 'ruido';
  }

  if (/\.[a-z]{2,5}$/i.test(s) && !/\s/.test(s) && /\/|\\/.test(s)) return 'ruido'; // caminho de arquivo
  if (/\/(src|assets|static|media|public|js|css|img|fonts|build)\//.test(s)) return 'ruido';
  if (/^[\w.+-]+\/[\w.+-]+$/.test(s) && !/\s/.test(s)) return 'ruido'; // mime type
  if (/^(true|false|null|undefined|nan|infinity)$/i.test(s)) return 'ruido';

  if (!/\s/.test(s)) {
    // token único: aceita só se parece rótulo (Capitalizado) ou vier com pontuação de frase
    if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return 'ruido'; // camelCase
    if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(s)) return 'ruido'; // kebab-case (classe CSS)
    if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(s)) return 'ruido'; // snake_case
    if (/^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/.test(s)) return 'ruido'; // dot.case
    if (sChk.length < 3) return 'ruido';
    if (!/^[A-ZÀ-Ý][\w'’-]*[.!?…:]*$/.test(sChk)) return 'duvidoso'; // minúscula solta → revisar
    return 'texto';
  }

  // Com espaço: descarta listas de classes utilitárias (Tailwind) e afins
  const tokens = s.split(' ');
  const soClasses = tokens.length >= 2 && tokens.every((t) => /^[a-z0-9:./[\]%_-]+$/.test(t));
  if (soClasses && tokens.length >= 3 && s.length < 90) return 'estilo'; // classes CSS/Tailwind
  if (soClasses && s.length < 70) return 'duvidoso';
  if (/^[a-z-]+:[^:]{0,40}$/.test(s)) return 'ruido'; // "background: red" / pseudo-seletor
  if (/^[\w.+-]+:[\w.+-]+$/.test(s)) return 'ruido';
  if (/^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/.test(s)) return 'ruido';

  return 'texto';
}

/* ------------------------------------------------------------------ extração */

const RE_STRING = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g; // literais curtos (sem quebra de linha)
const RE_TEXTO_HTML = />([^<>{}]{2,200})</g;

const textos = new Map(); // texto -> { ocorrencias, arquivos:Set, placeholders }
const chaves = new Map();
const duvidosos = new Map();
const estilos = new Map(); // classes CSS/Tailwind etc. (descartadas, mas registradas)
let bytes = 0;
let candidatosBrutos = 0;

const registrar = (mapa, texto, arquivo, manterSet = false) => {
  const atual = mapa.get(texto);
  if (atual) {
    atual.ocorrencias++;
    if (manterSet) atual.arquivos.add(arquivo);
  } else {
    mapa.set(texto, {
      ocorrencias: 1,
      arquivos: manterSet ? new Set([arquivo]) : new Set([arquivo]),
    });
  }
};

for (const arquivo of arquivos) {
  const conteudo = fs.readFileSync(arquivo, 'utf8');
  bytes += Buffer.byteLength(conteudo);
  const rel = path.relative(process.cwd(), arquivo).replace(/\\/g, '/');

  const acharTodos = (regex) => {
    for (const m of conteudo.matchAll(regex)) {
      const vaiCasar = regex === RE_TEXTO_HTML ? m[1] : m[2];
      candidatosBrutos++;
      const veredito = classificar(vaiCasar);
      if (veredito === 'texto') {
        const s = normalizar(vaiCasar);
        registrar(textos, s, rel);
        const p = placeholdersDe(s);
        if (p.length) textos.get(s).placeholders = p;
      } else if (veredito === 'chave') {
        registrar(chaves, normalizar(vaiCasar), rel);
      } else if (veredito === 'duvidoso') {
        registrar(duvidosos, normalizar(vaiCasar), rel);
      } else if (veredito === 'estilo') {
        registrar(estilos, normalizar(vaiCasar), rel);
      }
    }
  };

  acharTodos(RE_STRING);
  if (/\.html?$/i.test(arquivo)) acharTodos(RE_TEXTO_HTML);
}

/* ------------------------------------------------------------------ ordenação */

const porOcorrencia = (a, b) => b[1].ocorrencias - a[1].ocorrencias || b[0].length - a[0].length;
const listaTextos = [...textos.entries()].sort(porOcorrencia);
const listaChaves = [...chaves.entries()].sort(porOcorrencia);
const listaDuvidosos = [...duvidosos.entries()].sort(porOcorrencia);
const listaEstilos = [...estilos.entries()].sort(porOcorrencia);

const jaTraduzidas = listaTextos.filter(([t]) => jaTraduzido[t] || jaTraduzido[t.replace(/\s+/g, ' ')]);
const pendentes = listaTextos.filter(([t]) => !(jaTraduzido[t] || jaTraduzido[t.replace(/\s+/g, ' ')]));

/* -------------------------------------------------------------------- saídas */

const outDir = path.resolve(opt.out);
fs.mkdirSync(outDir, { recursive: true });

const dados = {
  geradoEm: new Date().toISOString(),
  arquivosVarridos: arquivos.length,
  megabytesVarridos: +(bytes / 1024 / 1024).toFixed(1),
  candidatosBrutos,
  textosUnicos: listaTextos.length,
  ocorrenciasDeTexto: listaTextos.reduce((s, [, v]) => s + v.ocorrencias, 0),
  chavesDeI18nUnicas: listaChaves.length,
  duvidosos: listaDuvidosos.length,
  descartadosComoEstilo: listaEstilos.length,
  exemplosDescartadosComoEstilo: listaEstilos.slice(0, 40).map(([texto, v]) => ({ texto, ocorrencias: v.ocorrencias })),
  textos: listaTextos.map(([texto, v]) => ({
    texto,
    ocorrencias: v.ocorrencias,
    placeholders: v.placeholders || [],
    arquivos: [...v.arquivos].slice(0, 3),
  })),
  chaves: listaChaves.map(([chave, v]) => ({ chave, ocorrencias: v.ocorrencias })),
};
fs.writeFileSync(path.join(outDir, 'strings.json'), JSON.stringify(dados, null, 2));
fs.writeFileSync(
  path.join(outDir, 'chaves.json'),
  JSON.stringify(dados.chaves, null, 2)
);

// CSV: uma linha por texto, com colunas vazias para a tradução
const csvCampo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = [
  ['texto_en', 'traducao_pt_br', 'status', 'ocorrencias', 'placeholders', 'arquivos'].join(','),
  ...listaTextos.map(([texto, v]) =>
    [
      csvCampo(texto),
      csvCampo(jaTraduzido[texto] || ''),
      csvCampo(jaTraduzido[texto] ? 'traduzido' : 'pendente'),
      v.ocorrencias,
      csvCampo((v.placeholders || []).join(' ')),
      csvCampo([...v.arquivos].slice(0, 3).join(' | ')),
    ].join(',')
  ),
].join('\n');
fs.writeFileSync(path.join(outDir, 'strings.csv'), csv);

const tabela = (itens, valor) =>
  itens
    .slice(0, opt.limite)
    .map(([k, v]) => `| ${v.ocorrencias} | ${String(valor(k, v)).replace(/\|/g, '\\|')} |`)
    .join('\n');

const relatorio = `# Relatório de extração de textos — base para a tradução pt-BR

Gerado em ${new Date().toLocaleString('pt-BR')} por \`tools/i18n/extrair-strings.mjs\`.

## Resumo

| Métrica | Valor |
|---|---|
| Arquivos varridos | ${arquivos.length} (${(bytes / 1024 / 1024).toFixed(1)} MB) |
| Literais inspecionados | ${candidatosBrutos} |
| **Textos únicos de interface** | **${listaTextos.length}** |
| Ocorrências de texto | ${dados.ocorrenciasDeTexto} |
| Já traduzidos (dicionário informado) | ${jaTraduzidas.length} |
| **Pendentes de tradução** | **${pendentes.length}** |
| Chaves de i18n detectadas | ${listaChaves.length} |
| Duvidosos (revisar à mão) | ${listaDuvidosos.length} |
| Descartados como estilo/CSS (listados em \`strings.json\`) | ${listaEstilos.length} |

> Os "duvidosos" estão em \`strings.json\`/\`relatorio.md\` de propósito: são
> candidatos que as regras não cravaram como texto de tela. Nada é descartado
> em silêncio — o que não entra na tradução fica registrado para revisão.

## Top ${opt.limite} textos por ocorrência

| Vezes | Texto |
|---:|---|
${tabela(listaTextos, (k) => k)}

## Chaves de i18n detectadas (não traduzir a chave; traduzir o valor no dicionário)

| Vezes | Chave |
|---:|---|
${tabela(listaChaves, (k) => '`' + k + '`')}

## Duvidosos — revisar

| Vezes | Candidato |
|---:|---|
${tabela(listaDuvidosos, (k) => k)}

## Descartados como estilo/CSS — conferência

Não são texto de tela (classes utilitárias, valores de CSS). Ficam registrados
para auditoria: se algum dia um texto real cair aqui, é só ajustar as regras.

| Vezes | Descartado |
|---:|---|
${tabela(listaEstilos, (k) => k)}
`;
fs.writeFileSync(path.join(outDir, 'relatorio.md'), relatorio);

console.log(`✔ Extração concluída
  arquivos varridos .......... ${arquivos.length} (${(bytes / 1024 / 1024).toFixed(1)} MB)
  textos únicos .............. ${listaTextos.length} (${dados.ocorrenciasDeTexto} ocorrências)
  pendentes de tradução ...... ${pendentes.length}
  chaves de i18n ............. ${listaChaves.length}
  duvidosos (revisar) ........ ${listaDuvidosos.length}
  descartados como estilo .... ${listaEstilos.length}

  arquivos em ${path.relative(process.cwd(), outDir) || '.'}/
    strings.csv    → planilha para tradução
    strings.json   → dados completos
    chaves.json    → chaves de i18n
    relatorio.md   → resumo`);
