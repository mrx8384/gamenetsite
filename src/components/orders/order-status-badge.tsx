import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT, type OrderStatusKey } from "@/features/orders/schemas";

export function OrderStatusBadge({ status }: { status: OrderStatusKey }) {
  return <Badge variant={ORDER_STATUS_VARIANT[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
