-- Refresh Home SEO titles and header-under-logo Shared overrides when they
-- still match the superseded curated-goods defaults. Exact-match only so
-- custom admin copy is left untouched.

-- Page.seoTitle (EN source column)
UPDATE "Page"
SET "seoTitle" = 'Jewellery & Accessories for Everyday Wear | Synarava',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE slug = 'home'
  AND (
    "seoTitle" IS NULL
    OR btrim("seoTitle") = ''
    OR "seoTitle" IN (
      'Synarava | Curated Goods',
      'Synarava | Curated goods'
    )
  );

-- PageTranslation.seoTitle per locale
UPDATE "PageTranslation" AS pt
SET "seoTitle" = CASE pt.locale
    WHEN 'en' THEN 'Jewellery & Accessories for Everyday Wear | Synarava'
    WHEN 'pt' THEN 'Joalharia e acessórios para todos os dias | Synarava'
    WHEN 'ru' THEN 'Украшения и аксессуары на каждый день | Synarava'
    ELSE pt."seoTitle"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Page" AS p
WHERE pt."pageId" = p.id
  AND p.slug = 'home'
  AND pt.locale IN ('en', 'pt', 'ru')
  AND (
    pt."seoTitle" IS NULL
    OR btrim(pt."seoTitle") = ''
    OR pt."seoTitle" IN (
      'Synarava | Curated Goods',
      'Synarava | Curated goods',
      'Synarava | Seleção cuidada',
      'Synarava | Кураторские товары'
    )
  );

-- Site-wide SEO defaults (Meta admin) when still on brand-first curated goods
UPDATE "SiteSetting"
SET value = (
      CASE
        WHEN value #>> '{defaultTitle}' IN ('Synarava | Curated Goods', 'Synarava | Curated goods')
          THEN jsonb_set(COALESCE(value::jsonb, '{}'::jsonb), '{defaultTitle}',
            '"Jewellery & Accessories for Everyday Wear | Synarava"', true)
        ELSE COALESCE(value::jsonb, '{}'::jsonb)
      END
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE key = 'site-seo-v1'
  AND value #>> '{defaultTitle}' IN ('Synarava | Curated Goods', 'Synarava | Curated goods');

UPDATE "SiteSetting"
SET value = jsonb_set(
      COALESCE(value::jsonb, '{}'::jsonb),
      '{ogTitle}',
      '"Jewellery & Accessories for Everyday Wear | Synarava"',
      true
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE key = 'site-seo-v1'
  AND value #>> '{ogTitle}' IN ('Synarava | Curated Goods', 'Synarava | Curated goods');

-- Shared storefront-copy brand.curatedGoods (header under logo) — per locale, exact match
UPDATE "SiteSetting"
SET value = jsonb_set(
      COALESCE(value::jsonb, '{}'::jsonb),
      '{en,brand.curatedGoods}',
      '"Jewellery & Accessories"',
      true
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE key = 'storefront-copy-v1'
  AND value #>> '{en,brand.curatedGoods}' IN ('Curated goods', 'Curated Goods');

UPDATE "SiteSetting"
SET value = jsonb_set(
      COALESCE(value::jsonb, '{}'::jsonb),
      '{pt,brand.curatedGoods}',
      '"Joalharia e acessórios"',
      true
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE key = 'storefront-copy-v1'
  AND value #>> '{pt,brand.curatedGoods}' = 'Peças escolhidas';

UPDATE "SiteSetting"
SET value = jsonb_set(
      COALESCE(value::jsonb, '{}'::jsonb),
      '{ru,brand.curatedGoods}',
      '"Украшения и аксессуары"',
      true
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE key = 'storefront-copy-v1'
  AND value #>> '{ru,brand.curatedGoods}' = 'Выбранные вещи';
