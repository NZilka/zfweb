"use client";

import { Button } from "~/components/ui/button";

// Client component for print functionality
export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      Print Receipt
    </Button>
  );
}
