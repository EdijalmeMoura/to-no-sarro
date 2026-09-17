# Glossário de terminologia — WhatsCRM / CRM de WhatsApp em pt-BR

Terminologia **travada** para todo o sistema (landing, admin, painel do usuário,
painel do atendente, e-mails e mensagens). Regra de ouro: **consistência ganha de
criatividade** — o mesmo termo em inglês tem sempre a mesma tradução.

Legenda: ✅ traduzir · 🔒 manter em inglês · ⚠️ cuidado (é identificador, não rótulo)

---

## 1. Navegação e estrutura

| Inglês | pt-BR | Obs. |
|---|---|---|
| Dashboard | Painel | ✅ “Painel” ou “Visão geral” quando houver dois níveis |
| Inbox | Caixa de entrada | ✅ (ou “Conversas”, se o menu já tiver “Caixa de entrada”) |
| Chats | Conversas | ✅ |
| Tickets | Atendimentos | ✅ evitar “tickets” |
| Ticket management | Gestão de atendimentos | ✅ |
| Contacts | Contatos | ✅ |
| Phonebook | Agenda de contatos | ✅ |
| Broadcast | Disparo em massa | ✅ (“Campanha” fica reservado a Campaign) |
| Broadcast tracking | Acompanhamento de disparos | ✅ |
| Campaign | Campanha | ✅ |
| Automation | Automação | ✅ |
| Chatbot | Chatbot | 🔒 forma consagrada no mercado brasileiro |
| Flow Builder | Construtor de fluxos | ✅ |
| Flow | Fluxo | ✅ |
| Node / Block | Bloco | ✅ usar “Bloco” na interface |
| Templates | Modelos | ✅ |
| Messenger | Messenger | 🔒 |
| Plan / Plans | Plano / Planos | ✅ |
| Subscription | Assinatura | ✅ |
| Billing | Faturamento | ✅ |
| Wallet | Carteira | ✅ |
| Orders | Pedidos | ✅ |
| Reports | Relatórios | ✅ |
| Settings | Configurações | ✅ |

## 2. Pessoas e permissões

| Inglês | pt-BR | Obs. |
|---|---|---|
| Agent | Atendente | ✅ |
| Agent management | Gestão de atendentes | ✅ |
| Team | Equipe | ✅ |
| User | Usuário | ✅ |
| Admin | Admin | 🔒 forma curta consagrada |
| Staff | Colaborador | ✅ |
| Role / Permission | Perfil / Permissão | ✅ |
| Assign (chat) | Atribuir (a um atendente) | ✅ |
| Handover (AI → agent) | Transferência para atendente | ✅ |

## 3. Status e métricas

| Inglês | pt-BR | Obs. |
|---|---|---|
| Delivered | Entregue | ✅ rótulo. ⚠️ o valor enviado à API continua `delivered` |
| Seen / Read | Visualizada | ✅ |
| Sent | Enviada | ✅ |
| Failed | Falhou | ✅ + “motivo da falha” |
| Pending | Pendente | ✅ |
| Open / Closed | Aberto / Encerrado | ✅ |
| Resolved | Resolvido | ✅ |
| Active / Inactive | Ativo / Inativo | ✅ |
| Online / Offline | Online / Offline | 🔒 |
| Connected / Disconnected | Conectado / Desconectado | ✅ |
| Uptime | Disponibilidade | ✅ (em SLA) |
| Usage | Consumo | ✅ |
| Limit / Quota | Limite / Cota | ✅ |
| Analytics | Análises | ✅ |
| Overview | Visão geral | ✅ |

## 4. WhatsApp / Meta (nomes próprios)

| Inglês | pt-BR | Obs. |
|---|---|---|
| WhatsApp Cloud API | API Cloud do WhatsApp | 🔒 “Cloud API” fica em inglês |
| WhatsApp Business | WhatsApp Business | 🔒 |
| Phone Number ID | ID do número de telefone | ✅ rótulo, ⚠️ nunca o valor |
| Access Token | Token de acesso | ✅ |
| Verify Token | Token de verificação | ✅ |
| Template (Meta) | Modelo | ✅ no rótulo; ⚠️ o **nome** do modelo fica ASCII sem acento |
| Template category | Categoria do modelo | ✅ (Marketing, Utilidade, Autenticação) |
| 24-hour window | Janela de 24 horas | ✅ |
| Opt-in / Opt-out | Aceite / Descadastro | ✅ |
| Warm-up (number) | Aquecimento do número | ✅ |
| Ban risk | Risco de bloqueio | ✅ |
| Webhook | Webhook | 🔒 (ou “Webhook (retorno automático)” na 1ª menção) |
| Quick link | Link rápido | ✅ |
| Chat widget | Widget de chat | ✅ |

## 5. Flow Builder (nós e ações)

