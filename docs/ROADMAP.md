# Tô no Sarro! — Roadmap de Melhorias

## ✅ Sprint 1 — Críticos (Concluído)
- Bug mesas O(n*m) → O(n) Map + campo `table_number` dedicado
- `zod` schemas `server/schemas/orders.js` (customer, items 1-20, tableNumber 1-50, payment inclui "No fechamento da mesa")
- `validateOrder` integrado em `POST /api/orders` com fallback legacy
- `getOrders({limit, offset, tableNumber, status, type})` + índice `idx_orders_table_number`
- `GET /api/orders?tableNumber=&limit=` com paginação SQL
- `getCashSummary` otimizado com `SUM CASE` vs loop JS
- Utils: `orderModality.js`, `mesa.js` (`extractTableNumber`, `buildMesaIndex`), `useOrdersByMesa` memo
- Testes vitest: `mesas.test.js` (5) + `orders.schema.test.js` (5) = 10
- Build 467.5kB OK

## ✅ Sprint 2 — Modularização & PWA (Concluído)
- `src/constants/theme.js` (C, font, STATUS, FLOW, CHANNELS)
- `src/utils/format.js`, `api.js`, `print.js`
- `src/components/ui/index.jsx` (Logo, SmartImg, Badge, Btn, Card, KPI, BarChart, Donut)
- `src/components/track/TrackScreen.jsx` (polling Pix 5s, checkPayment 3.5s, QR)
- `src/components/tables/AdminTables.jsx` (887 linhas extraídas) + wrapper em App.jsx
- App.jsx 9439 → 8035 linhas (-1400)
- `AdminOrders`: useMemo filtro + paginação PAGE_SIZE 30 + React.memo OrderCard + botão Carregar mais
- PWA: `vite-plugin-pwa` manifest, precache 13 entries, runtimeCaching QR (CacheFirst 7d) e /api (NetworkFirst 5m)
- Rate limiter in-memory: POST /api/orders 15/min por telefone/IP, login 8/min
- Build 464.15kB, 10 testes

## ✅ Sprint 3 — Negócio & Observabilidade (Concluído)
- Migrations versionadas: `001_service_charge` (service_charge, percent, settings defaults) e `002_geo` (customer_lat/lng, split_group/people) + tabela `migrations`
- `getSettings`: serviceChargeEnabled, serviceChargePercent (10% padrão)
- `getOrders`: retorna serviceCharge, customerLat/Lng, splitGroup
- `PATCH /api/settings`: service_charge_enabled bool + percent 0-30
- `ServiceChargeCard.jsx` + integração AdminSettings
- `AdminTables`: usa `servicePercent` do settings, botão ✂️ Dividir
- `SplitBillModal.jsx`: divisão igual ou por itens, taxa proporcional, impressão individual/resumo, até 6 pessoas
- OSRM: `server/routing/osrm.js` (geocode Nominatim cache 500, table, trip), `POST /api/routes/optimize` + audit, ExpeditionApp com botão Otimizar (OSRM) + badge km/min
- Observabilidade: `logger.js` JSON estruturado, `requestLogger` middleware, `setupErrorHandlers` uncaughtException
- E2E: `mesa-flow.e2e.test.js` (5 testes) — abre mesa, nova rodada, taxa, split igual/por itens, transferência
- Unit: `osrm.test.js` fallback, `service-charge.test.js` cálculo
- Total 20 testes, build 468.94kB

---

## 🚧 Sprint 4 — Segurança & Produção (Próximo)
**Objetivo:** deixar pronto para produção real

### Backend
- [ ] `helmet` + CORS restritivo + `xss-clean` / sanitização
- [ ] Refresh token + expiração sessão 7d + logout em todos dispositivos
- [ ] Validação zod em todas rotas (produtos, cupons, drivers)
- [ ] `POST /api/orders` idempotency key (evitar duplicação ao recarregar)
- [ ] Health check `GET /api/health` → db, uptime, version, migrations
- [ ] Dockerfile + docker-compose (api + sqlite volume + osrm opcional)
- [ ] `.env.example` documentado

### Observabilidade real
- [ ] `@sentry/node` + `@sentry/react` com `SENTRY_DSN`
- [ ] Métricas: contador pedidos/min, tempo médio preparo, taxa cancelamento
- [ ] Alertas: estoque < min, caixa aberto >12h, falha impressão

### CI/CD
- [ ] GitHub Actions: `lint` (eslint), `test` (vitest), `build`, `check:paineis`
- [ ] Pre-commit hook husky + lint-staged
- [ ] Preview deploy por branch (Render/Netlify)

**Estimativa:** 2-3 dias

---

## 🚧 Sprint 5 — Performance & Arquitetura
**Objetivo:** App.jsx 8090 → <2000 linhas, bundle <350kB, 60fps

### Quebrar monolito
- [ ] `src/components/admin/`:
  - `AdminDashboard.jsx`, `AdminOrders.jsx` (já parcial), `AdminProducts.jsx`, `AdminCustomers.jsx`, `AdminFinance.jsx`, `AdminReports.jsx`, `AdminPromos.jsx`, `AdminUsers.jsx`, `AdminCategories.jsx`, `AdminIntegrations.jsx`, `AdminCashRegister.jsx`, `AdminApp.jsx`
