-- TÔ NO SARRO! — SMART FOOD SYSTEM
-- Esquema relacional (PostgreSQL). Base para o backend do protótipo.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Acesso ----------
CREATE TABLE roles (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,      -- admin, gerente, atendimento, cozinha, expedicao, entregador
  name          TEXT NOT NULL
);

CREATE TABLE permissions (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,      -- orders.read, orders.write, finance.read, ...
  description   TEXT
);

CREATE TABLE role_permissions (
  role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         CITEXT UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,             -- argon2id
  role_id       INT REFERENCES roles(id),
  active        BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ---------- Clientes ----------
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  cpf           TEXT,
  tier          TEXT DEFAULT 'novo',       -- novo, recorrente, vip, inativo
  loyalty_points INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID REFERENCES customers(id) ON DELETE CASCADE,
  street        TEXT NOT NULL,
  number        TEXT NOT NULL,
  complement    TEXT,
  district      TEXT NOT NULL,
  city          TEXT NOT NULL,
  reference     TEXT,
  lat           NUMERIC(10,7),
  lng           NUMERIC(10,7),
  is_default    BOOLEAN DEFAULT FALSE
);

-- ---------- Cardápio ----------
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  icon          TEXT,
  sort_order    INT DEFAULT 0,
  active        BOOLEAN DEFAULT TRUE
);

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES categories(id),
  name          TEXT NOT NULL,
  description   TEXT,
  ingredients   TEXT[],
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  promo_price   NUMERIC(10,2) CHECK (promo_price >= 0),
  image_url     TEXT,
  prep_minutes  INT DEFAULT 15,
  featured      BOOLEAN DEFAULT FALSE,
  best_seller   BOOLEAN DEFAULT FALSE,
  is_new        BOOLEAN DEFAULT FALSE,
  available     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE option_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,             -- "Escolha seu queijo"
  min_select    INT DEFAULT 0,
  max_select    INT DEFAULT 1,
  required      BOOLEAN DEFAULT FALSE,
  sort_order    INT DEFAULT 0
);

CREATE TABLE product_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID REFERENCES option_groups(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  extra_price   NUMERIC(10,2) DEFAULT 0,
  available     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0
);

CREATE TABLE product_option_groups (
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  group_id      UUID REFERENCES option_groups(id) ON DELETE CASCADE,
  sort_order    INT DEFAULT 0,
  PRIMARY KEY (product_id, group_id)
);

-- ---------- Pedidos ----------
CREATE TYPE order_channel AS ENUM ('direct','whatsapp','ifood','99food');
CREATE TYPE order_type    AS ENUM ('delivery','pickup');
CREATE TYPE order_status  AS ENUM
  ('novo','confirmado','preparo','pronto','embalado','aguardando','rota','entregue','cancelado');

CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             SERIAL UNIQUE,
  customer_id      UUID REFERENCES customers(id),
  channel          order_channel NOT NULL DEFAULT 'direct',
  external_id      TEXT,                   -- id do pedido no iFood / 99Food
  type             order_type NOT NULL DEFAULT 'delivery',
  status           order_status NOT NULL DEFAULT 'novo',
  address_snapshot JSONB,                  -- endereço congelado no momento do pedido
  subtotal         NUMERIC(10,2) NOT NULL,
  delivery_fee     NUMERIC(10,2) DEFAULT 0,
  discount         NUMERIC(10,2) DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL,
  coupon_id        UUID,
  note             TEXT,
  change_for       NUMERIC(10,2),
  created_at       TIMESTAMPTZ DEFAULT now(),
  confirmed_at     TIMESTAMPTZ,
  ready_at         TIMESTAMPTZ,
  dispatched_at    TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  cancel_reason    TEXT
);
CREATE INDEX idx_orders_status  ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_channel ON orders(channel);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  name_snapshot TEXT NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  note          TEXT
);

