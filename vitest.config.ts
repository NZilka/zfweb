import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Vitest configuration for zfweb
// Supports React component testing and server-side unit tests
export default defineConfig({
  plugins: [react()],
  test: {
    // Use happy-dom for DOM-based tests (React components)
    // happy-dom has better ESM compatibility than jsdom
    environment: "happy-dom",
    // Global test utilities available without imports
    globals: true,
    // Setup file for test environment configuration
    setupFiles: ["./src/__tests__/setup.ts"],
    // Include test files matching these patterns
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    // Exclude node_modules and build artifacts
    exclude: ["node_modules", ".next", "dist"],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "src/__tests__/",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
  resolve: {
    // Match Next.js path alias for imports like ~/server/db
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
