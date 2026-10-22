"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const demoSchema = z.object({
  name: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد"),
  email: z.email("ایمیل معتبر نیست"),
});

export function InteractiveDemos() {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const form = useForm<z.infer<typeof demoSchema>>({
    resolver: zodResolver(demoSchema),
    defaultValues: { name: "", email: "" },
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast.success("با موفقیت ذخیره شد")}>
            اعلان موفق
          </Button>
          <Button variant="outline" onClick={() => toast.error("خطا در ذخیره‌سازی")}>
            اعلان خطا
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">باز کردن دیالوگ</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>عنوان دیالوگ</DialogTitle>
                <DialogDescription>متن توضیحی دیالوگ برای کاربر.</DialogDescription>
              </DialogHeader>
              <Input placeholder="یک ورودی نمونه" />
              <DialogFooter>
                <Button>ذخیره</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            حذف (با تأیید)
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            destructive
            title="این مورد حذف شود؟"
            description="این عمل قابل بازگشت نیست."
            confirmLabel="بله، حذف شود"
            onConfirm={async () => {
              await new Promise((r) => setTimeout(r, 800));
              toast.success("حذف شد (نمایشی)");
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Form {...form}>
            <form
              noValidate
              className="grid gap-4"
              onSubmit={form.handleSubmit((values) => toast.success(`فرم معتبر است: ${values.name}`))}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ایمیل</FormLabel>
                    <FormControl>
                      <Input type="email" dir="ltr" className="text-start" {...field} />
                    </FormControl>
                    <FormDescription>اعتبارسنجی با Zod و React Hook Form</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="justify-self-start">
                ارسال
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
