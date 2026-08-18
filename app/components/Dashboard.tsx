"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Report } from "@/lib/sheet";
import { useTheme } from "@/lib/theme";
import { refreshData } from "@/app/actions";
import { TrendChart, LeadsBar, SpendBar, DeliveryDonut, Sparkline } from "./charts";

const nf = (n: number) => n.toLocaleString("en-IN");
const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
const inr = (n: number, d = 2) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: d });

function UpdatedAt({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [iso]);
  return <span suppressHydrationWarning>{label ? `updated ${label}` : " "}</span>;
}

export default function Dashboard({
  report, source, fetchedAt,
}: {
  report: Report;
  source: "live" | "snapshot";
  fetchedAt: string;
}) {
  const { theme, palette: p, toggle } = useTheme();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = () =>
    startTransition(async () => {
      await refreshData();
      router.refresh();
    });

  const { days, totals: t, hasLeads, hasSpend } = report;
  const active = days.filter((d) => d.sent != null);
  const spark = (k: keyof (typeof active)[number]) =>
    active.map((d) => (d[k] as number | null) ?? 0);

  // ---- KPIs adapt to what the report actually tracks ----
  const kpis = hasSpend
    ? [
        { label: "Total Sent", val: nf(t.sent), meta: `${t.activeDays} active days · ${t.campaigns} campaigns`, spark: spark("sent"), feat: true },
        { label: "Delivered", val: nf(t.delivered), meta: `${pct(t.deliveryPct)} delivery rate`, spark: spark("delivered"), feat: false },
        { label: "Read", val: nf(t.read), meta: `${pct(t.readPct)} of delivered`, spark: spark("read"), feat: false },
        { label: "Amount Spent", val: inr(t.amountSpent, 0), meta: `across ${t.campaigns} campaigns`, spark: spark("amountSpent"), feat: true },
        { label: "Cost / Message", val: t.costPerMsg != null ? inr(t.costPerMsg) : "₹—", meta: "spend ÷ messages sent", spark: spark("amountSpent"), feat: false },
      ]
    : [
        { label: "Total Sent", val: nf(t.sent), meta: `${t.activeDays} active days · ${t.campaigns} campaigns`, spark: spark("sent"), feat: true },
        { label: "Delivered", val: nf(t.delivered), meta: `${pct(t.deliveryPct)} delivery rate`, spark: spark("delivered"), feat: false },
        { label: "Read", val: nf(t.read), meta: `${pct(t.readPct)} of delivered`, spark: spark("read"), feat: false },
        { label: "Leads Created", val: nf(t.leads), meta: `${pct(t.leadPct, 2)} of sent`, spark: spark("leads"), feat: true },
        { label: "Avg Cost / Lead", val: t.costPerLead != null ? inr(t.costPerLead) : "₹—", meta: t.costPerLead != null ? "spend ÷ leads" : "awaiting spend data", spark: spark("leads"), feat: false },
      ];

  const funnel = [
    { n: "Leads created", v: t.leads, c: p.teal },
    { n: "Unable to contact (UTC)", v: t.utc, c: p.warn },
    { n: "Unqualified", v: t.unqualified, c: p.bad },
    { n: "Follow-up active", v: t.followUp, c: p.gold },
    { n: "Scheduling / walk-in", v: t.scheduling, c: p.good },
  ];
  const fmax = Math.max(...funnel.map((f) => f.v)) || 1;

  const failed = t.failed > 0 ? t.failed : Math.max(t.sent - t.delivered, 0);
  const deliveredUnread = Math.max(t.delivered - t.read, 0);
  const leadMax = Math.max(...active.map((d) => d.leads ?? 0)) || 1;
  const spendMax = Math.max(...active.map((d) => d.amountSpent ?? 0)) || 1;
  const delTag = (v: number) => (v >= 50 ? "g" : v >= 40 ? "w" : "b");
  const dayDelPct = (d: (typeof days)[number]) =>
    d.deliveryPct ?? (d.sent && d.delivered ? (d.delivered / d.sent) * 100 : null);

  return (
    <div className="app">
      <div className="wrap">
        {/* Header */}
        <header className="top">
          <div className="brand">
            <div>
              <div className="eyebrow">indiagold · WhatsApp Growth</div>
              <h1>{report.name} Campaign Report</h1>
              <p className="sub">
                {hasSpend
                  ? "Gold-loan outreach · delivery & spend tracking"
                  : "Gold-loan lead acquisition · daily campaign tracking"}
              </p>
            </div>
          </div>
          <div className="chips">
            <span className="chip active">
              {active[0]?.date} – {active[active.length - 1]?.date} 2026
            </span>
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

        {/* KPIs */}
        <section className="kpis">
          {kpis.map((k) => (
            <div key={k.label} className={`kpi${k.feat ? " feature" : ""}`}>
              <div className="label">{k.label}</div>
              <div className="val">{k.val}</div>
              <div className="meta">{k.meta}</div>
              <div className="spark">
                <Sparkline values={k.spark} color={k.feat ? p.gold : p.teal} />
              </div>
            </div>
          ))}
        </section>

        {/* Trend + (funnel | spend summary) */}
        <section className="grid">
          <div className="card">
            <div className="card-head">
              <h2>Daily volume — Sent vs Delivered</h2>
              <span className="note">{active.length} active days</span>
            </div>
            <div className="legend">
              <span><i style={{ background: p.teal }} /> Sent</span>
              <span><i style={{ background: p.gold }} /> Delivered</span>
              <span><i style={{ background: p.inkSoft, opacity: 0.5 }} /> Read</span>
            </div>
            <TrendChart days={days} />
          </div>

          {hasLeads ? (
            <div className="card">
              <div className="card-head">
                <h2>Lead outcome funnel</h2>
                <span className="note">{nf(t.leads)} leads</span>
              </div>
              <div className="funnel">
                {funnel.map((f) => (
                  <div className="frow" key={f.n}>
                    <div className="flabel">
                      <span>{f.n}</span>
                      <span>
                        <b>{nf(f.v)}</b>
                        <span className="pct">{t.leads ? pct((f.v / t.leads) * 100) : "—"}</span>
                      </span>
                    </div>
                    <div className="bar">
                      <i style={{ width: `${(f.v / fmax) * 100}%`, background: f.c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-head">
                <h2>Spend summary</h2>
                <span className="note">{inr(t.amountSpent, 0)} total</span>
              </div>
              <div className="statlist">
                {[
                  { n: "Amount spent", v: inr(t.amountSpent, 2) },
                  { n: "Cost per message", v: t.costPerMsg != null ? inr(t.costPerMsg) : "—" },
                  { n: "Cost per delivered", v: t.delivered ? inr(t.amountSpent / t.delivered) : "—" },
                  { n: "Campaigns", v: nf(t.campaigns) },
                  { n: "Avg spend / campaign", v: t.campaigns ? inr(t.amountSpent / t.campaigns, 0) : "—" },
                ].map((s) => (
                  <div className="statrow" key={s.n}>
                    <span className="n">{s.n}</span>
                    <span className="v">{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Donut + (leads per day | spend per day) */}
        <section className="row2">
          <div className="card donut-card">
            <DeliveryDonut
              read={t.read}
              deliveredUnread={deliveredUnread}
              failed={failed}
              centerPct={Math.round(t.deliveryPct)}
            />
            <div className="donut-legend">
              <div className="eyebrow" style={{ marginBottom: 2 }}>Message delivery</div>
              {[
                { n: "Read", v: t.read, c: p.teal },
                { n: "Delivered, unread", v: deliveredUnread, c: p.gold },
                { n: "Failed / undelivered", v: failed, c: p.bad },
              ].map((s) => (
                <div className="dl" key={s.n}>
                  <span className="sw" style={{ background: s.c }} />
                  <span className="nm">{s.n}</span>
                  <span className="num">{nf(s.v)}</span>
                  <span className="pc">{t.sent ? pct((s.v / t.sent) * 100, 0) : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {hasLeads ? (
            <div className="card">
              <div className="card-head">
                <h2>Leads created per day</h2>
                <span className="note">peak {active.find((d) => (d.leads ?? 0) === leadMax)?.date}</span>
              </div>
              <LeadsBar days={days} />
            </div>
          ) : (
            <div className="card">
              <div className="card-head">
                <h2>Amount spent per day</h2>
                <span className="note">peak {active.find((d) => (d.amountSpent ?? 0) === spendMax)?.date}</span>
              </div>
              <SpendBar days={days} />
            </div>
          )}
        </section>

        {/* Table (columns adapt) */}
        <section className="card table-card">
          <div className="card-head">
            <h2>Daily breakdown</h2>
            <span className="note">all metrics · {t.activeDays} active campaign days</span>
          </div>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Camps</th><th>Sent</th><th>Delivered</th><th>Del %</th><th>Read</th>
                  {hasLeads && <><th>Leads</th><th>Lead %</th><th>Unqual %</th></>}
                  {hasSpend && <th>Spent</th>}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const span = 4 + (hasLeads ? 3 : 0) + (hasSpend ? 1 : 0);
                  return d.sent == null ? (
                    <tr className="muted-row" key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.campaigns ?? 0}</td>
                      <td colSpan={span}>No campaigns sent</td>
                    </tr>
                  ) : (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.campaigns ?? "—"}</td>
                      <td>{nf(d.sent)}</td>
                      <td>{nf(d.delivered ?? 0)}</td>
                      <td>
                        {dayDelPct(d) != null ? (
                          <span className={`tag ${delTag(dayDelPct(d)!)}`}>{pct(dayDelPct(d)!)}</span>
                        ) : "—"}
                      </td>
                      <td>{nf(d.read ?? 0)}</td>
                      {hasLeads && (
                        <>
                          <td>{d.leads ?? "—"}</td>
                          <td>{d.leadPct != null ? pct(d.leadPct, 2) : "—"}</td>
                          <td>{d.unqualifiedPct != null ? pct(d.unqualifiedPct) : "—"}</td>
                        </>
                      )}
                      {hasSpend && <td>{d.amountSpent != null ? inr(d.amountSpent) : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{t.campaigns}</td>
                  <td>{nf(t.sent)}</td>
                  <td>{nf(t.delivered)}</td>
                  <td>{pct(t.deliveryPct)}</td>
                  <td>{nf(t.read)}</td>
                  {hasLeads && (
                    <>
                      <td>{t.leads}</td>
                      <td>{pct(t.leadPct, 2)}</td>
                      <td>—</td>
                    </>
                  )}
                  {hasSpend && <td>{inr(t.amountSpent, 2)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="foot">
          <span>
            Data from <b>wpc-track</b> Google Sheet ·{" "}
            {source === "live" ? "live via CSV export" : "bundled snapshot (sheet not public yet)"} ·{" "}
            <UpdatedAt iso={fetchedAt} />
          </span>
          <span>
            {report.name} · Delivery {pct(t.deliveryPct)}
            {hasSpend ? ` · Spend ${inr(t.amountSpent, 0)}` : ` · Lead rate ${pct(t.leadPct, 2)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
