// Test setup file for vitest
// Runs before each test file

import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup React components after each test to prevent memory leaks
afterEach(() => {
  cleanup();
});

// Extend expect with custom matchers if needed in the future
// Example: expect.extend({ ... })
