"use client";

import { useEffect, useState } from "react";

type IpState = {
  ipv4: { ip: string | null; error: string | null; checkedAt: string | null };
  ipv6: { ip: string | null; error: string | null; checkedAt: string | null };
};

export function CurrentIpCards() {
  const [state, setState] = useState<IpState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/current-ip", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as IpState;
      })
      .then(setState)
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "IP-Erkennung fehlgeschlagen");
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="ip-grid">
      <IpCard title="Öffentliche IPv4" ip={state?.ipv4.ip} error={state?.ipv4.error || error} checkedAt={state?.ipv4.checkedAt} />
      <IpCard title="Öffentliche IPv6" ip={state?.ipv6.ip} error={state?.ipv6.error || error} checkedAt={state?.ipv6.checkedAt} />
    </section>
  );
}

function IpCard({
  title,
  ip,
  error,
  checkedAt,
}: {
  title: string;
  ip?: string | null;
  error?: string | null;
  checkedAt?: string | null;
}) {
  return (
    <div className="panel p-5">
      <p className="eyebrow">{title}</p>
      <p className="ip-value">{ip || (error ? "Nicht erkannt" : "Noch nicht geprüft")}</p>
      {checkedAt ? <p className="ip-meta">Letzte Prüfung: {new Date(checkedAt).toLocaleString("de-DE")}</p> : null}
      {error ? <p className="ip-error">{error}</p> : null}
    </div>
  );
}
