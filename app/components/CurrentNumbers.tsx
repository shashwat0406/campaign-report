"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CurrentNumbers as CurrentNumbersData } from "@/lib/sheet";
import { useTheme } from "@/lib/theme";
import { refreshData } from "@/app/actions";

const nf = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number, d = 2) => `${n.toFixed(d)}%`;

export default function CurrentNumbers({
  data, source,
}: {
  data: CurrentNumbersData;
  source: "live" | "snapshot";
}) {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = () =>
    startTransition(async () => {
      await refreshData();
      router.refresh();
    });

  // Each metric shows its live value, or "NA" when the sheet leaves it blank.
  const cards: { label: string; val: string }[] = [
    { label: "Follow up (LSQ)", val: data.followUpLsq != null ? nf(data.followUpLsq) : "NA" },
    { label: "Scheduling / Branch walk-in (LSQ)", val: data.schedulingLsq != null ? nf(data.schedulingLsq) : "NA" },
    { label: "Unqualified", val: data.unqualified != null ? nf(data.unqualified) : "NA" },
    { label: "Unqualified %", val: data.unqualifiedPct != null ? pct(data.unqualifiedPct) : "NA" },
    { label: "UTC", val: data.utc != null ? nf(data.utc) : "NA" },
    { label: "UTC %", val: data.utcPct != null ? pct(data.utcPct) : "NA" },
  ];

  return (
    <div className="app">
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <div>
              <div className="eyebrow">indiagold · WhatsApp Growth</div>
              <h1>Current Numbers</h1>
              <p className="sub">Live lead-pipeline snapshot · as on today</p>
            </div>
          </div>
          <div className="chips">
            <span className={`chip ${source}`}>
              <span className="dot" />
              {source === "live" ? "Live · sheet" : "Snapshot"}
            </span>
            <button className="chip button" onClick={refresh} disabled={pending} aria-label="Refresh data from sheet">
              <span className={pending ? "spin" : ""}>↻</span>
              {pending ? "Refreshing…" : "Refresh"}
            </button>
            <button className="chip button" onClick={toggle} aria-label="Toggle theme">
              {theme === "light" ? "🌙 Dark" : "☀ Light"}
            </button>
          </div>
        </header>

        <section className="kpis">
          {cards.map((c) => (
            <div key={c.label} className={`kpi${c.val === "NA" ? " na" : ""}`}>
              <div className="label">{c.label}</div>
              <div className="val">{c.val}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
