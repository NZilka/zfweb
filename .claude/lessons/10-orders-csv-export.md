# Lesson: Orders CSV Export for Pirate Ship

## What We Built
Implemented CSV export functionality that generates Pirate Ship-compatible shipping label data and marks orders as downloaded.

## Why This Approach

**Pirate Ship format:** Pirate Ship is a popular shipping label service that accepts CSV imports with specific columns. Matching their format exactly eliminates manual data entry.

**Download + mark flow:** When orders are exported, they're automatically marked as "downloaded" and move to the "In Process" tab. This prevents accidental re-exports.

**Server action:** CSV generation happens server-side to access database directly, then returns the CSV string to the client for download.

## Key Concepts

- **CSV escaping**: Values with commas or quotes need proper escaping
- **Server actions returning data**: Return CSV content, not a file stream
- **Optimistic state updates**: Mark orders as downloaded, then revalidate the page

## Code Walkthrough

**CSV escaping (tested in `admin-actions.test.ts`):**
```typescript
const escapeValue = (val: string | null): string => {
  if (!val) return "";
  const str = String(val);
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;  // Double quotes to escape
  }
  return str;
};
```

**CSV generation server action:**
```typescript
// src/server/admin-actions.ts
export async function generatePirateShipCsv(orderIds: number[]) {
  const orders = await db.select(...).where(inArray(order.id, orderIds));

  const rows = [CSV_HEADER];
  for (const ord of orders) {
    const address = JSON.parse(ord.shippingAddress);
    const row = [
      escapeValue(ord.customerName),
      "",  // Company
      escapeValue(address.address1),
      escapeValue(address.address2),
      escapeValue(address.city),
      escapeValue(address.state),
      escapeValue(address.zipCode),
      escapeValue(address.country || "US"),
      escapeValue(address.phone),
      escapeValue(ord.customerEmail),
      "", "", "", "",  // Weight, L, W, H - set in Pirate Ship
    ].join(",");
    rows.push(row);
  }

  // Mark as downloaded
  await db.update(order)
    .set({ is_downloaded: true, downloaded_at: new Date() })
    .where(inArray(order.id, orderIds));

  return { success: true, csv: rows.join("\n") };
}
```

**Client-side download trigger:**
```typescript
const handleExport = async () => {
  const result = await generatePirateShipCsv(selectedIds);
  if (result.csv) {
    const blob = new Blob([result.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${Date.now()}.csv`;
    a.click();
  }
};
```

## Testing Strategy
CSV escaping logic is unit tested in `admin-actions.test.ts` with various edge cases (commas, quotes, newlines, null values). The full export flow is tested manually.

## What You Learned
- Proper CSV escaping rules (RFC 4180)
- Server actions that return data for client-side file downloads
- Combining data export with status updates for workflow management
