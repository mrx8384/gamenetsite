import { sessionDELETE, sessionGET, sessionPOST } from "@/atom-world/server/adminAuth";

/** The editor's login (the handlers live with the login itself: server/adminAuth.ts). */
export function GET(req: Request) {
  return sessionGET(req);
}

export function POST(req: Request) {
  return sessionPOST(req);
}

export function DELETE(req: Request) {
  return sessionDELETE(req);
}
