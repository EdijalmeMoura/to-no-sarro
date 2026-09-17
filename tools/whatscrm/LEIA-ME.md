# Ferramentas para o pacote do WhatsCRM (`tools/whatscrm`)

## `preparar.mjs`

Recebe o pacote comprado (**ZIP** ou pasta já extraída) e entrega o inventário
inicial da tradução — sem nenhuma dependência externa (usa só Node + `python3`,
que já existe no ambiente).

```bash
# 1) a partir do ZIP (extrai para whatscrm/, que está no .gitignore)
node tools/whatscrm/preparar.mjs --zip ~/Downloads/whatscrm.zip

# 2) ou de uma pasta já extraída
node tools/whatscrm/preparar.mjs --pasta /caminho/whatscrm/
```

O que ele faz, em ordem:

1. **extrai** o ZIP para `--dest` (padrão `whatscrm/`);
2. acha a **raiz real** do pacote (quando o ZIP vem com uma pasta única dentro);
3. **mapeia a estrutura**: nº de arquivos, tamanho, tipos de arquivo, 10 maiores;
4. procura o **dicionário de idioma** (JSON com pares chave→texto, inclusive
   dentro de objetos aninhados) e conta as chaves;
5. localiza **SQL** e o **build do front-end**;
6. roda o extrator (`tools/i18n/extrair-strings.mjs`) nas pastas de build,
   **sem varredura dupla** (`build/` + `build/assets/` contariam o texto 2×);
7. imprime e salva `traducao/strings/inventario-pacote.md`.

Saídas: `traducao/strings/inventario-pacote.md`, `strings.csv`,
`strings.json`, `chaves.json`, `relatorio.md`.

## Ensaio já realizado

Testado com um pacote sintético no formato do WhatsCRM (`frontend/build`,
`backend/languages/en.json`, SQL, documentação). Resultado:

- versão detectada pelo `backend/package.json` → `v6.1.0`;
- dicionário localizado e contado → **62 chaves**;
- build varrido → **11 textos de tela**, 2 chaves de i18n, 0 duvidosos e
  2 ruídos descartados (classe utilitária e valor de CSS).

Ou seja: o caminho está validado — falta apenas o pacote real.
