/**
 * PackingSlip - Print-optimized packing slip for orders
 * Displays order details and items for fulfillment
 * Uses portal to render outside admin layout's print:hidden wrapper
 */
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "~/components/ui/button";
import { Printer } from "lucide-react";
import type { OrderWithItems } from "~/server/admin-queries";

interface PackingSlipProps {
  order: OrderWithItems;
}

// Parse shipping address from JSON string
interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export function PackingSlip({ order }: PackingSlipProps) {
  // Track if we're mounted (for portal rendering)
  const [mounted, setMounted] = useState(false);

  // Set mounted on client side for portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Parse shipping address
  let address: ShippingAddress = {};
  try {
    address = JSON.parse(order.shippingAddress) as ShippingAddress;
  } catch {
    // Use empty address if parse fails
  }

  // Format date
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Print handler - opens print dialog
  const handlePrint = () => {
    window.print();
  };

  // Packing slip content component - rendered via portal to avoid print:hidden parent
  const packingSlipContent = (
    <div className="hidden print:block">
      <style jsx>{`
        @media print {
          @page {
            margin: 0.5in;
          }
        }
      `}</style>

      <div className="packing-slip bg-white p-4 text-black">
          {/* Header */}
          <div className="mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold">Zilka Forgewerks</h1>
            <p className="text-sm text-gray-500">Packing Slip</p>
          </div>

          {/* Order info */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Order Number</p>
              <p className="font-bold">#{order.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Order Date</p>
              <p className="font-bold">{orderDate}</p>
            </div>
          </div>

          {/* Ship to */}
          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-gray-500">SHIP TO:</p>
            <div className="rounded border p-3">
              <p className="font-bold">{order.customerName}</p>
              <p>{address.address1}</p>
              {address.address2 && <p>{address.address2}</p>}
              <p>
                {address.city}, {address.state} {address.zipCode}
              </p>
              <p>{address.country}</p>
            </div>
          </div>

          {/* Items table - price column hidden for gift orders */}
          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-gray-500">ITEMS:</p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Product</th>
                  <th className="py-2 text-right">Qty</th>
                  {/* Only show price column if not a gift order */}
                  {!order.isGift && <th className="py-2 text-right">Price</th>}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.product.title}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    {/* Only show price if not a gift order */}
                    {!order.isGift && (
                      <td className="py-2 text-right">
                        ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Order total - hidden for gift orders */}
          {!order.isGift && (
            <div className="mb-6 border-t pt-4">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${parseFloat(order.total).toFixed(2)}</span>
              </div>
            </div>
          )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Thank you for your order!</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Print button - hidden when printing */}
      <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2 print:hidden">
        <Printer className="h-4 w-4" />
        Print Packing Slip
      </Button>

      {/* Render packing slip via portal to modal-root (outside print:hidden wrapper) */}
      {mounted && createPortal(packingSlipContent, document.getElementById("modal-root")!)}
    </>
  );
}
