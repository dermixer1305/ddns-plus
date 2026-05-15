import { IpProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RuntimeSettings = {
  language: string;
  updatePeriodSeconds: number;
  cooldownSeconds: number;
  httpTimeoutSeconds: number;
  ipv4Provider: IpProvider;
  ipv6Provider: IpProvider;
  lastPublicIpv4?: string | null;
  lastPublicIpv4Error?: string | null;
  lastPublicIpv4At?: Date | null;
  lastPublicIpv6?: string | null;
  lastPublicIpv6Error?: string | null;
  lastPublicIpv6At?: Date | null;
  lastUpdateStartedAt?: Date | null;
  lastUpdateFinishedAt?: Date | null;
  lastUpdateStatus?: string | null;
  lastUpdateMessage?: string | null;
};

export const defaultSettings: RuntimeSettings = {
  language: "de",
  updatePeriodSeconds: 300,
  cooldownSeconds: 300,
  httpTimeoutSeconds: 10,
  ipv4Provider: "IPIFY",
  ipv6Provider: "IPIFY",
};

export async function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: defaultSettings,
  });
}
