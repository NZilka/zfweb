/**
 * OrdersTable - Display table of orders with expandable rows
 * Shows order details, line items, and fulfillment controls
 */
"use client";

import { useState, Fragment } from "react";
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
    // Test-order badge first so it's the most prominent signal when shown
    if (order.isTest) {
      badges.push(
        <Badge key="test" variant="destructive" className="text-xs">
          TEST
        </Badge>
      );
    }
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
      // Empty state with white background and gray text
      <div className="rounded-lg border border-gray-300 bg-white p-8 text-center">
        <p className="text-gray-500">No orders in this category</p>
      </div>
    );
  }

  return (
    // Container with white background, horizontal scroll on mobile
    <div className="rounded-lg border border-gray-300 bg-white text-gray-900 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Selection checkbox column - hidden on mobile */}
            {showSelection && (
              <TableHead className="w-[50px] hidden sm:table-cell">
                <Checkbox
                  checked={selectedOrders.size === orders.length && orders.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all orders"
                />
              </TableHead>
            )}
            <TableHead className="w-[40px] sm:w-[50px]"></TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            {/* Items count - hidden on mobile */}
            <TableHead className="hidden md:table-cell">Items</TableHead>
            <TableHead>Total</TableHead>
            {/* Date - hidden on mobile */}
            <TableHead className="hidden lg:table-cell">Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <Fragment key={order.id}>
              {/* Main order row - hover uses light gray */}
              <TableRow className="cursor-pointer hover:bg-gray-100">
                {/* Selection checkbox - hidden on mobile */}
                {showSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()} className="hidden sm:table-cell">
                    <Checkbox
                      checked={selectedOrders.has(order.id)}
                      onCheckedChange={() => toggleSelection(order.id)}
                      aria-label={`Select order ${order.id}`}
                    />
                  </TableCell>
                )}
                {/* Expand/collapse button */}
                <TableCell onClick={() => toggleExpanded(order.id)} className="p-2 sm:p-4">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {expandedOrders.has(order.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                {/* Order ID */}
                <TableCell onClick={() => toggleExpanded(order.id)} className="font-medium p-2 sm:p-4">
                  #{order.id}
                </TableCell>
                {/* Customer - truncate on mobile */}
                <TableCell onClick={() => toggleExpanded(order.id)} className="p-2 sm:p-4">
                  <div className="max-w-[120px] sm:max-w-none">
                    <p className="font-medium truncate">{order.customerName}</p>
                    <p className="text-sm text-gray-500 truncate hidden sm:block">{order.customerEmail}</p>
                  </div>
                </TableCell>
                {/* Items count - hidden on mobile */}
                <TableCell onClick={() => toggleExpanded(order.id)} className="hidden md:table-cell">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </TableCell>
                {/* Total */}
                <TableCell onClick={() => toggleExpanded(order.id)} className="font-medium p-2 sm:p-4">
                  ${order.total}
                </TableCell>
                {/* Date - hidden on mobile */}
                <TableCell onClick={() => toggleExpanded(order.id)} className="hidden lg:table-cell">
                  {formatDate(order.createdAt)}
                </TableCell>
                {/* Status badges */}
                <TableCell className="p-2 sm:p-4">
                  <div className="flex flex-wrap gap-1">{getStatusBadges(order)}</div>
                </TableCell>
              </TableRow>

              {/* Expanded items row - light gray background */}
              {expandedOrders.has(order.id) && (
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={showSelection ? 8 : 7} className="p-4">
                    <div className="grid gap-6 lg:grid-cols-3">
                      {/* Order Items */}
                      <div className="lg:col-span-2">
                        <p className="mb-2 text-sm font-medium text-gray-500">Order Items</p>
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded bg-white p-2 border border-gray-200"
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
                                  <p className="text-sm text-gray-500">
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
                          <p className="mb-2 text-sm font-medium text-gray-500">Fulfillment</p>
                          <div className="rounded bg-white p-3 border border-gray-200">
                            <OrderStatusActions order={order} />
                          </div>
                        </div>

                        {/* Packing Slip Print Button */}
                        <div>
                          <p className="mb-2 text-sm font-medium text-gray-500">Actions</p>
                          <PackingSlip order={order} />
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