CREATE TABLE order_item_options (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id  UUID REFERENCES order_items(id) ON DELETE CASCADE,
  option_id      UUID REFERENCES product_options(id),
  name_snapshot  TEXT NOT NULL,
  extra_price    NUMERIC(10,2) DEFAULT 0
);

CREATE TABLE order_status_history (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE,
  status      order_status NOT NULL,
  user_id     UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------- Pagamento ----------
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID REFERENCES orders(id) ON DELETE CASCADE,
  method         TEXT NOT NULL,            -- pix, cartao, dinheiro
  provider       TEXT,                     -- mercadopago, pagbank, stone, inter, asaas
  provider_ref   TEXT,
  amount         NUMERIC(10,2) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pendente',
  qr_code        TEXT,
  paid_at        TIMESTAMPTZ,
  raw_payload    JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ---------- Entrega ----------
CREATE TABLE delivery_drivers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  vehicle     TEXT,
  active      BOOLEAN DEFAULT TRUE
);

CREATE TABLE delivery_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID REFERENCES orders(id) ON DELETE CASCADE,
  driver_id    UUID REFERENCES delivery_drivers(id),
  assigned_at  TIMESTAMPTZ DEFAULT now(),
  accepted_at  TIMESTAMPTZ,
  arrived_at   TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  issue_note   TEXT
);

-- ---------- Marketing ----------
CREATE TABLE coupons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL,             -- percent, fixed, freeship
  value         NUMERIC(10,2) DEFAULT 0,
  min_subtotal  NUMERIC(10,2) DEFAULT 0,
  usage_limit   INT,
  usage_count   INT DEFAULT 0,
  first_order_only BOOLEAN DEFAULT FALSE,
  customer_id   UUID REFERENCES customers(id),
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  active        BOOLEAN DEFAULT TRUE
);

CREATE TABLE promotions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,             -- percent, fixed, combo, freeship, product
  config        JSONB NOT NULL,
  weekdays      INT[],
  time_start    TIME,
  time_end      TIME,
  active        BOOLEAN DEFAULT TRUE
);

CREATE TABLE loyalty_points (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES orders(id),
  points       INT NOT NULL,               -- positivo ganha, negativo resgata
  reason       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ---------- Estoque ----------
CREATE TABLE inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  unit          TEXT NOT NULL,
  quantity      NUMERIC(12,3) DEFAULT 0,
  min_quantity  NUMERIC(12,3) DEFAULT 0
);

CREATE TABLE inventory_movements (
  id            BIGSERIAL PRIMARY KEY,
  inventory_id  UUID REFERENCES inventory(id) ON DELETE CASCADE,
  delta         NUMERIC(12,3) NOT NULL,
  reason        TEXT,                      -- entrada, baixa por pedido, perda, ajuste
  order_id      UUID REFERENCES orders(id),
  user_id       UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ---------- Integrações e plataforma ----------
CREATE TABLE integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,      -- ifood, 99food, whatsapp, payment, printer
  enabled       BOOLEAN DEFAULT FALSE,
  config        JSONB,                     -- referências a segredos, nunca o segredo em si
  last_sync_at  TIMESTAMPTZ,
  status        TEXT DEFAULT 'desconectado'
);

CREATE TABLE webhooks (
  id            BIGSERIAL PRIMARY KEY,
  integration   TEXT NOT NULL,
  event         TEXT NOT NULL,
  payload       JSONB NOT NULL,
  signature_ok  BOOLEAN,
  processed_at  TIMESTAMPTZ,
  error         TEXT,
  received_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id           BIGSERIAL PRIMARY KEY,
  audience     TEXT NOT NULL,              -- admin, cozinha, expedicao, entregador, cliente
  title        TEXT NOT NULL,
  body         TEXT,
  order_id     UUID REFERENCES orders(id),
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id),
  action       TEXT NOT NULL,
  entity       TEXT NOT NULL,
  entity_id    TEXT,
  before       JSONB,
  after        JSONB,
  ip           INET,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now()
);
