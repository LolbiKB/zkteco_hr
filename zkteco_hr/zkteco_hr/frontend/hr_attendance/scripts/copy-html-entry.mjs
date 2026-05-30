import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "../../..");
const builtHtmlPath = path.join(appRoot, "public/hr_attendance/index.html");
const targetHtmlPath = path.join(appRoot, "www/hr-attendance.html");
const buildIdPath = path.join(appRoot, "public/hr_attendance/assets/build-id.txt");

if (!fs.existsSync(builtHtmlPath)) {
  console.error(`Build output not found: ${builtHtmlPath}`);
  process.exit(1);
}

// Literal cache-bust token (Frappe www templates do not render {{ }} in copied asset URLs).
const buildId = String(Math.floor(Date.now() / 1000));

function injectAssetVersion(html) {
  return html
    .replace(
      'src="/assets/zkteco_hr/hr_attendance/assets/index.js"',
      `src="/assets/zkteco_hr/hr_attendance/assets/index.js?v=${buildId}"`
    )
    .replace(
      'href="/assets/zkteco_hr/hr_attendance/assets/index.css"',
      `href="/assets/zkteco_hr/hr_attendance/assets/index.css?v=${buildId}"`
    );
}

const html = injectAssetVersion(fs.readFileSync(builtHtmlPath, "utf8"));
fs.writeFileSync(builtHtmlPath, html);
fs.writeFileSync(targetHtmlPath, html);
fs.writeFileSync(buildIdPath, `${buildId}\n`);
console.log(`Copied ${builtHtmlPath} -> ${targetHtmlPath} (build v=${buildId})`);
