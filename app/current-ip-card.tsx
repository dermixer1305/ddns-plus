"use client";

import { useEffect, useState } from "react";

type IpState = {
  ipv4: { ip: string | null; error: string | null; checkedAt: string | null; needed: boolean };
  ipv6: { ip: string | null; error: string | null; checkedAt: string | null; needed: boolean };
};

type CurrentIpTexts = {
  publicIpv4: string;
  publicIpv6: string;
  notNeeded: string;
  notDetected: string;
  notChecked: string;
  lastCheck: string;
  ipv4Unused: string;
  ipv6Unused: string;
  detectFailed: string;
  locale: string;
};

export function CurrentIpCards({ texts }: { texts: CurrentIpTexts }) {
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
        setError(fetchError instanceof Error ? fetchError.message : texts.detectFailed);
      });

    return () => controller.abort();
  }, [texts.detectFailed]);

  return (
    <section className="ip-grid">
      <IpCard
        title={texts.publicIpv4}
        ip={state?.ipv4.ip}
        error={state?.ipv4.error || error}
        checkedAt={state?.ipv4.checkedAt}
        needed={state?.ipv4.needed ?? true}
        unusedMessage={texts.ipv4Unused}
        texts={texts}
      />
      <IpCard
        title={texts.publicIpv6}
        ip={state?.ipv6.ip}
        error={state?.ipv6.error || error}
        checkedAt={state?.ipv6.checkedAt}
        needed={state?.ipv6.needed ?? true}
        unusedMessage={texts.ipv6Unused}
        texts={texts}
      />
    </section>
  );
}

function IpCard({
  title,
  ip,
  error,
  checkedAt,
  needed,
  unusedMessage,
  texts,
}: {
  title: string;
  ip?: string | null;
  error?: string | null;
  checkedAt?: string | null;
  needed: boolean;
  unusedMessage: string;
  texts: CurrentIpTexts;
}) {
  const isNeeded = needed;
  const value = ip || (!isNeeded ? texts.notNeeded : error ? texts.notDetected : texts.notChecked);
  const checkedAtText = checkedAt
    ? texts.lastCheck.replace(
      "{date}",
      new Date(checkedAt).toLocaleString("en-US"),
    )
    : null;

  return (
    <div className="panel p-5">
      <p className="eyebrow">{title}</p>
      <p className="ip-value">{value}</p>
      {!isNeeded ? <p className="ip-meta">{unusedMessage}</p> : null}
      {checkedAtText ? <p className="ip-meta">{checkedAtText}</p> : null}
      {error && isNeeded ? <p className="ip-error">{error}</p> : null}
    </div>
  );
}
