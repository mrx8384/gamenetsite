import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { getCurrentUser } from "@/lib/auth/dal";

/** Already signed-in visitors are sent to their account. */
async function GuestOnly({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/account");
  return <>{children}</>;
}

export function AuthCard({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoadingRows rows={3} />}>
          <GuestOnly>{children}</GuestOnly>
        </Suspense>
        {footer ? <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
