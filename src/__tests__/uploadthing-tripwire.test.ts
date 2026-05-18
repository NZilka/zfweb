/**
 * Tests for the pure helpers backing the UploadThing boot tripwire.
 * The tripwire itself runs at module load and throws — hard to test
 * directly without spinning up multiple module contexts. Instead we
 * verify the helper logic in isolation, and rely on the integration
 * (a single `if (shouldRefuse) throw` line in uploadthing.ts) being
 * obviously correct from inspection.
 */
import { describe, it, expect } from "vitest";
import {
  getAppIdFromToken,
  shouldRefuseUploadThingBoot,
  PROD_UPLOADTHING_APP_ID,
} from "~/server/uploadthing-token";

// Helper: build a synthetic UploadThing token (base64 of a JSON blob)
function makeToken(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

describe("getAppIdFromToken", () => {
  it("extracts appId from a well-formed token", () => {
    const token = makeToken({ apiKey: "sk_x", appId: "myapp123", regions: ["sea1"] });
    expect(getAppIdFromToken(token)).toBe("myapp123");
  });

  it("returns null for undefined or empty input", () => {
    expect(getAppIdFromToken(undefined)).toBeNull();
    expect(getAppIdFromToken("")).toBeNull();
  });

  it("returns null for non-base64 garbage", () => {
    expect(getAppIdFromToken("!@#$%^&*()")).toBeNull();
  });

  it("returns null when the decoded payload isn't valid JSON", () => {
    expect(getAppIdFromToken(Buffer.from("not json").toString("base64"))).toBeNull();
  });

  it("returns null when the JSON has no appId field", () => {
    expect(getAppIdFromToken(makeToken({ apiKey: "sk_x" }))).toBeNull();
  });

  it("returns null when appId is the wrong type", () => {
    expect(getAppIdFromToken(makeToken({ appId: 12345 }))).toBeNull();
  });
});

describe("shouldRefuseUploadThingBoot", () => {
  const prodAppId = PROD_UPLOADTHING_APP_ID;

  it("refuses when non-prod env is configured with the prod token (the dangerous case)", () => {
    expect(
      shouldRefuseUploadThingBoot({ isProd: false, appId: prodAppId, prodAppId }),
    ).toBe(true);
  });

  it("allows when non-prod env is configured with a non-prod token", () => {
    expect(
      shouldRefuseUploadThingBoot({ isProd: false, appId: "k8m3b8iqd1", prodAppId }),
    ).toBe(false);
  });

  it("allows when prod env is configured with the prod token", () => {
    expect(
      shouldRefuseUploadThingBoot({ isProd: true, appId: prodAppId, prodAppId }),
    ).toBe(false);
  });

  it("allows when prod env is configured with a non-prod token (wrong but not the tripwire's job)", () => {
    // This is a misconfiguration — prod writing to staging storage — but
    // it's not destructive to prod data, so the tripwire stays silent.
    // A separate review or alert should catch this.
    expect(
      shouldRefuseUploadThingBoot({ isProd: true, appId: "k8m3b8iqd1", prodAppId }),
    ).toBe(false);
  });

  it("allows when appId is unknown (null) — caller likely has a bigger problem", () => {
    expect(
      shouldRefuseUploadThingBoot({ isProd: false, appId: null, prodAppId }),
    ).toBe(false);
    expect(
      shouldRefuseUploadThingBoot({ isProd: true, appId: null, prodAppId }),
    ).toBe(false);
  });
});
