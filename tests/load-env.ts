import dotenv from "dotenv";
import fs from "node:fs";

// E2E tests run only against the test Supabase project (tursyabg-test).
// Locally the values come from .env.test; in CI they come from pipeline variables.
const FILE = ".env.test";
if (fs.existsSync(FILE)) {
  dotenv.config({ path: FILE, override: true });
} else if (!process.env.CI && !process.env.TF_BUILD) {
  throw new Error(`${FILE} is missing. E2E tests must never run against the live project.`);
}

// Safety net: refuse to start if anything points at the live project.
const LIVE_REF = "fznhblkjgdghpwsdgiit";
for (const key of ["VITE_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID"]) {
  if ((process.env[key] ?? "").includes(LIVE_REF)) {
    throw new Error(`${key} points at the LIVE Supabase project. E2E tests stopped. Check ${FILE}.`);
  }
}
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for E2E tests.");
}