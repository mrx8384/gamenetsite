import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";

export default function SettingsLayout({ children }: LayoutProps<"/admin/settings">) {
  return (
    <>
      <AdminPageHeader title="تنظیمات سایت" description="همهٔ متن‌ها و اطلاعات سایت از این بخش قابل ویرایش است." />
      <SettingsTabs />
      {children}
    </>
  );
}
