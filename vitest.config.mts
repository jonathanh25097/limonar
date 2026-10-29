import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests start an in-memory MongoDB replica set; the first run downloads it.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
