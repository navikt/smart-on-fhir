import { defineConfig } from "tsup";

import pkgJson from "./package.json";

export default defineConfig({
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  metafile: true,
  format: "esm",
  entry: ["src/zod/index.ts", "src/client/index.ts"],
  define: {
    "LIB_VERSION": JSON.stringify(pkgJson.version)
  }
});
