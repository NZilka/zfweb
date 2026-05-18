// Script to verify Upstash KV connection
// Run with: pnpm tsx scripts/test-kv.ts

import { Redis } from "@upstash/redis";
// Explicit .env.local load — node scripts don't get Next.js's env file loading.
import { config } from "dotenv";
config({ path: ".env.local" });

async function testConnection() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.error("❌ Missing environment variables:");
    console.error("   UPSTASH_REDIS_REST_URL:", url ? "✓ set" : "✗ missing");
    console.error("   UPSTASH_REDIS_REST_TOKEN:", token ? "✓ set" : "✗ missing");
    process.exit(1);
  }

  console.log("Testing Upstash connection...");
  console.log("URL:", url);

  const redis = new Redis({ url, token });

  try {
    // Test 1: Ping
    const ping = await redis.ping();
    console.log("✓ Ping:", ping);

    // Test 2: Set a value
    const testKey = "zfweb:connection-test";
    await redis.set(testKey, { timestamp: Date.now(), test: true }, { ex: 60 });
    console.log("✓ Set test value");

    // Test 3: Get the value back
    const value = await redis.get(testKey);
    console.log("✓ Get test value:", value);

    // Test 4: Delete the test key
    await redis.del(testKey);
    console.log("✓ Deleted test key");

    console.log("\n✅ Upstash KV connection working correctly!");
  } catch (error: any) {
    console.error("\n❌ Connection failed:", error.message);
    process.exit(1);
  }
}

testConnection();
