/**
 * Tests for getVerifiedPrimaryEmail — the only email the account page may
 * use to match and link orders.
 */
import { describe, it, expect } from "vitest";
import { getVerifiedPrimaryEmail } from "~/lib/clerk-user";

describe("getVerifiedPrimaryEmail", () => {
  it("returns the primary email when it is verified", () => {
    const user = {
      primaryEmailAddress: {
        emailAddress: "owner@example.com",
        verification: { status: "verified" },
      },
    };
    expect(getVerifiedPrimaryEmail(user)).toBe("owner@example.com");
  });

  it("returns null when the primary email is not verified", () => {
    const user = {
      primaryEmailAddress: {
        emailAddress: "victim@example.com",
        verification: { status: "unverified" },
      },
    };
    expect(getVerifiedPrimaryEmail(user)).toBeNull();
  });

  it("returns null when verification data is missing", () => {
    expect(
      getVerifiedPrimaryEmail({
        primaryEmailAddress: { emailAddress: "x@example.com", verification: null },
      }),
    ).toBeNull();
    expect(
      getVerifiedPrimaryEmail({
        primaryEmailAddress: { emailAddress: "x@example.com" },
      }),
    ).toBeNull();
  });

  it("falls back to the address matching primaryEmailAddressId", () => {
    const user = {
      primaryEmailAddressId: "em_2",
      emailAddresses: [
        // First in the array but NOT primary — the old emailAddresses[0] bug
        { id: "em_1", emailAddress: "secondary@example.com", verification: { status: "verified" } },
        { id: "em_2", emailAddress: "primary@example.com", verification: { status: "verified" } },
      ],
    };
    expect(getVerifiedPrimaryEmail(user)).toBe("primary@example.com");
  });

  it("does not use a non-primary address even when it is verified", () => {
    const user = {
      primaryEmailAddressId: "em_missing",
      emailAddresses: [
        { id: "em_1", emailAddress: "secondary@example.com", verification: { status: "verified" } },
      ],
    };
    expect(getVerifiedPrimaryEmail(user)).toBeNull();
  });

  it("handles null and undefined users", () => {
    expect(getVerifiedPrimaryEmail(null)).toBeNull();
    expect(getVerifiedPrimaryEmail(undefined)).toBeNull();
  });
});
