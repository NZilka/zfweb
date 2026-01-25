/**
 * CsvExportButton - Downloads selected orders as Pirate Ship CSV
 * Triggers file download and marks orders as downloaded
 */
"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { generatePirateShipCsv } from "~/server/admin-actions";

interface CsvExportButtonProps {
  selectedOrderIds: number[];
  disabled?: boolean;
}

export function CsvExportButton({ selectedOrderIds, disabled }: CsvExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error("No orders selected");
      return;
    }

    setIsExporting(true);
    try {
      // Generate CSV on server (also marks orders as downloaded)
      const result = await generatePirateShipCsv(selectedOrderIds);

      if (!result.success || !result.csv) {
        toast.error(result.error || "Failed to generate CSV");
        return;
      }

      // Create blob and trigger download
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Generate filename with date
      const date = new Date().toISOString().split("T")[0];
      link.download = `pirate-ship-orders-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success message
      toast.success(`Downloaded ${result.downloadedCount} orders for shipping`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export orders");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || selectedOrderIds.length === 0 || isExporting}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      {isExporting
        ? "Exporting..."
        : `Download for Shipping (${selectedOrderIds.length})`}
    </Button>
  );
}
