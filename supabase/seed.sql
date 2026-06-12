-- =============================================================
-- BasarIQ — seed data (M0)
-- =============================================================
-- Cut numbers and Hebrew names are placeholders — verify and
-- replace with the official catalog Excel asset before launch.
-- Vendors are placeholders — import from Sharon/Galilee Excel.
-- Historical price_observations: run the tracker-import script
-- after the DB is seeded (see scripts/import-tracker-prices.ts).
-- =============================================================

-- Fixed UUIDs for seed cuts so aliases can reference them
-- Format: 00000000-0000-0000-0000-00000000000N

-- =============================================================
-- CUTS CATALOG
-- =============================================================
insert into public.cuts
  (id, category, name_en, name_he, israeli_number, primal, kosher_notes, status)
values
  -- Forequarter (no nikur required; standard kosher supply)
  ('00000000-0000-0000-0000-000000000001','beef','Entrecôte (Ribeye)',   'אנטרקוט',     1,  'rib',    null,                              'active'),
  ('00000000-0000-0000-0000-000000000002','beef','Short Ribs (Asado)',   'אסאדו',        2,  'rib',    null,                              'active'),
  ('00000000-0000-0000-0000-000000000003','beef','Neck',                 'צוואר',        3,  'chuck',  null,                              'active'),
  ('00000000-0000-0000-0000-000000000004','beef','Shoulder (Blade)',     'כתף',          4,  'chuck',  null,                              'active'),
  ('00000000-0000-0000-0000-000000000005','beef','Brisket',              'בריסקט',       5,  'brisket',null,                              'active'),
  ('00000000-0000-0000-0000-000000000006','beef','Flanken (Short Plate)','שפונדרה',      6,  'plate',  null,                              'active'),
  ('00000000-0000-0000-0000-000000000007','beef','Fore Shank',           'שוק קדמי',     7,  'shank',  null,                              'active'),
  -- Hindquarter (requires nikkur for kosher; available at non-kosher butchers)
  ('00000000-0000-0000-0000-000000000008','beef','Sirloin',              'סינטה',        8,  'loin',   'Hindquarter — requires nikkur',   'active'),
  ('00000000-0000-0000-0000-000000000009','beef','Tenderloin (Fillet)',  'פילה',         9,  'loin',   'Hindquarter — requires nikkur',   'active'),
  ('00000000-0000-0000-0000-000000000010','beef','Rump',                 'שייטל',        10, 'round',  'Hindquarter — requires nikkur',   'active'),
  ('00000000-0000-0000-0000-000000000011','beef','Round (Thigh)',        'ירך',          11, 'round',  'Hindquarter — requires nikkur',   'active'),
  ('00000000-0000-0000-0000-000000000012','beef','Hind Shank',           'שוק אחורי',    12, 'shank',  'Hindquarter — requires nikkur',   'active'),
  -- Unnumbered / specialty
  ('00000000-0000-0000-0000-000000000013','beef','Chuck (Flat Iron)',    'צ''אק',        null,'chuck', null,                              'active'),
  ('00000000-0000-0000-0000-000000000014','beef','Ground Beef',          'בשר טחון',     null,'other', null,                              'active'),
  ('00000000-0000-0000-0000-000000000015','beef','Ground Beef (Lean)',   'בשר טחון רזה', null,'other', null,                              'active')
;

-- =============================================================
-- CUT ALIASES
-- Every alias is globally unique (case-insensitive) per unique index.
-- =============================================================
insert into public.cut_aliases (id, cut_id, alias, lang) values
  -- Entrecôte / Ribeye
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','אנטרקוט',    'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','entrecote',   'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','entrecôte',   'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','ribeye',      'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','rib eye',     'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','rib-eye',     'en'),
  -- Asado / Short Ribs
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000002','אסאדו',       'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000002','asado',       'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000002','short ribs',  'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000002','צלעות',       'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000002','צלעות קצרות', 'he'),
  -- Neck
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000003','צוואר',       'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000003','neck',        'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000003','chuck neck',  'en'),
  -- Shoulder
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000004','כתף',         'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000004','shoulder',    'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000004','blade',       'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000004','chuck shoulder','en'),
  -- Brisket
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000005','בריסקט',      'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000005','brisket',     'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000005','חזה',         'he'),
  -- Flanken
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000006','שפונדרה',     'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000006','flanken',     'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000006','short plate', 'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000006','plate ribs',  'en'),
  -- Fore Shank
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000007','שוק קדמי',    'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000007','fore shank',  'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000007','front shank', 'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000007','shank',       'en'),
  -- Sirloin
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000008','סינטה',       'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000008','sirloin',     'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000008','striploin',   'en'),
  -- Tenderloin
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000009','פילה',        'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000009','fillet',      'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000009','filet',       'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000009','tenderloin',  'en'),
  -- Rump
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000010','שייטל',       'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000010','rump',        'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000010','rump steak',  'en'),
  -- Round
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000011','ירך',         'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000011','round',       'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000011','thigh',       'en'),
  -- Hind Shank
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000012','שוק אחורי',   'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000012','hind shank',  'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000012','back shank',  'en'),
  -- Chuck / Flat Iron
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000013','צ''אק',       'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000013','chuck',       'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000013','flat iron',   'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000013','chuck roast', 'en'),
  -- Ground Beef
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000014','בשר טחון',    'he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000014','ground beef', 'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000014','minced beef', 'en'),
  -- Lean Ground Beef
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000015','בשר טחון רזה','he'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000015','lean ground', 'en'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000015','lean mince',  'en')
;

-- =============================================================
-- VENDORS — placeholder (replace with Sharon + Galilee Excel import)
-- Fixed UUIDs: 00000000-0000-0000-0001-00000000000N
-- =============================================================
insert into public.vendors
  (id, name, type, region, city, lat, lng, delivers, delivery_regions, delivery_fee, delivery_min_order, rating, status)
values
  -- Sharon
  ('00000000-0000-0000-0001-000000000001','קצביית שמואל',         'butcher','sharon', 'נתניה',   32.3215, 34.8532, false, null,      null, null, 4.2, 'active'),
  ('00000000-0000-0000-0001-000000000002','בשר טרי כפר סבא',      'butcher','sharon', 'כפר סבא', 32.1750, 34.9064, false, null,      null, null, 3.8, 'active'),
  ('00000000-0000-0000-0001-000000000003','קצביית רענן',           'butcher','sharon', 'רעננה',   32.1837, 34.8710, false, null,      null, null, 4.5, 'active'),
  -- North / Galilee
  ('00000000-0000-0000-0001-000000000004','קצביית הגליל',          'butcher','north',  'עכו',     32.9298, 35.0832, false, null,      null, null, 4.0, 'active'),
  ('00000000-0000-0000-0001-000000000005','בשר הכרמל',             'butcher','haifa',  'חיפה',    32.8156, 34.9892, false, null,      null, null, 3.9, 'active'),
  ('00000000-0000-0000-0001-000000000006','קצביית כרמיאל',         'butcher','north',  'כרמיאל',  32.9147, 35.2978, false, null,      null, null, 4.1, 'active'),
  -- Online delivery (nationwide)
  ('00000000-0000-0000-0001-000000000007','בשר ישיר',              'online', 'center', 'תל אביב', null,    null,    true,  ARRAY['*'], 39,  250,  null,'active')
;

-- =============================================================
-- HISTORICAL PRICE OBSERVATIONS
-- Import from existing React tracker export.
-- Run after seeding: npx ts-node scripts/import-tracker-prices.ts
-- =============================================================
-- (no static rows here — tracker data varies and should be imported via script)
