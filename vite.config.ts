// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Release id for error monitoring: tied to the deployment so Sentry can show
// which build introduced an error. Falls back to a build timestamp locally.
const release =
  process.env["SENTRY_RELEASE"] ||
  process.env["LOVABLE_DEPLOYMENT_ID"] ||
  process.env["CF_VERSION_METADATA_ID"] ||
  process.env["COMMIT_SHA"] ||
  process.env["VERCEL_GIT_COMMIT_SHA"] ||
  `build-${new Date().toISOString().slice(0, 16).replace(/[:T-]/g, "")}`;

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      __APP_RELEASE__: JSON.stringify(release),
    },
  },
});
