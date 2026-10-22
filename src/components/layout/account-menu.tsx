import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { AccountDropdown } from "./account-dropdown";

/** Header account area. Reads the session → rendered inside <Suspense>. */
export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Button asChild size="sm" variant="strong">
        <Link href="/login">
          <LogIn /> <span className="hidden sm:inline">ورود / ثبت‌نام</span>
          <span className="sm:hidden">ورود</span>
        </Link>
      </Button>
    );
  }
  return <AccountDropdown name={user.name} role={user.role} />;
}
