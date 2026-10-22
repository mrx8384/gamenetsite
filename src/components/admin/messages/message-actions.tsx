"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, MailOpen, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { deleteMessage, setMessageStatus } from "@/features/contact/admin-actions";

export function MessageActions({ id, status }: { id: string; status: "NEW" | "READ" | "ARCHIVED" }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const marked = React.useRef(false);
  // Opening a new message marks it as read.
  React.useEffect(() => {
    if (status === "NEW" && !marked.current) {
      marked.current = true;
      void setMessageStatus(id, "READ").then(() => router.refresh());
    }
  }, [id, status, router]);
  const run = (s: "NEW" | "READ" | "ARCHIVED") =>
    startTransition(async () => {
      const res = await setMessageStatus(id, s);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "NEW" ? <Button variant="outline" size="sm" disabled={pending} onClick={() => run("NEW")}><Mail /> علامت نخوانده</Button> : <Button variant="outline" size="sm" disabled={pending} onClick={() => run("READ")}><MailOpen /> علامت خوانده</Button>}
      {status !== "ARCHIVED" ? <Button variant="outline" size="sm" disabled={pending} onClick={() => run("ARCHIVED")}><Archive /> بایگانی</Button> : null}
      <DeleteButton label="حذف" title="حذف این پیام؟" description="این عمل قابل بازگشت نیست." action={deleteMessage.bind(null, id)} redirectTo="/admin/messages" />
    </div>
  );
}
