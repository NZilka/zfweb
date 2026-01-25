/**
 * CategoryStats - Table displaying per-category sales statistics
 * Shows category name, views (from PostHog), units sold, and revenue
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
import type { CategorySalesStats } from "~/server/analytics-queries";

interface CategoryStatsProps {
  stats: CategorySalesStats[];
  categoryViews?: Map<number, number>; // Optional PostHog view counts
}

export function CategoryStats({ stats, categoryViews }: CategoryStatsProps) {
  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No category sales data available</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((stat, index) => (
                <TableRow key={stat.categoryId ?? `uncategorized-${index}`}>
                  {/* Category name */}
                  <TableCell className="font-medium">{stat.categoryName}</TableCell>
                  {/* Views from PostHog, show dash if not available */}
                  <TableCell className="text-right text-muted-foreground">
                    {stat.categoryId && categoryViews?.get(stat.categoryId)
                      ? categoryViews.get(stat.categoryId)
                      : "-"}
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
