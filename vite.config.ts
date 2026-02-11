import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/testSetup.ts",
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["tests/**", "node_modules/**"],
  },
});
