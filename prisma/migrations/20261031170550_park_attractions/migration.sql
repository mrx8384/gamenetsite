-- CreateTable
CREATE TABLE "park_attractions" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "imageId" TEXT,
    "staticImage" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "park_attractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "park_attractions_isActive_sortOrder_idx" ON "park_attractions"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "park_attractions" ADD CONSTRAINT "park_attractions_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starting content, taken from the 3D world «دنیای سه‌بعدی اتم» (src/atom-world/data/machineData.ts) and its photos.
-- Editable afterwards in Admin → تنظیمات سایت → شهربازی اتم گیم.
INSERT INTO "park_attractions" ("id", "title", "description", "staticImage", "sortOrder", "updatedAt") VALUES
('park-gamenet', 'گیم‌نت اتم (پلی‌استیشن ۵ و ۴)', 'گیم‌نت مجموعه در زیرزمین است: سیستم ۱ با پلی‌استیشن ۵ و سیستم‌های ۲ تا ۱۳ با پلی‌استیشن ۴. هر سیستم یک تلویزیون و مبل یا صندلی دارد و دیوارهای سالن با نقاشی‌های قصر، پاریس و اتاق قطار تزئین شده‌اند. ورودی گیم‌نت از درِ زیر تابلوی نارنجی «اتم گیم کلاب» است.', '/atom-world/envs/gaming-center/photos/10-long-view-paris-cafe-london.webp', 1, CURRENT_TIMESTAMP),
('park-air-hockey', 'ایرهاکی', 'میزهای ایرهاکی طبقهٔ همکف مجموعه با سطح بادی سفید، نورپردازی LED دور میز و تابلوی امتیاز روی کمان وسط. بازی دونفره است: هر بازیکن با دستهٔ خود دیسک را به سمت دروازهٔ حریف می‌زند.', '/atom-world/photos/air-hockey-left-wall.webp', 2, CURRENT_TIMESTAMP),
('park-foot-pool', 'فوت‌پول (بیلیارد فوتبالی)', 'زمین بزرگ بیلیارد در طبقهٔ دوم با فرش سرمه‌ای، دیواره‌های سفید با رویهٔ خاکستری و شش جیب با نورپردازی نارنجی. در این بازی توپ‌ها با ضربهٔ پا به سمت جیب‌ها زده می‌شوند.', '/atom-world/photos/foot-pool-field-and-mural.webp', 3, CURRENT_TIMESTAMP),
('park-footballs', 'میز بازی FOOTBALLS', 'دو میز بازی FOOTBALLS در طبقهٔ دوم با بدنهٔ فلزی مشکی، قفس و تور محافظ، نشیمن‌های قرمز و تابلوی امتیاز دستی.', '/atom-world/photos/footballs-tables-gray-sofa.webp', 4, CURRENT_TIMESTAMP),
('park-rc-club', 'دنیای ماشین‌آلات راه‌سازی (RC کلاب)', 'محوطهٔ خاکی محصور با بیل‌های مکانیکی و کامیون‌های کنترلی کوچک، مسیرهای خاکی، جدول‌ها، فضای دایره‌ای وسط و پل چوبی کوچک؛ روی دیوار اصلی نقاشی بزرگ بیل مکانیکی زرد و نارنجی کشیده شده است.', '/atom-world/photos/construction-zone.webp', 5, CURRENT_TIMESTAMP),
('park-face-paint', 'گریم صورت کودکان', 'میز آرایش با آینهٔ چراغ‌دار روی فرش گوشهٔ کودکان: بچه‌ها طرح دلخواهشان (ستاره، قلب، پروانه، گربه، رنگین‌کمان، ببر یا گل) را انتخاب می‌کنند و روی صورتشان نقاشی می‌شود.', NULL, 6, CURRENT_TIMESTAMP),
('park-shop', 'پیشخوان و فروشگاه اتم', 'پیشخوان مجموعه در طبقهٔ همکف، کنار راه‌پله، با لوگوی بزرگ اتم، قفسهٔ اسباب‌بازی‌ها و یخچال نوشیدنی. محصولات فروشگاه اتم را در فروشگاه آنلاین سایت هم می‌توانید ببینید.', '/atom-world/photos/hall-overview.webp', 7, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
