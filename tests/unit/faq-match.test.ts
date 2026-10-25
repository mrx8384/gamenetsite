import { describe, expect, it } from "vitest";
import { indexFaqs, matchFaqs, tokenize, type FaqItem } from "@/features/support/faq-match";

const faqs: FaqItem[] = [
  { id: "ship", question: "سفارشم چند روزه ارسال می‌شود؟", answer: "سفارش‌ها ۱ تا ۳ روز کاری بعد از پرداخت با پست یا تیپاکس ارسال می‌شوند.", keywords: "ارسال پست تیپاکس تحویل زمان" },
  { id: "track", question: "چطور سفارشم را پیگیری کنم؟", answer: "از حساب کاربری ← سفارش‌های من، کد رهگیری مرسوله را ببینید.", keywords: "رهگیری پیگیری کد مرسوله" },
  { id: "warranty", question: "محصولات گارانتی دارند؟", answer: "همهٔ دسته‌ها ۶ ماه گارانتی تعویض دارند.", keywords: "گارانتی ضمانت خرابی تعویض" },
  { id: "hours", question: "ساعت کاری گیم‌نت چیست؟", answer: "هر روز از ۱۰ صبح تا ۱۲ شب باز هستیم.", keywords: "ساعت باز تعطیل گیم نت" },
  { id: "password", question: "رمز عبورم را فراموش کرده‌ام", answer: "در صفحهٔ ورود روی «فراموشی رمز» بزنید و کد تأیید را وارد کنید.", keywords: "رمز پسورد ورود فراموشی" },
];
const index = indexFaqs(faqs);
const top = (q: string) => matchFaqs(index, q)[0]?.id;

describe("tokenize", () => {
  it("normalizes Arabic letters, digits, ZWNJ and drops stop words", () => {
    expect(tokenize("كي سفارش ارسال ميشه؟")).toEqual(["سفارش", "ارسال"]);
    expect(tokenize("سلام، لطفاً بگید")).not.toContain("سلام");
    expect(tokenize("۱۲۳ PS5")).toEqual(["123", "ps5"]);
  });
  it("lightly stems plurals, possessives and verb prefixes the same way for FAQs and queries", () => {
    expect(tokenize("دسته‌ها")).toEqual(["دسته"]);
    expect(tokenize("سفارش‌هایم")).toEqual(["سفارش"]);
    expect(tokenize("سفارشمان")).toEqual(["سفارش"]);
    expect(tokenize("نمی‌خواهم")).toEqual(tokenize("می‌خواهم"));
  });
});

describe("matchFaqs", () => {
  it("finds the right answer for natural questions", () => {
    expect(top("کی سفارشم میرسه؟ ارسالش چقدر طول میکشه")).toBe("ship");
    expect(top("کد رهگیری پستم کجاست")).toBe("track");
    expect(top("دسته خراب شد گارانتی داره؟")).toBe("warranty");
    expect(top("گیم نت تا ساعت چند بازه")).toBe("hours");
    expect(top("پسوردم یادم رفته")).toBe("password");
  });
  it("treats one-letter possessive endings as the same word", () => {
    expect(top("پسوردم")).toBe("password");
    expect(top("سفارشم ارسال")).toBe("ship");
  });
  it("works with Arabic keyboard letters", () => {
    expect(top("گارانتي دارين؟")).toBe("warranty");
  });
  it("returns nothing for unrelated or empty text", () => {
    expect(matchFaqs(index, "سلام")).toEqual([]);
    expect(matchFaqs(index, "")).toEqual([]);
    expect(matchFaqs(index, "قیمت لپ تاپ ایسوس")).toEqual([]);
  });
  it("limits the number of suggestions", () => {
    expect(matchFaqs(index, "سفارش ارسال پیگیری رهگیری گارانتی رمز ساعت", 2)).toHaveLength(2);
  });
});
