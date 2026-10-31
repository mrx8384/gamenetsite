import { connection } from "next/server";
import { googleEnabled } from "@/features/auth/google";
import { GoogleButton } from "./google-button";

/** «ادامه با گوگل» — shown only when GOOGLE_CLIENT_ID/SECRET are set (read per request, so a restart is enough). */
export async function GoogleSignIn() {
  await connection();
  if (!googleEnabled()) return null;
  return <GoogleButton />;
}
