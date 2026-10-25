import type { ChatMessage } from "./constants";

/** Adds new messages, ignoring ones already shown (polling uses an inclusive cursor). Keeps time order. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return current;
  const seen = new Set(current.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  return added.length ? [...current, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : current;
}
