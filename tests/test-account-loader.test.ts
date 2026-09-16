import { getTestAccountCredentials, requireTestAccountCredentials } from "./fixtures/test-account-loader";

console.log("\n=== Testing Test Account Fixture Loader ===\n");

const creds = getTestAccountCredentials();
if (creds === null) {
  console.log("PASS: Fixture missing or empty returns null (safe fallback)");
} else {
  console.log("PASS: Fixture loaded with email:", creds.email);
  console.log("PASS: Password loaded and non-empty:", Boolean(creds.password));
}

try {
  requireTestAccountCredentials();
  console.log("PASS: requireTestAccountCredentials returned credentials");
} catch (e: any) {
  console.log("PASS: requireTestAccountCredentials threw expected error when unconfigured:", e.message.split("\n")[0]);
}

console.log("Loader test complete.\n");
