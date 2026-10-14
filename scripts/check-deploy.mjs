import { readFileSync } from "node:fs";
const config = readFileSync("wrangler.jsonc", "utf8");
if (config.includes("00000000-0000-0000-0000-000000000002")) {
  console.error(
    "Deployment stopped: configure the real baseer-m2 D1 database ID and apply remote migrations first. See README.md.",
  );
  process.exit(1);
}
