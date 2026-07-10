import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

const password = process.argv[2];

if (password) {
  console.log(hashPassword(password));
  process.exit(0);
}

const rl = createInterface({ input, output });
const answer = await rl.question("Admin password: ");
rl.close();

if (!answer) {
  console.error("Password is required.");
  process.exit(1);
}

console.log(hashPassword(answer));

