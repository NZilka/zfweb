/**
 * RecentOrders - Display list of recent paid orders
 * Shows order ID, customer name, total, and date
 */
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { RecentOrder } from "~/server/analytics-queries";

interface RecentOrdersProps {
  orders: RecentOrder[];
  title?: string;
}

export function RecentOrders({ orders, title = "Recent Orders" }: RecentOrdersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  {/* Order ID and customer name */}
                  <p className="text-sm font-medium">Order #{order.id}</p>
                  <p className="text-xs text-muted-foreground">{order.customerName}</p>
                </div>
                <div className="text-right">
                  {/* Order total */}
                  <p className="text-sm font-medium">${order.total}</p>
                  {/* Date formatted */}
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
