# Traduzir o WhatsCRM para Português do Brasil — plano de trabalho

> **Resposta curta: sim, dá conta — e o sistema foi feito para isso.**
> O WhatsCRM tem gerenciamento de tradução embutido no painel admin
> (*“Full website translation management”* e *“set default application language”*,
> ambos na versão 5.9.5+). O trabalho real é produzir a tradução pt-BR completa,
> de qualidade e **sem quebrar nada**, e cobrir as partes que *não* passam pelo
> dicionário (conteúdo dinâmico no banco e textos presos no bundle compilado).

Documento criado em 2026-09-17 para a sessão de tradução do
**WhatsCRM – Chatbot, Flow Builder, API Access, WhatsApp CRM SAAS System**
(CodeCanyon #51122205, autor `codeyon_itservices`).

---

## 1. O que é o sistema (levantamento)

| Item | Situação |
|---|---|
| Backend | **Node.js** (Express + sessões em MySQL) |
| Banco | **MySQL** |
| Front-end | **React** — entregue na versão **compilada** (build), não os fontes |
| Arquivos do pacote | JavaScript JS, JavaScript JSON, HTML, CSS, **SQL** |
| Superfícies | 1. Landing/site · 2. Painel **Admin** (SaaS white-label) · 3. Painel **Usuário** (cliente do SaaS) · 4. Painel **Atendente** (agent) |
| Idiomas | Dicionário em JSON + gerenciador de tradução no admin + seletor de idioma |
| Extras (vendidos à parte) | IA (OpenAI/Gemini/DeepSeek), WhatsApp QR, Embed Login, Telegram, Instagram, Messenger (grátis), Web Push, Chamadas com IA, app React Native |

**Consequência prática do front vir compilado:** não existe um
`src/i18n/pt-BR.json` do React para editar à mão. A tradução entra por três
camadas, na ordem de preferência abaixo.

---

## 2. As três camadas da tradução

### Camada 1 — Dicionário de idioma do próprio sistema *(caminho oficial)*
O sistema já lê os rótulos de um dicionário (JSON/SQL) e o admin permite criar
um idioma, editar os textos e definir o **idioma padrão da aplicação**.
Aqui eu:
1. localizo o arquivo/tabela de idioma do idioma-base (inglês);
2. clono a estrutura para `pt-BR`, mantendo **as chaves idênticas**;
3. gero os valores em português do Brasil;
4. deixo pronto o arquivo `pt-BR.json` **e** o `INSERT`/seed SQL equivalente,
   para instalar tanto pelo painel quanto direto no banco.

*Cobre:* menus, botões, títulos, tabelas, formulários, mensagens de erro e
sucesso, placeholders, tooltips, estados vazios — ou seja, a maior parte do
sistema.

### Camada 2 — Conteúdo dinâmico (está no banco, não no dicionário)
O próprio painel admin deixa o lojista criar conteúdo: páginas da landing,
planos e preços, depoimentos, FAQ, templates de fluxo (Flow Templates),
notificações, meio de pagamento etc. Isso é **dado**, não interface — precisa de
seed SQL (`INSERT`/`UPDATE`) e/ou preenchimento pelo painel. Entrego os dois.

### Camada 3 — Textos presos no bundle compilado *(rede de segurança)*
Sempre sobra uma parte que o autor deixou *hardcoded* dentro do JS minificado
(telas novas, validações, toasts). Para isso já está pronto neste repositório:

**`tools/i18n/extrair-strings.mjs`** — varre os arquivos compilados e separa:
textos de tela, **chaves de i18n** (que não se traduzem, só o valor) e
"duvidosos" para revisão manual. Testado em `tools/i18n/exemplos/`.

```bash
node tools/i18n/extrair-strings.mjs whatscrm/frontend/build/ --out traducao/strings
# gera: strings.csv (planilha), strings.json, chaves.json, relatorio.md
```

Com o inventário em mãos, aplico a tradução de forma **controlada**: patch com
backup do arquivo original, lista de substituições registrada e script de
reaplicação após atualizações do sistema. Nada de "find & replace" solto.

---

## 3. Etapas

| # | Etapa | O que sai |
|---|---|---|
| 1 | **Inventário** — extrato de 100% dos textos dos 4 painéis + contagem de chaves do dicionário | `relatorio.md` com números reais |
| 2 | **Terminologia travada** — glossário EN→pt-BR (já iniciado em `GLOSSARIO-CRM-PTBR.md`) | consistência em todo o sistema |
| 3 | **Tradução da interface** (camadas 1 e 3) — pt-BR natural, não literal | `pt-BR.json` + patch |
| 4 | **Conteúdo dinâmico e mensagens** (camada 2) — landing, planos, FAQ, depoimentos, e-mails, mensagens automáticas | `seed-pt-br.sql` |
| 5 | **Localização de formato** — R$ 1.234,56 · dd/mm/aaaa · fuso America/Sao_Paulo · DDI +55 · “Pix” nos meios de pagamento | ajustes pontuais |
| 6 | **Montagem do pacote** — arquivos + passo a passo de instalação + como desfazer | pasta `traducao/` documentada |
| 7 | **Verificação** — relatório de cobertura e varredura do que ficou em inglês | `faltando.md` |
| 8 | **Manutenção pós-update** — como reaplicar quando o autor publicar versão nova | `REAPLICAR.md` |

---

## 4. O que eu traduzo e o que eu **não** encosto

**Traduzo:** rótulos, títulos, menus, botões, placeholders, textos de ajuda,
estados vazios, mensagens de erro/sucesso, e-mails, textos da landing, planos,
FAQ, depoimentos.

**Não traduzo (de propósito):**
- **valores de enum/status** que vão e voltam da API e do webhook da Meta
  (`OPEN`, `PENDING`, `delivered`, `read`, `SUBSCRIPTION_ACTIVE`…) — traduzir
  isso quebra o sistema;
- **chaves** de i18n, nomes de campos, slugs e permissões;
- **nomes de nós e de eventos** usados pelo Flow Builder e pelos webhooks;
- **nomes de templates da Meta/WhatsApp** (só o conteúdo é traduzido — o nome
  deve seguir ASCII, sem acento, para não dar problema na aprovação);
- nomes próprios e marcas: WhatsApp, Meta, Facebook, Instagram, Messenger,
  Telegram, Pix, Google Sheets/Drive/Calendar, Kanban, Webhook.

Esse é o erro nº 1 em tradução de SaaS: traduzir o que é **identificador** e
achar que é **rótulo**. O extrator separa esses dois mundos justamente por isso.

---

## 5. Além da tradução: localização de verdade

| Ponto | Ajuste |
|---|---|
| Moeda | R$ com vírgula decimal e ponto de milhar |
| Data/hora | `dd/mm/aaaa`, 24h, fuso `America/Sao_Paulo` |
| Telefone | máscara e DDI **+55**, 9º dígito |
| Documentos | CPF/CNPJ no lugar de VAT/GST |
| Pagamentos | destaque para **Pix**; cartão até 12x |
| Textos | “Sacola/Carrinho”, “Entregar/Sedex”, “Boleto”, “NF-e” quando fizer sentido |
| Layout | pt-BR é ~20–30% mais longo que inglês: confiro botões/abas e ajusto o CSS quando estourar |

---

## 6. Entregáveis

```
traducao/
  pt-BR.json            dicionário do sistema (importável pelo admin)
  seed-pt-br.sql        conteúdo dinâmico do banco
  patch-bundle.md       textos aplicados no build compilado + backup
  GLOSSARIO.md          terminologia travada
  FALTANDO.md           o que ficou em inglês e por quê
  COMO-INSTALAR.md      passo a passo (painel e banco)
  REAPLICAR.md          reaplicar depois de atualizar o sistema
tools/i18n/
  extrair-strings.mjs   extrator de textos (já pronto neste repositório)
  aplicar-traducao.mjs  aplicador com backup e log (etapa 5)
```

---

## 7. Como eu testo (e o limite honesto deste ambiente)

**Dá para fazer aqui:** extração e inventário completos, checagem automática de
cobertura (chaves em falta, textos repetidos, placeholders preservados),
renderização do app em DOM headless (`jsdom`) com dados falsos para conferir
rótulos, e revisão de que nenhum valor técnico foi traduzido por engano.

**Não dá para fazer aqui:** subir o sistema de verdade — este sandbox **não tem
MySQL nem Docker** e só acessa o registro npm. Então o teste integrado final
(login, inbox, fluxo, disparo) é feito por você na sua hospedagem; eu preparo
um **checklist de conferência tela por tela** para isso.

---

## 8. Riscos e cuidados

1. **Atualização do autor sobrescreve o build.** O dicionário e o seed
   sobrevivem a updates; o patch no bundle não. Por isso a camada 1 (dicionário)
   é sempre prioridade e a camada 3 vem acompanhada de script de reaplicação.
2. **Licença Envato.** Modificar para uso próprio é permitido; **redistribuir o
   código do sistema não é**. Este repositório é público/versionado — portanto o
   código comprado **não** deve ser commitado aqui (só a nossa tradução e os
   patches). Uso cobrando de usuários finais (SaaS aberto ao público) exige
   **licença Extended ($189)**, não a Regular ($69).
3. **Overlay de tradução no DOM** (trocar texto em tempo de execução) é o último
   recurso: pode mexer em mensagem digitada pelo usuário ou em dado de contato.
   Se for usado, é com escopo restrito e lista fechada de textos.
4. **Add-ons** (IA, QR, Telegram, Instagram, Messenger, Web Push, Chamadas) têm
   dicionário próprio — se você tiver algum, mando traduzido junto; se comprar
   depois, eu completo.

---

## 9. O que eu preciso de você

1. **Os arquivos do sistema** (o ZIP comprado) — por upload no repositório
   `EdijalmeMoura/WhatsCRM` (me avise quando estiver lá) **ou** anexados aqui no
   chat. Requisitos: vir o **backend Node**, o **build do front** e os arquivos
   **JSON/SQL de idioma**.
   > ⚠️ **O repositório está público.** Código com licença Envato não pode ser
   > redistribuído — deixe-o **privado** antes de subir o ZIP.
2. Saber **qual versão** (6.1.0? 5.x?) e **se você tem add-ons**.
3. Decidir: **só pt-BR** ou **pt-BR + inglês** com seletor de idioma.
4. Decidir se entra **só a interface** ou **também** conteúdo dinâmico
   (landing, planos, FAQ), e-mails e mensagens automáticas.

### Situação em 2026-09-17

| Item | Estado |
|---|---|
| Levantamento do sistema (stack, painéis, versões, recursos) | ✅ feito |
| Glossário de terminologia EN→pt-BR | ✅ travado |
| Extrator de strings (fixture + app real) | ✅ testado |
| Pipeline de recebimento do pacote | ✅ testado com pacote sintético (versão, dicionário, build, SQL) |
| Repositório `EdijalmeMoura/WhatsCRM` | ⚠️ existe, **vazio** e **público** — falta o ZIP |
| Tradução pt-BR | ⏳ aguardando o pacote |

Onde as coisas ficam (importante para não misturar licença com trabalho nosso):

- **Código comprado** (`whatscrm/`, ZIPs) → fora do git, só no ambiente local;
- **Nossa tradução e ferramentas** (`docs/pt-br/`, `tools/`, `traducao/`) →
  versionadas no branch desta sessão, prontas para o repositório do WhatsCRM.

---

## 10. Estimativa por sessão

| Cenário | Sessões |
|---|---|
| Dicionário cobre a maior parte (caso comum) | 2 — inventário+glossário+tradução; depois conteúdo dinâmico+verificação |
| Dicionário cobre pouco e há muito texto preso no bundle | 3–4 (entra a mineração + patch + reaplicação) |
| Com add-ons (IA, Telegram, Instagram, Messenger) | +1 por add-on relevante |
| Sistema novo do autor (update com telas novas) | ~1/2 sessão para reaplicar e traduzir o delta |

A qualidade não depende do número de telas, e sim de **não traduzir o que não é
texto** — o resto é volume, e volume é o que a automação resolve.