| Inglês | pt-BR | Obs. |
|---|---|---|
| Send message | Enviar mensagem | ✅ |
| Send template | Enviar modelo | ✅ |
| Ask question | Fazer pergunta | ✅ |
| Take input | Capturar resposta | ✅ |
| Condition | Condição | ✅ |
| Delay / Wait | Espera | ✅ “Aguardar” para ação |
| Set chat tags | Definir etiquetas da conversa | ✅ |
| Assign to agent | Atribuir a atendente | ✅ |
| Request API | Requisição de API | ✅ |
| Google Spreadsheet / Sheets | Planilhas Google | ✅ marca: Google Sheets |
| Reset flow | Reiniciar fluxo | ✅ |
| Duplicate node | Duplicar bloco | ✅ |
| Save to sheet | Salvar na planilha | ✅ |
| Keywords | Palavras-chave | ✅ |
| Tags | Etiquetas | ✅ |

## 6. Ações da interface

| Inglês | pt-BR | Obs. |
|---|---|---|
| Save / Update | Salvar / Atualizar | ✅ |
| Cancel | Cancelar | ✅ |
| Delete | Excluir | ✅ (evitar “deletar”) |
| Edit | Editar | ✅ |
| Add / Create | Adicionar / Criar | ✅ |
| Search | Buscar | ✅ campo: “Buscar…” |
| Filter | Filtro / Filtrar | ✅ |
| Import / Export | Importar / Exportar | ✅ |
| Download / Upload | Baixar / Enviar arquivo | ✅ “Upload” é aceito no meio técnico; na interface, “Enviar” |
| Sign in | Entrar | ✅ |
| Sign up | Criar conta | ✅ |
| Log out | Sair | ✅ |
| Forgot password | Esqueci minha senha | ✅ |
| Reset password | Redefinir senha | ✅ |
| Next / Back | Continuar / Voltar | ✅ |
| Get started free | Comece grátis | ✅ |
| See how it works | Veja como funciona | ✅ |
| Book a demo | Agendar demonstração | ✅ |
| Powered by | Desenvolvido por | ✅ |
| Coming soon | Em breve | ✅ |
| No results found | Nenhum resultado encontrado | ✅ |
| Something went wrong | Ocorreu um erro | ✅ |

## 7. Planos, cobrança e checkout

| Inglês | pt-BR | Obs. |
|---|---|---|
| Free trial | Teste grátis | ✅ |
| Upgrade / Downgrade | Fazer upgrade / Fazer downgrade | 🔒 verbs are idiomatic |
| Price | Preço | ✅ |
| Per month | por mês | ✅ |
| Payment method | Forma de pagamento | ✅ |
| Payment gateway | Meio de pagamento | ✅ |
| Checkout | Checkout | 🔒 consagrado no e-commerce BR |
| Invoice | Fatura | ✅ |
| Coupon | Cupom | ✅ |
| Auto login | Login automático | ✅ |
| Plan expiry | Validade do plano | ✅ |
| Renewal | Renovação | ✅ |

## 8. Textos de venda (landing)

| Inglês | pt-BR | Obs. |
|---|---|---|
| All-in-One Omnichannel Inbox | Caixa de entrada omnichannel completa | ✅ |
| Unified inbox | Caixa de entrada unificada | ✅ |
| Bulk messages | Mensagens em massa | ✅ |
| No code needed | Sem escrever código | ✅ |
| Deploy AI chatbots | Implante chatbots com IA | ✅ |
| Run voice call campaigns | Faça campanhas de ligação | ✅ |
| Businesses worldwide | Empresas no mundo todo | ✅ |
| Integrations & Partners | Integrações e parceiros | ✅ |
| Works with tools you already use | Funciona com as ferramentas que você já usa | ✅ |
| Testimonials | Depoimentos | ✅ |
| FAQ | Perguntas frequentes | ✅ |

## 9. Nunca traduzir (🔒 técnico)

`API`, `API key`, `REST`, `webhook` (valor), `token`, `endpoint`, `payload`,
`SDK`, `JSON`, `CRM`, `SaaS`, `QR Code`, `Kanban`, `Pix`, `CPF`, `CNPJ`,
`SMTP`, `OAuth`, `ID`, `URL`, `e-mail`, `cache`, `timeout`, `status` no sentido
de campo. **E, principalmente:** qualquer valor de enum, chave de dicionário,
slug de rota, nome de evento, nome de campo de banco ou nome de nó do fluxo.

---

## Convenções de escrita

- **Tratamento:** “você” (neutro, nacional). Nada de “tu” ou “vossa”.
- **Tom:** direto e profissional; botão no infinitivo ou imperativo curto (“Salvar”, “Enviar”).
- **Caixa:** Sentence case nos rótulos (“Caixa de entrada”, não “CAIXA DE ENTRADA”).
- **Gerúndio:** evitar (“Salvando…” → “Salvando…” é aceitável em progresso; “Estamos salvando” não).
- **Pontuação:** sem exclamação em mensagens de erro; ponto final em frases completas.
- **Números:** separador de milhar ponto, decimal vírgula, moeda `R$ 1.234,56`.
- **Siglas:** mantidas em maiúsculas; na 1ª ocorrência, expandir se ajudar (“API (interface de programação)”).
- **Placeholders:** `{{nome}}`, `{0}`, `%s` copiados **exatamente**, na posição que fizer sentido em português.
