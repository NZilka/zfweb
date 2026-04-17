// Tests for src/lib/env-info.ts derived environment flags.
// Uses vi.resetModules() + process.env mutation because env-info reads
// process.env at module load time; we need a fresh import per scenario.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// server-only guard needs to be mocked because env-info imports it
vi.mock("server-only", () => ({}));

describe("env-info", () => {
  // Snapshot env vars so test mutations don't leak between cases
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear the module cache so each test picks up fresh process.env values
    vi.resetModules();
    // Remove Vercel vars that might be present in the test environment
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_COMMIT_REF;
  });

  afterEach(() => {
    // Restore original env so we don't pollute other test files
    process.env = { ...originalEnv };
  });

  it("treats absence of VERCEL_ENV as local", async () => {
    const mod = await import("~/lib/env-info");
    expect(mod.isLocal).toBe(true);
    expect(mod.isProd).toBe(false);
    expect(mod.isStaging).toBe(false);
  });

  it("treats VERCEL_ENV=development as local", async () => {
    process.env.VERCEL_ENV = "development";
    const mod = await import("~/lib/env-info");
    expect(mod.isLocal).toBe(true);
    expect(mod.isProd).toBe(false);
    expect(mod.isStaging).toBe(false);
  });

  it("identifies production when VERCEL_ENV=production", async () => {
    process.env.VERCEL_ENV = "production";
    const mod = await import("~/lib/env-info");
    expect(mod.isProd).toBe(true);
    expect(mod.isStaging).toBe(false);
    expect(mod.isLocal).toBe(false);
  });

  it("identifies staging only when preview + branch is exactly 'staging'", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = "staging";
    const mod = await import("~/lib/env-info");
    expect(mod.isStaging).toBe(true);
    expect(mod.isProd).toBe(false);
    expect(mod.isLocal).toBe(false);
  });

  it("does NOT treat a feature-branch preview as staging", async () => {
    // This is the critical guard: preview deploys from feature branches must not
    // be mistaken for staging, otherwise banner + any staging-only logic would leak
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_GIT_COMMIT_REF = "feature/some-work";
    const mod = await import("~/lib/env-info");
    expect(mod.isStaging).toBe(false);
    expect(mod.isProd).toBe(false);
    expect(mod.isLocal).toBe(false);
  });

  it("does NOT treat preview without a branch ref as staging", async () => {
    // Defensive: missing VERCEL_GIT_COMMIT_REF should never qualify as staging
    process.env.VERCEL_ENV = "preview";
    const mod = await import("~/lib/env-info");
    expect(mod.isStaging).toBe(false);
  });
});
