import { Container } from "@/components/layout/container";

export default function PartnerTournamentsLayout({ children }: LayoutProps<"/partner/tournaments">) {
  return <Container className="py-8 sm:py-12">{children}</Container>;
}
