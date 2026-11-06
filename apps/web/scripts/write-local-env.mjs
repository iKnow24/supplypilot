// Reads `supabase status -o env` on stdin and upserts the web app's local settings into the
// given env file, keeping any other lines the developer added. Local-only, well-known values.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
const input = readFileSync(0, "utf8");
const status = Object.fromEntries(
  input
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (!status.API_URL || !key) {
  console.error("Could not read API_URL / key from `supabase status`. Is it running?");
  process.exit(1);
}
const wanted = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  DEMO_AUTH: "on",
};
const lines = existsSync(target) ? readFileSync(target, "utf8").split("\n") : [];
const kept = lines.filter((l) => !Object.keys(wanted).some((k) => l.startsWith(`${k}=`)));
while (kept.length && kept.at(-1) === "") kept.pop();
const out = [...kept, ...Object.entries(wanted).map(([k, v]) => `${k}=${v}`)].join("\n") + "\n";
writeFileSync(target, out);
console.log(`Updated ${target} (${Object.keys(wanted).join(", ")})`);
