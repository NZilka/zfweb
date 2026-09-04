/**
 * Tests for isUploadThingUrl — accepted everywhere an UploadThing URL is
 * validated (carousel cells, image copy source) and mirrored by
 * images.remotePatterns in next.config.js.
 */
import { describe, it, expect } from "vitest";
import { isUploadThingUrl } from "~/lib/uploadthing-url";

describe("isUploadThingUrl", () => {
  it("accepts the legacy shared host", () => {
    expect(isUploadThingUrl("https://utfs.io/f/abc123")).toBe(true);
  });

  it("accepts per-app ufs.sh hosts", () => {
    expect(isUploadThingUrl("https://515kq3lhmc.ufs.sh/f/abc123")).toBe(true);
    expect(isUploadThingUrl("https://zfstage.ufs.sh/f/abc123")).toBe(true);
  });

  it("rejects other hosts, including look-alikes", () => {
    expect(isUploadThingUrl("https://example.com/f/abc123")).toBe(false);
    expect(isUploadThingUrl("https://utfs.io.evil.com/f/abc123")).toBe(false);
    expect(isUploadThingUrl("https://evilutfs.io/f/abc123")).toBe(false);
    expect(isUploadThingUrl("https://ufs.sh/f/abc123")).toBe(false);
  });

  it("rejects non-https and non-file paths", () => {
    expect(isUploadThingUrl("http://utfs.io/f/abc123")).toBe(false);
    expect(isUploadThingUrl("https://utfs.io/admin")).toBe(false);
    expect(isUploadThingUrl("https://utfs.io/")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isUploadThingUrl("")).toBe(false);
    expect(isUploadThingUrl("not a url")).toBe(false);
    expect(isUploadThingUrl("javascript:alert(1)")).toBe(false);
  });
});
