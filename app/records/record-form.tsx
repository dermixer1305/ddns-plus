"use client";

import { useMemo, useState } from "react";
import { saveRecordAction } from "@/app/actions";
import { TextInput } from "@/app/ui";

type ProviderOption = {
  id: string;
  name: string;
  type: string;
};

type ZoneOption = {
  id: string;
  name: string;
  zoneId: string;
  providerId: string;
  providerName: string;
};

type RecordDefaults = {
  id?: string;
  hostname?: string;
  zoneRefId?: string | null;
  zoneId?: string;
  recordName?: string;
  recordType?: "A" | "AAAA";
  providerId?: string;
  ttl?: number;
  enabled?: boolean;
};

export type RecordFormTexts = {
  save: string;
  savedDomain: string;
  manualZone: string;
  zone: string;
  zoneId: string;
  zoneIdPlaceholder: string;
  recordName: string;
  recordNamePlaceholder: string;
  type: string;
  provider: string;
  hostname: string;
  createProviderFirst: string;
  chooseProviderManual: string;
  active: string;
};

export function RecordForm({
  providers,
  zones,
  defaults,
  submitLabel,
  texts,
}: {
  providers: ProviderOption[];
  zones: ZoneOption[];
  defaults?: RecordDefaults;
  submitLabel?: string;
  texts: RecordFormTexts;
}) {
  const [selectedZoneRefId, setSelectedZoneRefId] = useState(defaults?.zoneRefId || "");
  const [manualProviderId, setManualProviderId] = useState(defaults?.providerId || "");
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneRefId) || null,
    [selectedZoneRefId, zones],
  );
  const providerId = selectedZone?.providerId || manualProviderId;

  return (
    <form action={saveRecordAction} className="form-grid mt-5">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <TextInput name="hostname" label={texts.hostname} placeholder="home.example.com" defaultValue={defaults?.hostname} required />
      <label className="field">
        <span>{texts.savedDomain}</span>
        <select name="zoneRefId" value={selectedZoneRefId} onChange={(event) => setSelectedZoneRefId(event.target.value)}>
          <option value="">{texts.manualZone}</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>{zone.name} ({zone.providerName})</option>
          ))}
        </select>
      </label>
      {selectedZone ? (
        <div className="readonly-field">
          <span>{texts.zone}</span>
          <strong>{selectedZone.name}</strong>
          <small>{selectedZone.zoneId}</small>
        </div>
      ) : (
        <TextInput name="zoneId" label={texts.zoneId} placeholder={texts.zoneIdPlaceholder} defaultValue={defaults?.zoneId} />
      )}
      <TextInput
        name="recordName"
        label={texts.recordName}
        placeholder={texts.recordNamePlaceholder}
        defaultValue={defaults?.recordName}
        required
      />
      <label className="field">
        <span>{texts.type}</span>
        <select name="recordType" defaultValue={defaults?.recordType || "A"}>
          <option value="A">IPv4 (A)</option>
          <option value="AAAA">IPv6 (AAAA)</option>
        </select>
      </label>
      <label className="field">
        <span>{texts.provider}</span>
        <select
          name="providerId"
          value={providerId}
          disabled={Boolean(selectedZone) || providers.length === 0}
          onChange={(event) => setManualProviderId(event.target.value)}
        >
          <option value="">{providers.length === 0 ? texts.createProviderFirst : texts.chooseProviderManual}</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.name} ({provider.type})</option>
          ))}
        </select>
        {selectedZone ? <input type="hidden" name="providerId" value={selectedZone.providerId} /> : null}
      </label>
      <TextInput name="ttl" label="TTL" type="number" defaultValue={defaults?.ttl ?? 300} />
      <label className="toggle">
        <input name="enabled" type="checkbox" defaultChecked={defaults?.enabled ?? true} />
        <span>{texts.active}</span>
      </label>
      <button className="secondary-button" type="submit" disabled={providers.length === 0}>{submitLabel || texts.save}</button>
    </form>
  );
}
