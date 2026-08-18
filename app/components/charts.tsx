"use client";

import {
  Area, AreaChart, Bar, BarChart, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useTheme } from "@/lib/theme";
import type { DayRecord } from "@/lib/sheet";

const nf = (n: number) => n.toLocaleString("en-IN");
const shortDate = (d: string) => d.replace(/-.*/, "");
const kFmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);

type TipRow = { name: string; value: number; color: string; suffix?: string };

function Tip({ title, rows }: { title: string; rows: TipRow[] }) {
  const { palette: p } = useTheme();
  return (
    <div
      style={{
        background: p.surface, border: `1px solid ${p.lineStrong}`, borderRadius: 10,
        padding: "9px 12px", boxShadow: "0 8px 24px -12px rgba(0,0,0,.4)", fontSize: 12.5,
      }}
    >
      <div style={{ fontWeight: 700, color: p.ink, marginBottom: 4 }}>{title}</div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: "flex", gap: 10, color: p.inkSoft, alignItems: "center" }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, display: "inline-block" }} />
          <span style={{ flex: 1 }}>{r.name}</span>
          <b style={{ color: p.ink }}>
            {nf(r.value)}
            {r.suffix ?? ""}
          </b>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Trend: Sent vs Delivered vs Read ---------------- */
export function TrendChart({ days }: { days: DayRecord[] }) {
  const { palette: p } = useTheme();
  const data = days.filter((d) => d.sent != null);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 14, right: 8, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.teal} stopOpacity={0.22} />
            <stop offset="1" stopColor={p.teal} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={p.line} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: p.muted, fontSize: 11 }} axisLine={{ stroke: p.line }} tickLine={false} />
        <YAxis tickFormatter={kFmt} tick={{ fill: p.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Tip
                title={String(label)}
                rows={[
                  { name: "Sent", value: payload[0]?.payload.sent ?? 0, color: p.teal },
                  { name: "Delivered", value: payload[0]?.payload.delivered ?? 0, color: p.gold },
                  { name: "Read", value: payload[0]?.payload.read ?? 0, color: p.inkSoft },
                ]}
              />
            ) : null
          }
        />
        <Area type="monotone" dataKey="sent" stroke={p.teal} strokeWidth={2.5} fill="url(#gSent)" dot={{ r: 3, fill: p.surface, stroke: p.teal, strokeWidth: 2 }} activeDot={{ r: 5 }} />
        <Area type="monotone" dataKey="delivered" stroke={p.gold} strokeWidth={2.5} fill="transparent" dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="read" stroke={p.inkSoft} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Leads created per day ---------------- */
export function LeadsBar({ days }: { days: DayRecord[] }) {
  const { palette: p } = useTheme();
  const data = days.filter((d) => d.sent != null);
  const max = Math.max(...data.map((d) => d.leads ?? 0));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={p.line} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: p.muted, fontSize: 11 }} axisLine={{ stroke: p.line }} tickLine={false} />
        <YAxis tick={{ fill: p.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
        <Tooltip
          cursor={{ fill: p.surface2 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Tip
                title={String(label)}
                rows={[
                  { name: "Leads", value: payload[0]?.payload.leads ?? 0, color: p.teal },
                  { name: "Lead %", value: payload[0]?.payload.leadPct ?? 0, color: p.gold, suffix: "%" },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="leads" radius={[5, 5, 0, 0]} maxBarSize={38}>
          {data.map((d, i) => (
            <Cell key={i} fill={(d.leads ?? 0) === max ? p.gold : p.teal} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Delivery donut ---------------- */
export function DeliveryDonut({
  read, deliveredUnread, failed, centerPct,
}: {
  read: number; deliveredUnread: number; failed: number; centerPct: number;
}) {
  const { palette: p } = useTheme();
  const segs = [
    { name: "Read", value: read, color: p.teal },
    { name: "Delivered, unread", value: deliveredUnread, color: p.gold },
    { name: "Failed / undelivered", value: failed, color: p.bad },
  ];
  return (
    <div style={{ position: "relative", width: 180, height: 180, flex: "none" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={segs} dataKey="value" innerRadius={58} outerRadius={80} startAngle={90} endAngle={-270} stroke="none" paddingAngle={1}>
            {segs.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: p.ink, lineHeight: 1 }}>{centerPct}%</div>
        <div style={{ fontSize: 10, letterSpacing: ".1em", color: p.muted, fontWeight: 600 }}>DELIVERED</div>
      </div>
    </div>
  );
}

/* ---------------- KPI sparkline ---------------- */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
