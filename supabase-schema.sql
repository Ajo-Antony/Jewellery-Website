-- ═══════════════════════════════════════════════════════════
-- THOPPIL JEWELLERY — Extended Schema (Products)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- ── Add slug column to categories ────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT;
UPDATE categories
  SET slug = LOWER(REGEXP_REPLACE(REPLACE(REPLACE(name, '&', 'and'), ' ', '-'), '[^a-z0-9-]', '', 'g'))
  WHERE slug IS NULL OR slug = '';

-- ── Products table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           BIGSERIAL PRIMARY KEY,
  category_id  BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  description  TEXT DEFAULT '',
  price_range  TEXT DEFAULT '',
  gold_purity  TEXT DEFAULT '22K',
  weight       TEXT DEFAULT '',
  stone_type   TEXT DEFAULT '',
  thumbnail    TEXT,
  featured     BOOLEAN DEFAULT false,
  stock_status TEXT DEFAULT 'available',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Product images table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id            BIGSERIAL PRIMARY KEY,
  product_id    BIGINT REFERENCES products(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Disable RLS on all tables ─────────────────────────────────
ALTER TABLE products       DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories     DISABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries      DISABLE ROW LEVEL SECURITY;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug       ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured   ON products(featured);
CREATE INDEX IF NOT EXISTS idx_product_images_prod ON product_images(product_id, display_order);
