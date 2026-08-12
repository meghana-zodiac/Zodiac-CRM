// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Outside the Lovable sandbox (e.g. GitHub Actions deploying to Firebase),
  // honor NITRO_PRESET so `NITRO_PRESET=firebase bun run build` emits
  // .output/public (static) + .output/server (Cloud Function).
  // Inside Lovable the preset is always forced to Cloudflare.
  nitro: process.env["NITRO_PRESET"] ? { preset: process.env["NITRO_PRESET"] } : true,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

