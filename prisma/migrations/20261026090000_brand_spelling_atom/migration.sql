-- Owner request 2026-10-26: the brand is written «اتم», not «آتم».
-- Site texts saved from the admin panel (site settings, the About page) were copies of the old defaults,
-- so they are updated too. Data only, no schema change; running it again changes nothing.
-- News, products, FAQs and other content written in the admin panel are left as they are.
UPDATE "site_settings"
SET "value" = replace("value"::text, 'آتم', 'اتم')::jsonb
WHERE "value"::text LIKE '%آتم%';

UPDATE "pages"
SET "title" = replace("title", 'آتم', 'اتم'),
    "contentHtml" = replace("contentHtml", 'آتم', 'اتم'),
    "contentJson" = CASE WHEN "contentJson" IS NULL THEN NULL ELSE replace("contentJson"::text, 'آتم', 'اتم')::jsonb END
WHERE "title" LIKE '%آتم%' OR "contentHtml" LIKE '%آتم%' OR "contentJson"::text LIKE '%آتم%';
