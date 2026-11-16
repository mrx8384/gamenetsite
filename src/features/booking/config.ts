import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { bookingConfigSchema, type BookingConfig } from "./schemas";

export const BOOKING_CONFIG_KEY = "bookingConfig";

/** Numbers of the booking system (Admin → رزرو → تنظیمات). Texts live in site settings group "booking". */
export async function getBookingConfig(): Promise<BookingConfig> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);
  const row = await db.siteSetting.findUnique({ where: { key: BOOKING_CONFIG_KEY } });
  const parsed = bookingConfigSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : bookingConfigSchema.parse({});
}
