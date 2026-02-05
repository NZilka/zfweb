# Lesson: Logo Management

## What We Built

Admin-configurable site logos with large and small variants, stored in KV settings and displayed dynamically in both shop and admin navigation bars.

## Why This Approach

- **KV storage** — Consistent with existing settings pattern (maintenance mode, announcements). No DB migration needed.
- **Backward-compat merging** — `getSiteSettings()` fills missing `logo` key from defaults so existing KV data continues to work when the new field is added.
- **Separate UploadThing route** — `logoUploader` has its own 4MB/1-file limit, distinct from product image uploads.
- **Server-side logo fetching** — Shop TopNav is an async server component that fetches settings directly. Admin layout fetches and passes via props since TopNav is a client component (uses `useAdminNav` hook).

## Key Concepts

- **LogoVariant type**: `{ url: string | null; key: string | null }` — stores both the display URL and UploadThing key for future cleanup.
- **Two logo sizes**: Large (navigation bars) and small (favicons/compact views) uploaded independently.
- **Fallback pattern**: `settings.logo.large.url ?? "/logo.png"` ensures the static default logo works when no custom logo is set.
- **Backward compatibility**: The `getSiteSettings()` function spreads defaults first, then stored settings, then explicitly fills `logo` if missing from old KV data.

## Code Walkthrough

- `src/server/kv.ts` — Added `LogoVariant` type, `logo` field to `SiteSettings`, backward-compat merge in `getSiteSettings()`.
- `src/server/settings-actions.ts` — Added `logoVariantSchema`, `logoSchema`, `logo` to `updateSettingsSchema`, and logo merge logic with URL normalization.
- `src/app/api/uploadthing/core.ts` — Added `logoUploader` route with same auth pattern.
- `src/app/admin/settings/_components/SettingsClient.tsx` — New "Site Logo" card with two upload zones (stacked mobile, side-by-side md+), upload target state to track which variant is uploading.
- `src/app/shop/_components/topnav.tsx` — Made async, fetches `getSiteSettings()` for dynamic logo.
- `src/app/admin/_components/topnav.tsx` — Added `logoUrl` prop.
- `src/app/admin/layout.tsx` — Made async, fetches settings and passes `logoUrl` to TopNav.
- `src/server/kv-middleware.ts` — Updated default settings to include `logo` field for type compatibility.

## Testing Strategy

Tested via `src/__tests__/logo-settings.test.ts`:
- Logo data merges correctly through `updateSettings`
- Other settings preserved when updating logo only
- Valid URL, null URL, and empty string normalization
- Invalid URL rejected by schema
- Backward compatibility when old settings lack `logo` field

## What You Learned

- When extending `SiteSettings`, update the type in `kv.ts`, the middleware copy in `kv-middleware.ts`, and the mock in any test files that define `DEFAULT_SITE_SETTINGS` inline.
- The admin TopNav is a client component (uses context hook), so logo URL must be passed as a prop from the async layout. The shop TopNav is a server component, so it can fetch settings directly.
- UploadThing's `useUploadThing` hook doesn't natively support "which upload zone triggered this" — solved by tracking upload target in state (`logoUploadTarget`).
