/**
 * One-shot script: re-key the staging environment's UploadThing references.
 *
 * Context: the staging Neon DB is a copy-on-write branch off prod, so freshly
 * branched staging rows reference the same UploadThing files as prod. The
 * prod UT app is now isolated from staging (separate app/token), so those
 * URLs will continue to work for reads but ANY delete/modify in staging
 * code would mutate the prod app.
 *
 * This script copies every prod-owned UT file into the staging UT app and
 * rewrites the DB rows + KV SiteSettings to point at the new (staging-owned)
 * URLs. After running, staging is fully storage-isolated from prod.
 *
 * Usage:
 *   pnpm tsx scripts/restaging-uploadthing.ts            # dry run
 *   pnpm tsx scripts/restaging-uploadthing.ts --apply    # actually mutate
 *
 * Re-run after each Neon staging re-branch (per docs/STAGING_SETUP.md).
 * Re-running on an already-migrated DB may create duplicate uploads but
 * will not corrupt data.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { UTApi } from "uploadthing/server";
import { Redis } from "@upstash/redis";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import {
  getAppIdFromToken,
  PROD_UPLOADTHING_APP_ID,
} from "~/server/uploadthing-token";
import type { SiteSettings } from "~/server/kv";

const SITE_SETTINGS_KEY = "site:settings";

// Decide whether a URL points at the prod UT app (and therefore should be
// re-uploaded into the staging app). Two cases handled:
//   - new-format URL: https://<appId>.ufs.sh/f/<key> — check the host subdomain
//   - old-format URL: https://utfs.io/f/<key>      — assumed prod (the app
//     only switched to the new-format subdomain recently; legacy data is prod)
// Returns false for already-staging URLs and obviously-foreign URLs so
// re-running the script is safe and won't duplicate uploads from the
// current staging app.
function isProdOwnedUrl(url: string, currentAppId: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    // Old shared host → conservatively treat as prod (worst case: makes a copy
    // of an already-staging file, wasting a small amount of UT storage)
    if (u.hostname === "utfs.io") return true;
    // New per-app subdomain → match against current app
    const subdomain = u.hostname.split(".")[0];
    if (u.hostname.endsWith(".ufs.sh")) {
      return subdomain !== currentAppId;
    }
    return false;
  } catch {
    return false;
  }
}

type Mapping = Map<string, { newKey: string; newUrl: string }>; // oldKey -> new

async function main() {
  const apply = process.argv.includes("--apply");

  // --- Safety check 1: refuse if pointing at the prod UT app ---
  const currentAppId = getAppIdFromToken(process.env.UPLOADTHING_TOKEN);
  console.log(`[ut] active appId: ${currentAppId ?? "(unknown)"}`);
  if (!currentAppId) {
    console.error("ABORT: UPLOADTHING_TOKEN missing or malformed in .env.local");
    process.exit(1);
  }
  if (currentAppId === PROD_UPLOADTHING_APP_ID) {
    console.error(
      "ABORT: UPLOADTHING_TOKEN points at the prod UT app. Switch .env.local " +
        "to the staging app token before running this script.",
    );
    process.exit(1);
  }

  // --- Safety check 2: announce the database we're about to read/write ---
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ABORT: DATABASE_URL missing");
    process.exit(1);
  }
  const dbHost = dbUrl.split("@")[1]?.split("/")[0] ?? "(unknown)";
  console.log(`[db] target host: ${dbHost}`);

  const kvUrl = process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
    console.error("ABORT: UPSTASH_REDIS_REST_URL / TOKEN missing");
    process.exit(1);
  }
  console.log(`[kv]  target: ${kvUrl}`);
  console.log("");

  if (!apply) {
    console.log("MODE: DRY RUN — pass --apply to actually mutate.\n");
  } else {
    console.log("MODE: APPLY — will mutate staging DB and KV in 5s (ctrl-c to abort)...\n");
    await new Promise((r) => setTimeout(r, 5000));
  }

  const utapi = new UTApi();
  const redis = new Redis({ url: kvUrl, token: kvToken });
  const db = drizzle(neon(dbUrl), { schema });

  // --- Collect every prod-owned (url, key) pair ---
  type Ref = { url: string; key: string; source: string };
  const refs: Ref[] = [];

  // Products
  const products = await db.query.product.findMany();
  for (const p of products) {
    for (let i = 0; i < p.imgUrl.length; i++) {
      // noUncheckedIndexedAccess: indices may be undefined
      const url = p.imgUrl[i];
      const key = p.imgKey[i];
      if (url && key && isProdOwnedUrl(url, currentAppId)) {
        refs.push({ url, key, source: `product#${p.id} img[${i}]` });
      }
    }
  }

  // KV SiteSettings (single key, may be null)
  const settings = await redis.get<SiteSettings>(SITE_SETTINGS_KEY);
  if (settings) {
    const m = settings.maintenanceMode;
    if (m.imageUrl && m.imageKey && isProdOwnedUrl(m.imageUrl, currentAppId)) {
      refs.push({ url: m.imageUrl, key: m.imageKey, source: "maintenanceMode" });
    }
    for (const variant of ["large", "small"] as const) {
      const v = settings.logo[variant];
      if (v.url && v.key && isProdOwnedUrl(v.url, currentAppId)) {
        refs.push({ url: v.url, key: v.key, source: `logo.${variant}` });
      }
    }
    settings.carousel.rows.forEach((row, rowIdx) => {
      if (!row) return;
      if (row.type === "video") {
        if (isProdOwnedUrl(row.url, currentAppId)) {
          refs.push({ url: row.url, key: row.key, source: `carousel.rows[${rowIdx}] video` });
        }
      } else {
        row.cells.forEach((cell, cellIdx) => {
          if (cell && isProdOwnedUrl(cell.url, currentAppId)) {
            refs.push({
              url: cell.url,
              key: cell.key,
              source: `carousel.rows[${rowIdx}].cells[${cellIdx}]`,
            });
          }
        });
      }
    });
    settings.about.images.forEach((img, idx) => {
      if (isProdOwnedUrl(img.url, currentAppId)) {
        refs.push({ url: img.url, key: img.key, source: `about.images[${idx}]` });
      }
    });
  }

  // Dedupe by key (same file referenced from multiple places)
  const uniqueByKey = new Map<string, Ref>();
  for (const ref of refs) {
    if (!uniqueByKey.has(ref.key)) uniqueByKey.set(ref.key, ref);
  }

  console.log(`Found ${refs.length} prod-owned UT references (${uniqueByKey.size} unique files).`);
  for (const ref of refs) {
    console.log(`  - ${ref.source}: ${ref.url}`);
  }

  if (uniqueByKey.size === 0) {
    console.log("\nNothing to migrate. Exiting.");
    return;
  }

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to migrate.");
    return;
  }

  // --- Migrate: upload each unique file from its prod URL into the staging app ---
  const mapping: Mapping = new Map();
  let migrated = 0;
  let failed = 0;
  for (const [oldKey, ref] of uniqueByKey) {
    process.stdout.write(`Migrating ${ref.source}... `);
    try {
      const result = await utapi.uploadFilesFromUrl(ref.url);
      // uploadFilesFromUrl returns either a single result or an array depending
      // on input; we passed a single string so expect single result
      const data = Array.isArray(result) ? result[0]?.data : result.data;
      if (!data?.key || !data?.url) {
        console.log(`FAILED (no data returned)`);
        failed++;
        continue;
      }
      mapping.set(oldKey, { newKey: data.key, newUrl: data.url });
      console.log(`-> ${data.key}`);
      migrated++;
    } catch (err) {
      console.log(`FAILED (${(err as Error).message})`);
      failed++;
    }
  }
  console.log(`\nMigrated ${migrated}/${uniqueByKey.size} files (${failed} failures).`);

  if (mapping.size === 0) {
    console.log("No successful migrations to apply. Exiting.");
    return;
  }

  // --- Apply mapping to DB ---
  let productsUpdated = 0;
  for (const p of products) {
    const newImgUrl = [...p.imgUrl];
    const newImgKey = [...p.imgKey];
    let changed = false;
    for (let i = 0; i < newImgKey.length; i++) {
      // noUncheckedIndexedAccess gives us string | undefined here
      const k = newImgKey[i];
      if (!k) continue;
      const m = mapping.get(k);
      if (m) {
        newImgUrl[i] = m.newUrl;
        newImgKey[i] = m.newKey;
        changed = true;
      }
    }
    if (changed) {
      await db
        .update(schema.product)
        .set({ imgUrl: newImgUrl, imgKey: newImgKey })
        .where(eq(schema.product.id, p.id));
      productsUpdated++;
    }
  }
  console.log(`Updated ${productsUpdated} product rows.`);

  // --- Apply mapping to KV SiteSettings ---
  if (settings) {
    let kvChanged = false;
    const updateRef = (oldKey: string, oldUrl: string) => {
      const m = mapping.get(oldKey);
      if (m) {
        kvChanged = true;
        return { key: m.newKey, url: m.newUrl };
      }
      return { key: oldKey, url: oldUrl };
    };

    {
      const m = settings.maintenanceMode;
      if (m.imageKey && m.imageUrl) {
        const r = updateRef(m.imageKey, m.imageUrl);
        m.imageKey = r.key;
        m.imageUrl = r.url;
      }
    }
    for (const variant of ["large", "small"] as const) {
      const v = settings.logo[variant];
      if (v.key && v.url) {
        const r = updateRef(v.key, v.url);
        v.key = r.key;
        v.url = r.url;
      }
    }
    settings.carousel.rows.forEach((row) => {
      if (!row) return;
      if (row.type === "video") {
        const r = updateRef(row.key, row.url);
        row.key = r.key;
        row.url = r.url;
      } else {
        row.cells.forEach((cell) => {
          if (cell) {
            const r = updateRef(cell.key, cell.url);
            cell.key = r.key;
            cell.url = r.url;
          }
        });
      }
    });
    settings.about.images.forEach((img) => {
      const r = updateRef(img.key, img.url);
      img.key = r.key;
      img.url = r.url;
    });

    if (kvChanged) {
      await redis.set(SITE_SETTINGS_KEY, settings);
      console.log("Updated KV SiteSettings.");
    } else {
      console.log("No KV SiteSettings changes.");
    }
  }

  console.log("\nDone. Verify the staging deploy renders images correctly.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
