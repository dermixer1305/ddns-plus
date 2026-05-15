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

export function RecordForm({
  providers,
  zones,
  defaults,
  submitLabel = "Record speichern",
}: {
  providers: ProviderOption[];
  zones: ZoneOption[];
  defaults?: RecordDefaults;
  submitLabel?: string;
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
      <TextInput name="hostname" label="Hostname" placeholder="home.example.com" defaultValue={defaults?.hostname} required />
      <label className="field">
        <span>Gespeicherte Domain</span>
        <select name="zoneRefId" value={selectedZoneRefId} onChange={(event) => setSelectedZoneRefId(event.target.value)}>
          <option value="">Manuelle Zone verwenden</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>{zone.name} ({zone.providerName})</option>
          ))}
        </select>
      </label>
      {selectedZone ? (
        <div className="readonly-field">
          <span>Zone</span>
          <strong>{selectedZone.name}</strong>
          <small>{selectedZone.zoneId}</small>
        </div>
      ) : (
        <TextInput name="zoneId" label="Zone ID oder Name" placeholder="Manuelle Zone ID oder Name" defaultValue={defaults?.zoneId} />
      )}
      <TextInput
        name="recordName"
        label="Record / RRSet Name"
        placeholder="home oder home.example.com"
        defaultValue={defaults?.recordName}
        required
      />
      <label className="field">
        <span>Typ</span>
        <select name="recordType" defaultValue={defaults?.recordType || "A"}>
          <option value="A">IPv4 (A)</option>
          <option value="AAAA">IPv6 (AAAA)</option>
        </select>
      </label>
      <label className="field">
        <span>Provider</span>
        <select
          name="providerId"
          value={providerId}
          disabled={Boolean(selectedZone) || providers.length === 0}
          onChange={(event) => setManualProviderId(event.target.value)}
        >
          <option value="">{providers.length === 0 ? "Zuerst Provider anlegen" : "Provider manuell wählen"}</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.name} ({provider.type})</option>
          ))}
        </select>
        {selectedZone ? <input type="hidden" name="providerId" value={selectedZone.providerId} /> : null}
      </label>
      <TextInput name="ttl" label="TTL" type="number" defaultValue={defaults?.ttl ?? 300} />
      <label className="toggle">
        <input name="enabled" type="checkbox" defaultChecked={defaults?.enabled ?? true} />
        <span>Aktiv</span>
      </label>
      <button className="secondary-button" type="submit" disabled={providers.length === 0}>{submitLabel}</button>
    </form>
  );
}
