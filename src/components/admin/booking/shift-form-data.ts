import { PAYMENT_MODES, type PaymentMode } from "@/features/booking/rules";

export interface ShiftFormData {
  id?: string;
  title: string;
  weekdays: number[];
  start: string;
  end: string;
  capacity: string;
  priceToman: string;
  paymentMode: PaymentMode;
  depositPercent: string;
  description: string;
  isActive: boolean;
  sortOrder: string;
}

const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const toShiftForm = (s: { id: string; title: string; weekdays: number[]; startMinute: number; endMinute: number; capacity: number; price: string; paymentMode: string; depositPercent: number | null; description: string | null; isActive: boolean; sortOrder: number }): ShiftFormData => ({
  id: s.id,
  title: s.title,
  weekdays: s.weekdays,
  start: hhmm(s.startMinute),
  end: hhmm(s.endMinute),
  capacity: String(s.capacity),
  priceToman: (BigInt(s.price) / BigInt(10)).toString(),
  paymentMode: (PAYMENT_MODES as readonly string[]).includes(s.paymentMode) ? (s.paymentMode as PaymentMode) : "ON_SITE",
  depositPercent: String(s.depositPercent ?? 30),
  description: s.description ?? "",
  isActive: s.isActive,
  sortOrder: String(s.sortOrder),
});
