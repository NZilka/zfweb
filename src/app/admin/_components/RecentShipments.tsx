/**
 * RecentShipments - Display list of recently shipped orders
 * Shows order ID, customer name, total, and ship date
 */
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { RecentOrder } from "~/server/analytics-queries";

interface RecentShipmentsProps {
  shipments: RecentOrder[];
}

export function RecentShipments({ shipments }: RecentShipmentsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Shipments</CardTitle>
      </CardHeader>
      <CardContent>
        {shipments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shipments yet</p>
        ) : (
          <div className="space-y-4">
            {shipments.map((shipment) => (
              <div
                key={shipment.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  {/* Order ID and customer name */}
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Order #{shipment.id}</p>
                    <Badge variant="secondary" className="text-xs">
                      Shipped
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{shipment.customerName}</p>
                </div>
                <div className="text-right">
                  {/* Order total */}
                  <p className="text-sm font-medium">${shipment.total}</p>
                  {/* Ship date */}
                  <p className="text-xs text-muted-foreground">
                    {new Date(shipment.createdAt).toLocaleDateString()}
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
