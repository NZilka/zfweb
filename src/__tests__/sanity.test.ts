// Sanity test to verify vitest is configured correctly
import { describe, it, expect } from "vitest";

describe("Vitest Setup", () => {
  it("should run a basic test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle async tests", async () => {
    const result = await Promise.resolve("hello");
    expect(result).toBe("hello");
  });

  it("should support object matchers", () => {
    const obj = { name: "zfweb", type: "ecommerce" };
    expect(obj).toEqual({ name: "zfweb", type: "ecommerce" });
    expect(obj).toHaveProperty("name");
  });
});
