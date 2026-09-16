import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface TestAccountCredentials {
  email: string;
  password: string;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, "test-account.local.json");

/**
 * Loads the local test account credentials if present.
 *
 * Security:
 * - Credentials must only reside in tests/fixtures/test-account.local.json (gitignored).
 * - Passwords are never logged, printed, or committed.
 * - If the file does not exist, returns null so tests can prompt the user rather than inventing credentials.
 */
export function getTestAccountCredentials(): TestAccountCredentials | null {
  if (!fs.existsSync(FIXTURE_PATH)) {
    return null;
  }

  try {
    const content = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const data = JSON.parse(content) as Partial<TestAccountCredentials>;

    if (typeof data.email !== "string" || typeof data.password !== "string") {
      return null;
    }

    const email = data.email.trim();
    const password = data.password;

    // Check for empty or unconfigured placeholders
    if (!email || !password.trim() || email.startsWith("<") || password.startsWith("<")) {
      return null;
    }

    return {
      email,
      password,
    };
  } catch (err) {
    console.error("Failed to read or parse test account fixture:", err);
    return null;
  }
}

/**
 * Asserts that the test account fixture exists, or throws a clear error message.
 */
export function requireTestAccountCredentials(): TestAccountCredentials {
  const creds = getTestAccountCredentials();
  if (!creds) {
    throw new Error(
      `Missing test account fixture: "${FIXTURE_PATH}". ` +
      `Please create this local file with your existing test account credentials ` +
      `following tests/fixtures/test-account.example.json before running authenticated E2E tests.`,
    );
  }
  return creds;
}
