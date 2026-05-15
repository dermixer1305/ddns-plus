"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { IpProvider, ProviderType, RecordType } from "@prisma/client";
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { runDdnsUpdate } from "@/lib/ddns";
import { prisma } from "@/lib/prisma";
import { getTranslator, parseLocale } from "@/lib/i18n";
import { getProviderAdapter, listProviderAdapters } from "@/lib/providers/registry";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function assertAuthenticated() {
  const user = await getCurrentUser();
  if (!user) {
    const t = await getTranslator();
    throw new Error(t("error.notAuthenticated"));
  }
  return user;
}

export async function setupAction(formData: FormData) {
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/");

  const username = getString(formData, "username").toLowerCase() || "admin";
  const password = getString(formData, "password");

  if (!username || password.length < 10) {
    const t = await getTranslator();
    throw new Error(t("error.setupCredentials"));
  }

  const user = await prisma.user.create({
    data: { username, name: username, passwordHash: hashPassword(password) },
  });

  await createSession(user.id);
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const username = getString(formData, "username").toLowerCase();
  const password = getString(formData, "password");
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    const t = await getTranslator();
    throw new Error(t("error.loginFailed"));
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function saveProviderAction(formData: FormData) {
  await assertAuthenticated();

  const id = getString(formData, "id");
  const existingProvider = id ? await prisma.dnsProvider.findUnique({ where: { id } }) : null;
  const providerType = existingProvider?.type || parseProviderType(getString(formData, "providerType"));
  const adapter = getProviderAdapter(providerType);
  const name = getString(formData, "name") || adapter.defaultName;
  const apiToken = getString(formData, "apiToken");

  if (!apiToken && !existingProvider) {
    const t = await getTranslator();
    throw new Error(t("error.apiTokenRequired"));
  }

  if (existingProvider) {
    await prisma.dnsProvider.update({
      where: { id },
      data: { name, ...(apiToken ? { apiToken } : {}) },
    });
  } else {
    await prisma.dnsProvider.create({
      data: { name, apiToken, type: providerType },
    });
  }

  revalidatePath("/");
}

export async function deleteProviderAction(formData: FormData) {
  await assertAuthenticated();
  const id = getString(formData, "id");
  if (id) await prisma.dnsProvider.delete({ where: { id } });
  revalidatePath("/");
}

export async function saveZoneAction(formData: FormData) {
  await assertAuthenticated();

  const id = getString(formData, "id");
  const name = getString(formData, "name").toLowerCase();
  const zoneId = getString(formData, "zoneId");
  const providerId = getString(formData, "providerId");

  if (!name || !zoneId || !providerId) {
    const t = await getTranslator();
    throw new Error(t("error.zoneRequired"));
  }

  if (id) {
    await prisma.dnsZone.update({
      where: { id },
      data: { name, zoneId, providerId },
    });
  } else {
    await prisma.dnsZone.create({
      data: { name, zoneId, providerId },
    });
  }

  revalidatePath("/");
}

export async function deleteZoneAction(formData: FormData) {
  await assertAuthenticated();
  const id = getString(formData, "id");
  if (id) await prisma.dnsZone.delete({ where: { id } });
  revalidatePath("/");
}

export async function saveRecordAction(formData: FormData) {
  await assertAuthenticated();

  const id = getString(formData, "id");
  const hostname = getString(formData, "hostname").toLowerCase();
  const zoneRefId = getString(formData, "zoneRefId");
  const zoneRef = zoneRefId ? await prisma.dnsZone.findUnique({ where: { id: zoneRefId } }) : null;
  const zoneId = zoneRef?.zoneId || getString(formData, "zoneId");
  const recordName = getString(formData, "recordName");
  const recordType: RecordType = getString(formData, "recordType") === "AAAA" ? "AAAA" : "A";
  const providerId = zoneRef?.providerId || getString(formData, "providerId");
  const ttl = Number(getString(formData, "ttl") || "300");
  const enabled = formData.get("enabled") === "on";

  if (!hostname || !recordName || !zoneId || !providerId) {
    const t = await getTranslator();
    throw new Error(
      zoneRef
        ? t("error.recordRequiredWithStoredZone")
        : t("error.recordRequiredManual"),
    );
  }

  const data = {
    hostname,
    zoneId,
    recordName,
    recordType,
    providerId,
    zoneRefId: zoneRef?.id || null,
    ttl: Number.isFinite(ttl) ? ttl : 300,
    enabled,
  };

  if (id) {
    await prisma.ddnsRecord.update({ where: { id }, data });
  } else {
    await prisma.ddnsRecord.create({ data });
  }

  revalidatePath("/");
}

export async function deleteRecordAction(formData: FormData) {
  await assertAuthenticated();
  const id = getString(formData, "id");
  if (id) await prisma.ddnsRecord.delete({ where: { id } });
  revalidatePath("/");
}

export async function updateRecordAction(formData: FormData) {
  await assertAuthenticated();
  const id = getString(formData, "id");
  await runDdnsUpdate(id, true);
  revalidatePath("/");
}

export async function runAllUpdatesAction() {
  await assertAuthenticated();
  await runDdnsUpdate(undefined, true);
  revalidatePath("/");
}

export async function saveSettingsAction(formData: FormData) {
  await assertAuthenticated();

  const updatePeriodSeconds = Math.max(60, Number(getString(formData, "updatePeriodSeconds") || "300"));
  const cooldownSeconds = Math.max(0, Number(getString(formData, "cooldownSeconds") || "300"));
  const httpTimeoutSeconds = Math.min(60, Math.max(2, Number(getString(formData, "httpTimeoutSeconds") || "10")));
  const ipv4Provider = parseIpProvider(getString(formData, "ipv4Provider"));
  const ipv6Provider = parseIpProvider(getString(formData, "ipv6Provider"));
  const language = parseLocale(getString(formData, "language"));

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {
      language,
      updatePeriodSeconds,
      cooldownSeconds,
      httpTimeoutSeconds,
      ipv4Provider,
      ipv6Provider,
    },
    create: {
      language,
      updatePeriodSeconds,
      cooldownSeconds,
      httpTimeoutSeconds,
      ipv4Provider,
      ipv6Provider,
    },
  });

  revalidatePath("/");
}

function parseIpProvider(value: string): IpProvider {
  const providers: IpProvider[] = ["IPIFY", "ICANHAZIP", "IDENT", "SEEIP"];
  return providers.includes(value as IpProvider) ? (value as IpProvider) : "IPIFY";
}

function parseProviderType(value: string): ProviderType {
  return listProviderAdapters().some((provider) => provider.type === value)
    ? (value as ProviderType)
    : listProviderAdapters()[0].type;
}
