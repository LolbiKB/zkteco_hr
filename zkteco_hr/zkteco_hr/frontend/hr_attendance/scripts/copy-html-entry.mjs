import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "../../..");
const builtHtmlPath = path.join(appRoot, "public/hr_attendance/index.html");
const targetHtmlPath = path.join(appRoot, "www/hr-attendance.html");

if (!fs.existsSync(builtHtmlPath)) {
  console.error(`Build output not found: ${builtHtmlPath}`);
  process.exit(1);
}

function injectAssetVersion(html) {
  return html
    .replace(
      'src="/assets/zkteco_hr/hr_attendance/assets/index.js"',
      'src="/assets/zkteco_hr/hr_attendance/assets/index.js?v={{ asset_version }}"'
    )
    .replace(
      'href="/assets/zkteco_hr/hr_attendance/assets/index.css"',
      'href="/assets/zkteco_hr/hr_attendance/assets/index.css?v={{ asset_version }}"'
    );
}

const html = injectAssetVersion(fs.readFileSync(builtHtmlPath, "utf8"));
fs.writeFileSync(builtHtmlPath, html);
fs.writeFileSync(targetHtmlPath, html);
console.log(`Copied ${builtHtmlPath} -> ${targetHtmlPath}`);
