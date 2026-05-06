-- ═══════════════════════════════════════════════════════════
-- THOPPIL JEWELLERY — Supabase Database Schema
-- Run this entire SQL in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- ── 1. Categories table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url   TEXT,
  featured    BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Enquiries table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT DEFAULT '',
  message    TEXT DEFAULT '',
  status     TEXT DEFAULT 'new' CHECK (status IN ('new','read','replied')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Seed default categories ───────────────────────────────
INSERT INTO categories (name, description, featured) VALUES
  ('Necklaces',           'Elegant necklaces for every occasion',     true),
  ('Rings',               'Exquisite rings crafted with precision',    true),
  ('Earrings',            'Beautiful earrings from classic to modern', true),
  ('Bangles & Bracelets', 'Traditional and contemporary bangles',      false),
  ('Bridal Sets',         'Complete bridal jewellery collections',     true),
  ('Temple Jewellery',    'Traditional Kerala temple jewellery',       true)
ON CONFLICT DO NOTHING;

-- ── 4. Disable Row Level Security (use service_role key) ─────
-- We use service_role key in backend so RLS is bypassed.
-- But enable it for safety and allow all via policy:
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries  ENABLE ROW LEVEL SECURITY;

-- Allow public read on categories
CREATE POLICY "Public read categories"
  ON categories FOR SELECT
  USING (true);

-- Allow service_role full access (your backend uses this)
CREATE POLICY "Service full access categories"
  ON categories FOR ALL
  USING (auth.role() = 'service_role');

-- Allow public insert on enquiries (contact form)
CREATE POLICY "Public insert enquiries"
  ON enquiries FOR INSERT
  WITH CHECK (true);

-- Allow service_role full access to enquiries
CREATE POLICY "Service full access enquiries"
  ON enquiries FOR ALL
  USING (auth.role() = 'service_role');

-- ── 5. Storage bucket ────────────────────────────────────────
-- Run this separately in Supabase Dashboard → Storage → New Bucket
-- Bucket name: jewellery-images
-- Public bucket: YES (tick the box)
--
-- OR run this SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('jewellery-images', 'jewellery-images', true)
ON CONFLICT DO NOTHING;

-- Allow public read on storage
CREATE POLICY "Public read images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'jewellery-images');

-- Allow service_role to upload/delete
CREATE POLICY "Service upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'jewellery-images');

CREATE POLICY "Service delete images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'jewellery-images');

-- ── Done! ─────────────────────────────────────────────────────
-- You should see:
--   ✅ Table: categories (with 6 rows)
--   ✅ Table: enquiries
--   ✅ Storage bucket: jewellery-images
