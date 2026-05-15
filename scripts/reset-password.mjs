import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function usage() {
  console.log("Usage: node scripts/reset-password.mjs <username> <new-password>");
  console.log("Example: node scripts/reset-password.mjs admin my-new-long-password");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}:${hash}`;
}

const [, , usernameArg, passwordArg] = process.argv;
const username = (usernameArg || "").trim().toLowerCase();
const password = (passwordArg || "").trim();

if (!username || !password) {
  usage();
  process.exitCode = 1;
} else if (password.length < 10) {
  console.error("Password must be at least 10 characters long.");
  process.exitCode = 1;
} else {
  try {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      console.error(`User "${username}" not found.`);
      process.exitCode = 1;
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      });
      console.log(`Password reset for user "${username}".`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
