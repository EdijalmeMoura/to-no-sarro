# Ferramentas de tradução (`tools/i18n`)

Ferramentas próprias para traduzir sistemas entregues **só com o build**
(caso do WhatsCRM comprado na CodeCanyon) — sem os fontes do front-end.

## `extrair-strings.mjs`

Varre arquivos `.js/.jsx/.html` (compilados ou não) e separa tudo em quatro
baldes, para não traduzir o que é **identificador** por engano:

| Balde | O que é | Vai para a tradução? |
|---|---|---|
| **texto** | rótulo, botão, mensagem, frase de tela | ✅ sim |
| **chave** | chave de i18n (`inbox.title`) | ❌ só o valor dela no dicionário |
| **duvidoso** | não deu para cravar | 🔎 revisão manual |
| **estilo** | classe CSS/Tailwind, valor de estilo | ❌ registrado por auditoria |

```bash
# inventário do sistema comprado
node tools/i18n/extrair-strings.mjs whatscrm/frontend/build/ --out traducao/strings

# marcar o que já foi traduzido (retoma o trabalho sem repetir)
node tools/i18n/extrair-strings.mjs whatscrm/ --ja-traduzido traducao/pt-BR.json
```

Saídas em `--out`:

- `strings.csv` — planilha `texto_en, traducao_pt_br, status, ocorrencias, placeholders, arquivos`
- `strings.json` — dados completos (inclui os baldes "duvidosos" e "estilo")
- `chaves.json` — chaves de i18n detectadas, para casar com o dicionário do sistema
- `relatorio.md` — resumo com cobertura e tabelas

### Teste rápido

```bash
node tools/i18n/extrair-strings.mjs tools/i18n/exemplos
# esperado: 12 textos, 3 chaves de i18n, 1 duvidoso, 2 descartados como estilo
```

O fixture `exemplos/bundle-exemplo.js` mistura texto de tela com ruído real
(hex de cor, URL da Graph API, `SUBSCRIPTION_ACTIVE`, `flex items-center`,
`./assets/logo-8f2a.png`, `phone_number_id`) justamente para provar que o
extrator não cai nessas armadilhas.
