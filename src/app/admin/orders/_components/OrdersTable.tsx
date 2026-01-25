/**
 * OrdersTable - Display table of orders with expandable rows
 * Shows order details, line items, and fulfillment controls
 */
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PackingSlip } from "./PackingSlip";
import { OrderStatusActions } from "./OrderStatusActions";
import type { OrderWithItems } from "~/server/admin-queries";

interface OrdersTableProps {
  orders: OrderWithItems[];
  showSelection?: boolean;
  selectedOrders?: Set<number>;
  onSelectionChange?: (selected: Set<number>) => void;
}

export function OrdersTable({
  orders,
  showSelection = false,
  selectedOrders = new Set(),
  onSelectionChange,
}: OrdersTableProps) {
  // Track which orders have expanded item lists
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  // Toggle order expansion
  const toggleExpanded = (orderId: number) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  // Toggle single order selection
  const toggleSelection = (orderId: number) => {
    if (!onSelectionChange) return;
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    onSelectionChange(newSelected);
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedOrders.size === orders.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(orders.map((o) => o.id)));
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get status badges for an order
  const getStatusBadges = (order: OrderWithItems) => {
    const badges = [];
    if (order.isDownloaded) {
      badges.push(
        <Badge key="downloaded" variant="outline" className="text-xs">
          Downloaded
        </Badge>
      );
    }
    if (order.isPacked) {
      badges.push(
        <Badge key="packed" variant="outline" className="text-xs">
          Packed
        </Badge>
      );
    }
    if (order.isShipped) {
      badges.push(
        <Badge key="shipped" variant="default" className="text-xs">
          Shipped
        </Badge>
      );
    }
    return badges;
  };

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted p-8 text-center">
        <p className="text-muted-foreground">No orders in this category</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Selection checkbox column */}
            {showSelection && (
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedOrders.size === orders.length && orders.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all orders"
                />
              </TableHead>
            )}
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <>
              {/* Main order row */}
              <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                {/* Selection checkbox */}
                {showSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedOrders.has(order.id)}
                      onCheckedChange={() => toggleSelection(order.id)}
                      aria-label={`Select order ${order.id}`}
                    />
                  </TableCell>
                )}
                {/* Expand/collapse button */}
                <TableCell onClick={() => toggleExpanded(order.id)}>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {expandedOrders.has(order.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                {/* Order ID */}
                <TableCell onClick={() => toggleExpanded(order.id)} className="font-medium">
                  #{order.id}
                </TableCell>
                {/* Customer */}
                <TableCell onClick={() => toggleExpanded(order.id)}>
                  <div>
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                  </div>
                </TableCell>
                {/* Items count */}
                <TableCell onClick={() => toggleExpanded(order.id)}>
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </TableCell>
                {/* Total */}
                <TableCell onClick={() => toggleExpanded(order.id)} className="font-medium">
                  ${order.total}
                </TableCell>
                {/* Date */}
                <TableCell onClick={() => toggleExpanded(order.id)}>
                  {formatDate(order.createdAt)}
                </TableCell>
                {/* Status badges */}
                <TableCell>
                  <div className="flex flex-wrap gap-1">{getStatusBadges(order)}</div>
                </TableCell>
              </TableRow>

              {/* Expanded items row */}
              {expandedOrders.has(order.id) && (
                <TableRow key={`${order.id}-items`} className="bg-muted/50">
                  <TableCell colSpan={showSelection ? 8 : 7} className="p-4">
                    <div className="grid gap-6 lg:grid-cols-3">
                      {/* Order Items */}
                      <div className="lg:col-span-2">
                        <p className="mb-2 text-sm font-medium text-muted-foreground">Order Items</p>
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded bg-card p-2"
                            >
                              <div className="flex items-center gap-3">
                                {/* Product thumbnail */}
                                {item.product.imgUrl[0] && (
                                  <img
                                    src={item.product.imgUrl[0]}
                                    alt={item.product.title}
                                    className="h-10 w-10 rounded object-cover"
                                  />
                                )}
                                <div>
                                  <p className="font-medium">{item.product.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Qty: {item.quantity} × ${item.product.price}
                                  </p>
                                </div>
                              </div>
                              <p className="font-medium">
                                ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Fulfillment Actions */}
                      <div className="space-y-4">
                        <div>
                          <p className="mb-2 text-sm font-medium text-muted-foreground">Fulfillment</p>
                          <div className="rounded bg-card p-3">
                            <OrderStatusActions order={order} />
                          </div>
                        </div>

                        {/* Packing Slip Print Button */}
                        <div>
                          <p className="mb-2 text-sm font-medium text-muted-foreground">Actions</p>
                          <PackingSlip order={order} />
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