- [ ] `src/components/kitchen/KitchenApp.jsx`
- [ ] `src/components/expedition/ExpeditionApp.jsx` + `DriverSettlementModal.jsx`
- [ ] `src/components/driver/DriverApp.jsx`
- [ ] `src/components/tv/TVPanelApp.jsx`
- [ ] `src/components/client/` — `HomeScreen`, `MenuScreen`, `CartScreen`, `Checkout`, `AccountScreen`, `ClientApp`
- [ ] `src/hooks/` — `useOrders`, `useProducts`, `useCart`, `useAuth`, `useSync`

### Performance
- [ ] `React.lazy` + `Suspense` para painéis admin (carrega só quando acessa)
- [ ] `vite-bundle-analyzer` + code splitting manual: `vendor`, `client`, `admin`, `kitchen`
- [ ] `react-window` ou `virtuoso` para listas >100 pedidos
- [ ] `useMemo`/`useCallback` audit + `React.memo` em ProductCard, OrderCard
- [ ] Imagens: `srcset`, lazy loading, WebP, cache 1 ano
- [ ] SW update prompt: "Nova versão disponível — Atualizar"

**Estimativa:** 3-4 dias
**Métrica sucesso:** App.jsx <2000 linhas, build <350kB gzip <100kB, Lighthouse 90+

---

## 🚧 Sprint 6 — Negócio & UX Avançado
**Objetivo:** aumentar ticket médio e retenção

### Salão
- [ ] Split por pagamento parcial: tabela `order_payments` (order_id, method, amount, person), endpoint `POST /api/orders/:id/split-pay`
- [ ] Comanda individual persistida: `split_group` = uuid por pessoa, lista de pessoas na mesa, cada pessoa vê só seus itens mas garçom vê total
- [ ] Gorjeta separada de taxa serviço: input gorjeta no fechamento, relatório por garçom
- [ ] Relatório garçons: mesas atendidas, tempo médio, taxa serviço arrecadada
- [ ] Transferência com mesclagem: já tem confirm, mas adicionar histórico audit

### Delivery
- [ ] Geocodificação persistida: ao criar pedido delivery, geocodifica endereço e salva lat/lng
- [ ] OSRM distância real: calcula frete por km + tempo estimado real vs fixo
- [ ] Rota otimizada com janela de tempo (ex: entrega até 19h)
- [ ] Prova de entrega: foto + assinatura no DriverApp

### Operação
- [ ] Estoque alerta: WS notifica "Queijo coalho abaixo do mínimo (2/5)", auto-desativa produto
- [ ] Promoção automática por horário: happy hour 18-19h, regra `time_window`
- [ ] Fidelidade: pontos por R$ gasto, resgate cupom automático, tier (bronze/prata/ouro)
- [ ] Backup automático: dump sqlite diário para S3/Drive

### UX
- [ ] Atalhos teclado: `Ctrl+K` busca produto, `N` novo pedido, `M` mesas, `E` expedição
- [ ] Acessibilidade: ARIA labels, foco visível, contraste AA
- [ ] Impressão ESC/POS real: `server/printing/escpos.js` já existe, integrar com `printer_host` via TCP socket
- [ ] Sommelier: sugestão de combo baseado em itens da mesa

**Estimativa:** 4-5 dias

---

## 📊 Métricas Atuais vs Meta

| Métrica | Antes | Sprint3 | Meta Sprint6 |
|---------|-------|---------|--------------|
| App.jsx linhas | 9439 | 8090 | <2000 |
| Bundle JS | 467kB | 468kB | <350kB |
| Testes | 0 | 20 | 60+ (unit + e2e + Playwright) |
| Cobertura mesas bug | ❌ todas ocupadas | ✅ O(n) Map + 5 testes | ✅ + E2E |
| PWA | ❌ | ✅ precache 13 | ✅ + update prompt |
| Taxa serviço | hardcoded 10% local | configurável 0-30% settings | + gorjeta + relatório |
| Split conta | ❌ | ✅ igual/por itens frontend | ✅ persistido + pagamento parcial |
| Rota | Google Maps URL fixo | OSRM trip + optimize endpoint | + distância real + janela tempo |
| Observabilidade | console.log | logger JSON + requestLogger | + Sentry + métricas |
| Migrations | addColumnIfMissing | versionadas 001/002 + tabela | + rollback + seed |
| Rate limit | ❌ | 15/min orders, 8/min login | + helmet + idempotency |

---

## 🎯 Recomendação de Priorização

**Se foco é vender hoje:** Sprint 6 (negócio) → aumenta ticket médio com taxa serviço + split + gorjeta
**Se foco é escalar sem dor:** Sprint 5 (arquitetura) → App.jsx <2000 linhas evita bug futuro
**Se foco é produção segura:** Sprint 4 (segurança) → Sentry + CI + Docker evita downtime

Sugestão do time: **Sprint 4 → 5 → 6** (segurança primeiro, depois arquitetura, depois negócio), pois sem base segura, novas features geram débito técnico.
