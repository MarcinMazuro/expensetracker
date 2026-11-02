#!/usr/bin/env node
/**
 * Creates an account from the command line - needed once, for the first
 * administrator (later accounts are added in the app under /admin).
 *
 *   npm run create-user -- --email you@example.com --name Marcin --role admin [--database development]
 *
 * The password is read from the terminal without echo. Uses gcloud
 * Application Default Credentials (gcloud auth application-default login).
 * Hash format must match src/lib/password.ts (checked by tests/password.test.ts).
 */
import { randomBytes, scrypt } from "node:crypto";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

export const DEFAULT_CATEGORIES = [
  ["Spożywcze", "🛒", "#22c55e"], ["Restauracje i kawiarnie", "🍽️", "#f97316"], ["Transport", "🚗", "#3b82f6"],
  ["Mieszkanie i rachunki", "🏠", "#8b5cf6"], ["Zdrowie i uroda", "💊", "#ec4899"], ["Chemia i dom", "🧴", "#14b8a6"],
  ["Ubrania", "👕", "#eab308"], ["Rozrywka i hobby", "🎮", "#ef4444"], ["Subskrypcje", "📺", "#6366f1"],
  ["Elektronika", "💻", "#0ea5e9"], ["Prezenty", "🎁", "#d946ef"], ["Podróże", "✈️", "#06b6d4"],
  ["Edukacja", "📚", "#84cc16"], ["Inne", "📦", "#78716c"],
].map(([name, emoji, color], order) => ({ name, emoji, color, budget: 0, order }));

export function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) =>
      error ? reject(error) : resolve(`scrypt$${salt.toString("base64")}$${key.toString("base64")}`),
    ),
  );
}

function readHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (char === "\u0003") process.exit(130);
        if (char === "\u007f") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "member" },
      database: { type: "string", default: "(default)" },
      project: { type: "string", default: "expensetracker-mm" },
    },
  });
  if (!values.email || !values.name) {
    console.error("Usage: npm run create-user -- --email EMAIL --name NAME [--role admin] [--database development]");
    process.exit(1);
  }

  const password = process.env.NEW_PASSWORD ?? (await readHidden("Password (min. 10 characters): "));
  if (password.length < 10) {
    console.error("Password too short.");
    process.exit(1);
  }

  const { Firestore } = await import("@google-cloud/firestore");
  const db = new Firestore({ projectId: values.project, databaseId: values.database });
  const email = values.email.trim().toLowerCase();

  const existing = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!existing.empty) {
    console.error(`An account for ${email} already exists.`);
    process.exit(1);
  }

  const ref = db.collection("users").doc();
  const batch = db.batch();
  batch.set(ref, {
    email,
    name: values.name,
    role: values.role === "admin" ? "admin" : "member",
    disabled: false,
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
    passwordHash: await hashPassword(password),
  });
  for (const category of DEFAULT_CATEGORIES) batch.set(ref.collection("categories").doc(), category);
  await batch.commit();
  console.log(`Created ${values.role} ${email} in database ${values.database} (${ref.id}).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
