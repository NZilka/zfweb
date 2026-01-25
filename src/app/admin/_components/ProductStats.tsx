/**
 * ProductStats - Table displaying per-product sales statistics
 * Shows product name, views (from PostHog), units sold, and revenue
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { ProductSalesStats } from "~/server/analytics-queries";

interface ProductStatsProps {
  stats: ProductSalesStats[];
  productViews?: Map<number, number>; // Optional PostHog view counts
}

export function ProductStats({ stats, productViews }: ProductStatsProps) {
  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    // Card with white background and black text
    <Card className="bg-white text-gray-900 border-gray-300">
      <CardHeader>
        <CardTitle>Product Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-sm text-gray-500">No product sales data available</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-gray-600">Product</TableHead>
                <TableHead className="text-right text-gray-600">Views</TableHead>
                <TableHead className="text-right text-gray-600">Sold</TableHead>
                <TableHead className="text-right text-gray-600">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((stat) => (
                <TableRow key={stat.productId}>
                  {/* Product name - truncate long titles */}
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {stat.productTitle}
                  </TableCell>
                  {/* Views from PostHog, show dash if not available */}
                  <TableCell className="text-right text-gray-500">
                    {productViews?.get(stat.productId) ?? "-"}
                  </TableCell>
                  {/* Units sold */}
                  <TableCell className="text-right">{stat.unitsSold}</TableCell>
                  {/* Revenue */}
                  <TableCell className="text-right font-medium">
                    {formatCurrency(stat.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
