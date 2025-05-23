import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

// Define build options separately
const buildOptions = {
  banner: {
    js: banner,
  },
  entryPoints: ["main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@electron/remote", ...builtins],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod, // Minify code only in production
};

async function runBuild() {
  try {
    if (prod) {
      // Production build: use build() directly
      await esbuild.build(buildOptions);
      console.log("Production build complete.");
      process.exit(0);
    } else {
      // Development build: use context() and watch()
      const context = await esbuild.context(buildOptions);
      console.log("Initial build complete. Watching for changes...");
      await context.watch();
      // Keep the process alive for watch mode
      // Use Ctrl+C to exit
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

runBuild();
