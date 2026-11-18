import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Mirrors tsconfig's "@/*": ["./*"].
      { find: /^@\//, replacement: fromRoot("./") },
      // "server-only" throws unless it is resolved under the react-server
      // condition, which only Next applies. Tests exercise the pure functions
      // a server-only module exports, so they get the package's own empty
      // entry instead.
      { find: /^server-only$/, replacement: fromRoot("./node_modules/server-only/empty.js") },
    ],
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "repositories/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
