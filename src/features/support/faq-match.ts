import { toEnglishDigits } from "@/lib/format";
import { normalizePersian } from "@/lib/text";

/**
 * FAQ suggestions without external AI: keyword overlap with light Persian normalization and
 * stemming, scored against the question, admin keywords and the answer. Pure → runs in the browser.
 */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  keywords: string;
}

/** Common Persian (and a few English) words that carry no meaning for matching. */
const STOPWORDS = new Set(
  (
    "و در به از که این آن را با برای تا یا هم اما اگر چه چی چرا چطور چگونه چطوری کجا کی کدام آیا " +
    "است هست نیست هستند بود باشد شود شد میشه میشود می‌شود نمیشه کنم کنید کرد کردم کنیم داره دارد دارم دارید " +
    "من ما شما او ایشان اون این‌ها آن‌ها یک یه هر همه خیلی فقط لطفا لطفاً سلام ممنون مرسی باید بشه " +
    "رو می نمی ها های هایم هایت هایش ای ام اش ات اید اند چقدر چند کجاست the a an is are to of and or for how what can i do"
  ).split(/\s+/),
);

const PLURAL = ["های", "ها", "ترین", "تر", "ات", "ی"];
/** Multi-letter possessive endings are stripped while tokenizing (سفارشمان → سفارش). */
const POSSESSIVE = ["مان", "تان", "شان"];
/** Single-letter endings (م/ت/ش) also end ordinary words (سفارش), so they are handled when comparing. */
const SHORT_ENDINGS = ["م", "ت", "ش", "ی"];

function strip(w: string, list: string[]): string {
  for (const s of list) if (w.length - s.length >= 3 && w.endsWith(s)) return w.slice(0, -s.length);
  return w;
}

/** Normalizes text and splits it into meaningful, lightly stemmed tokens. */
export function tokenize(text: string): string[] {
  const clean = normalizePersian(toEnglishDigits(text))
    .toLowerCase()
    .replace(/‌/g, " ") // ZWNJ → space ("می‌شود" → "می شود")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ");
  const out: string[] = [];
  for (let w of clean.split(/\s+/)) {
    if (!w || STOPWORDS.has(w)) continue;
    if (w.startsWith("نمی") && w.length > 5) w = w.slice(3);
    else if (w.startsWith("می") && w.length > 4) w = w.slice(2);
    w = strip(strip(w, POSSESSIVE), PLURAL);
    if (w.length >= 2 && !STOPWORDS.has(w)) out.push(w);
  }
  return out;
}

interface Indexed {
  item: FaqItem;
  question: Set<string>;
  keywords: Set<string>;
  answer: Set<string>;
}

export function indexFaqs(items: FaqItem[]): Indexed[] {
  return items.map((item) => ({
    item,
    question: new Set(tokenize(item.question)),
    keywords: new Set(tokenize(item.keywords)),
    answer: new Set(tokenize(item.answer)),
  }));
}

/** Same word, possibly with a one-letter ending: سفارشم ~ سفارش, پسوردم ~ پسورد. */
function same(a: string, b: string): boolean {
  if (a === b) return true;
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.length === short.length + 1 && long.startsWith(short) && SHORT_ENDINGS.includes(long.slice(-1));
}

function hit(set: Set<string>, token: string): number {
  if (set.has(token)) return 1;
  for (const t of set) if (same(t, token)) return 1;
  if (token.length < 3) return 0;
  // Partial match for longer words ("ارسال" ~ "ارسالی", "گارانتی" ~ "گارانت").
  for (const t of set) if (t.length >= 3 && (t.startsWith(token) || token.startsWith(t))) return 0.6;
  return 0;
}

/**
 * Best matches for what the user typed. Score = matched question/keyword tokens (×3) + answer
 * tokens (×1), averaged over the query tokens (filler words lower it only a little).
 */
export function matchFaqs(index: Indexed[], query: string, limit = 3): FaqItem[] {
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0) return [];
  const scored = index
    .map((e) => {
      let score = 0;
      let strong = 0;
      for (const t of tokens) {
        const q = Math.max(hit(e.question, t), hit(e.keywords, t));
        if (q > 0) strong++;
        score += q * 3 + hit(e.answer, t);
      }
      return { item: e.item, score: score / tokens.length, strong };
    })
    // At least one question/keyword hit, and a minimum average relevance.
    .filter((s) => s.strong > 0 && s.score >= 0.8)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
