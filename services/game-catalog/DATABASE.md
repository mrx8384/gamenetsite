# دیتابیس کاتالوگ (راهنمای استفادهٔ مجدد)

همهٔ اطلاعات (بازی‌ها، دسته‌ها و **خود عکس‌ها**) داخل یک فایل SQLite است:

    data/catalog.db

این فرمت استاندارد است و با Python، PHP، Node.js، Laravel، Django، DB Browser for SQLite و… باز می‌شود.
برای نسخهٔ پشتیبان فقط همین یک فایل را کپی کن (یا از پنل مدیریت دانلودش کن).

## ساختار جدول‌ها

    categories(id INTEGER PK, platform TEXT ('ps4' | 'ps5'), name TEXT, position INTEGER,
               UNIQUE(platform, name))
    games(id TEXT PK, name TEXT, category_id INTEGER -> categories.id,
          image BLOB (JPEG), image_type TEXT, created_at INTEGER, updated_at INTEGER,
          platform TEXT ('ps4' | 'ps5'))

هر پلتفرم (PS4 / PS5) دسته‌های مخصوص خودش را دارد. دستهٔ پیش‌فرض هر پلتفرم «بدون دسته» است.
زمان‌ها Unix timestamp (ثانیه) هستند. نسخهٔ ساختار در `PRAGMA user_version` ذخیره می‌شود (الان ۲).

## نمونه کوئری

    SELECT g.platform, k.name AS category, g.name
    FROM games g JOIN categories k ON k.id = g.category_id
    WHERE g.platform = 'ps5'
    ORDER BY k.position, g.name;

## بیرون کشیدن عکس‌ها با Python

    import sqlite3, os
    c = sqlite3.connect("data/catalog.db")
    os.makedirs("out", exist_ok=True)
    for gid, name, img in c.execute("SELECT id, name, image FROM games"):
        open(f"out/{gid}.jpg", "wb").write(img)

## نمایش عکس در سایت دیگر

اگر سایت جدید دیتابیس را مستقیم می‌خواند، ستون `image` را با هدر `Content-Type: image/jpeg` برگردان.
اگر ترجیح می‌دهی عکس‌ها فایل جدا باشند، از «خروجی ZIP» استفاده کن.

## خروجی ZIP (برای سیستم‌هایی که SQLite ندارند)

داخل ZIP فایل `catalog.json` و پوشهٔ `images/` است:

    {"categories": [{"platform": "ps4", "name": "ورزشی"}, ...],
     "games": [{"id": "...", "name": "...", "platform": "ps4", "category": "...", "image": "images/<id>.jpg"}]}

## بازیابی

در پنل مدیریت، «بازیابی از فایل .db» همهٔ اطلاعات فعلی را با فایل انتخاب‌شده جایگزین می‌کند.
قبل از جایگزینی، نسخهٔ فعلی در `data/catalog.before-import.db` ذخیره می‌شود.

## ارتقا از نسخهٔ بدون PS4/PS5

اگر دیتابیس یا پشتیبان قدیمی‌ات پلتفرم نداشت، موقع اجرا (یا بازیابی) خودکار ارتقا پیدا می‌کند و
همهٔ بازی‌ها و دسته‌های قبلی در **PS4** قرار می‌گیرند. بعداً با دکمهٔ «به PS5» کنار هر بازی در پنل مدیریت می‌توانی جابه‌جایشان کنی.

## نسخهٔ قدیمی (JSON)

اگر قبلاً `data/games.json` و پوشهٔ `data/img` داشتی، اولین اجرای نسخهٔ جدید همه را خودکار به دیتابیس منتقل می‌کند
(فایل‌های قدیمی به `.bak` تغییر نام می‌دهند و پاک نمی‌شوند).
