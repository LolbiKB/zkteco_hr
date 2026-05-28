import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Build output goes into Frappe app public assets so it can be served at:
// /assets/zkteco_hr/hr_attendance/...
export default defineConfig({
  plugins: [react()],
  base: "/assets/zkteco_hr/hr_attendance/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "../../public/hr_attendance"),
    emptyOutDir: true,
    sourcemap: true
  }
});

