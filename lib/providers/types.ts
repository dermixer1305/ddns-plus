import { DdnsRecord, DnsProvider, ProviderType } from "@prisma/client";
import { RuntimeSettings } from "@/lib/settings";

export type DdnsRecordWithProvider = DdnsRecord & { provider: DnsProvider };

export type ProviderUpdateResult = {
  changed: boolean;
  message: string;
  previousValues?: string[];
};

export type ProviderRecordInput = {
  record: DdnsRecordWithProvider;
  ip: string;
  settings: RuntimeSettings;
};

export type DnsProviderAdapter = {
  type: ProviderType;
  displayName: string;
  defaultName: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  zoneLabel: string;
  zonePlaceholder: string;
  recordLabel: string;
  recordPlaceholder: string;
  updateRecord(input: ProviderRecordInput): Promise<ProviderUpdateResult>;
};
