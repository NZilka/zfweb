/**
 * Unit tests for product form validation logic
 * Tests field-level validation and form validity state
 */
import { describe, it, expect } from "vitest";

/**
 * Validate product title - must not be empty
 * Returns error message or undefined if valid
 */
function validateTitle(title: string): string | undefined {
  if (!title.trim()) {
    return "Product name is required";
  }
  return undefined;
}

/**
 * Validate product price - must be >= 0
 * Returns error message or undefined if valid
 */
function validatePrice(price: number): string | undefined {
  if (price < 0) {
    return "Price must be 0 or greater";
  }
  return undefined;
}

/**
 * Validate images - at least one required
 * Returns error message or undefined if valid
 */
function validateImages(imageCount: number): string | undefined {
  if (imageCount === 0) {
    return "At least one image is required";
  }
  return undefined;
}

/**
 * Check if form is valid based on all fields and errors
 * Matches logic in ProductEditForm component
 */
function isFormValid(params: {
  title: string;
  price: number;
  imageCount: number;
  errors: {
    title?: string;
    price?: string;
    urlHandle?: string;
    images?: string;
  };
  isCheckingUrlHandle: boolean;
}): boolean {
  const { title, price, imageCount, errors, isCheckingUrlHandle } = params;
  return (
    title.trim() !== "" &&
    price >= 0 &&
    imageCount > 0 &&
    !errors.title &&
    !errors.price &&
    !errors.urlHandle &&
    !errors.images &&
    !isCheckingUrlHandle
  );
}

/**
 * Generate URL handle from product title
 * Converts to lowercase, replaces non-alphanumeric with hyphens
 */
function generateUrlHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

describe("Product Form Validation - Title", () => {
  it("returns error for empty title", () => {
    expect(validateTitle("")).toBe("Product name is required");
  });

  it("returns error for whitespace-only title", () => {
    expect(validateTitle("   ")).toBe("Product name is required");
    expect(validateTitle("\t\n")).toBe("Product name is required");
  });

  it("returns undefined for valid title", () => {
    expect(validateTitle("Silver Ring")).toBeUndefined();
  });

  it("returns undefined for title with leading/trailing spaces", () => {
    // Title has content after trimming
    expect(validateTitle("  Gold Necklace  ")).toBeUndefined();
  });
});

describe("Product Form Validation - Price", () => {
  it("returns error for negative price", () => {
    expect(validatePrice(-1)).toBe("Price must be 0 or greater");
    expect(validatePrice(-0.01)).toBe("Price must be 0 or greater");
    expect(validatePrice(-100)).toBe("Price must be 0 or greater");
  });

  it("returns undefined for zero price", () => {
    expect(validatePrice(0)).toBeUndefined();
  });

  it("returns undefined for positive price", () => {
    expect(validatePrice(1)).toBeUndefined();
    expect(validatePrice(19.99)).toBeUndefined();
    expect(validatePrice(1000)).toBeUndefined();
  });

  it("returns undefined for decimal prices", () => {
    expect(validatePrice(0.01)).toBeUndefined();
    expect(validatePrice(99.99)).toBeUndefined();
  });
});

describe("Product Form Validation - Images", () => {
  it("returns error when no images", () => {
    expect(validateImages(0)).toBe("At least one image is required");
  });

  it("returns undefined for one image", () => {
    expect(validateImages(1)).toBeUndefined();
  });

  it("returns undefined for multiple images", () => {
    expect(validateImages(3)).toBeUndefined();
    expect(validateImages(10)).toBeUndefined();
  });
});

describe("Product Form Validation - Form Validity", () => {
  const baseValidParams = {
    title: "Valid Product",
    price: 19.99,
    imageCount: 1,
    errors: {},
    isCheckingUrlHandle: false,
  };

  it("returns true when all fields are valid", () => {
    expect(isFormValid(baseValidParams)).toBe(true);
  });

  it("returns false when title is empty", () => {
    expect(isFormValid({ ...baseValidParams, title: "" })).toBe(false);
    expect(isFormValid({ ...baseValidParams, title: "   " })).toBe(false);
  });

  it("returns false when price is negative", () => {
    expect(isFormValid({ ...baseValidParams, price: -1 })).toBe(false);
  });

  it("returns true when price is zero", () => {
    expect(isFormValid({ ...baseValidParams, price: 0 })).toBe(true);
  });

  it("returns false when no images", () => {
    expect(isFormValid({ ...baseValidParams, imageCount: 0 })).toBe(false);
  });

  it("returns false when title error exists", () => {
    expect(
      isFormValid({
        ...baseValidParams,
        errors: { title: "Product name is required" },
      })
    ).toBe(false);
  });

  it("returns false when price error exists", () => {
    expect(
      isFormValid({
        ...baseValidParams,
        errors: { price: "Price must be 0 or greater" },
      })
    ).toBe(false);
  });

  it("returns false when URL handle error exists", () => {
    expect(
      isFormValid({
        ...baseValidParams,
        errors: { urlHandle: "This URL handle is already in use" },
      })
    ).toBe(false);
  });

  it("returns false when checking URL handle", () => {
    expect(
      isFormValid({
        ...baseValidParams,
        isCheckingUrlHandle: true,
      })
    ).toBe(false);
  });

  it("returns false when multiple errors exist", () => {
    expect(
      isFormValid({
        title: "",
        price: -1,
        imageCount: 0,
        errors: {
          title: "Product name is required",
          price: "Price must be 0 or greater",
        },
        isCheckingUrlHandle: false,
      })
    ).toBe(false);
  });
});

describe("URL Handle Auto-Generation", () => {
  it("generates slug from simple title", () => {
    expect(generateUrlHandle("Silver Ring")).toBe("silver-ring");
  });

  it("converts to lowercase", () => {
    expect(generateUrlHandle("GOLD NECKLACE")).toBe("gold-necklace");
  });

  it("replaces multiple spaces with single hyphen", () => {
    expect(generateUrlHandle("Bronze   Earrings")).toBe("bronze-earrings");
  });

  it("removes special characters", () => {
    expect(generateUrlHandle("Ring (14k Gold)")).toBe("ring-14k-gold");
    expect(generateUrlHandle("Women's Bracelet")).toBe("women-s-bracelet");
  });

  it("removes leading and trailing hyphens", () => {
    expect(generateUrlHandle("  --Test Product--  ")).toBe("test-product");
  });

  it("handles empty string", () => {
    expect(generateUrlHandle("")).toBe("");
  });

  it("preserves numbers", () => {
    expect(generateUrlHandle("Ring Size 7")).toBe("ring-size-7");
    expect(generateUrlHandle("14k Gold")).toBe("14k-gold");
  });
});
