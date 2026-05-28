import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Build into the Frappe app `public/` folder using *.bundle.* names so:
// - Direct URL works: /assets/zkteco_hr/hr_attendance.bundle.js
// - `bench build` can also register them via assets.json (include_script/include_style)
export default defineConfig({
  plugins: [react()],
  base: "/assets/zkteco_hr/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../../public"),
    emptyOutDir: false, // keep other public files if any
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/main.tsx"),
      output: {
        entryFileNames: "hr_attendance.bundle.js",
        chunkFileNames: "hr_attendance.[name].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? "";
          if (name.endsWith(".css")) return "hr_attendance.bundle.css";
          return "hr_attendance.[name][extname]";
        },
      },
    },
  },
});
