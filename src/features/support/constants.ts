/** Online support chat (owner request 2026-10-25). Logged-in users only; answered by ADMIN or SUPPORT staff. */
export const SUPPORT_MAX_LENGTH = 2000;
/** Messages returned when a thread is opened. */
export const SUPPORT_HISTORY_LIMIT = 100;

/** Polling intervals (ms). Polling pauses while the tab is hidden. */
export const POLL_OPEN_MS = 4_000;
export const POLL_CLOSED_MS = 25_000;
export const POLL_STAFF_BADGE_MS = 15_000;

/** A user counts as "on the site" if their widget polled within this window; otherwise a reply is sent to them by SMS/email. */
export const USER_ONLINE_WINDOW_MS = 90_000;
/** Minimum gap between notification SMS/emails for one conversation. */
export const NOTIFY_THROTTLE_MS = 15 * 60_000;

/** Window event that opens the chat widget (e.g. from the contact page). */
export const OPEN_SUPPORT_EVENT = "atom:open-support";

export const SUPPORT_STAFF_ROLES = ["ADMIN", "SUPPORT"] as const;

export interface ChatMessage {
  id: string;
  body: string;
  fromStaff: boolean;
  /** Staff name for the admin view; null on the customer side. */
  senderName: string | null;
  createdAt: string;
}
