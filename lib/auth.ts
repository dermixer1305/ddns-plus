import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const cookieName = "ddns_plus_session";
const maxAgeSeconds = 60 * 60 * 24 * 30;

function sessionSecret() {
  return process.env.SESSION_SECRET || "dev-only-ddns-plus-secret";
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "base64url");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string) {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const payload = `${userId}.${expiresAt}`;
  const token = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;

  const [userId, expiresAt, signature] = token.split(".");
  if (!userId || !expiresAt || !signature) return null;

  const payload = `${userId}.${expiresAt}`;
  if (sign(payload) !== signature || Number(expiresAt) < Date.now()) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}
