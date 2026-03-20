import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  splitting: true, // tree-shaking — splits adapters/pricing into separate chunks
  treeshake: true, // drop unused exports at build time
  target: "es2020", // aligns with your tsconfig target
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs", // explicit extensions, no ambiguity
    };
  },
});
