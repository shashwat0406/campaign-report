"use client";

import { useState } from "react";
import type { SheetData } from "@/lib/sheet";
import Dashboard from "./Dashboard";
import CurrentNumbers from "./CurrentNumbers";

const CURRENT_SLUG = "current-numbers";

// Two-letter workspace badge from a report name (OneXtel -> OX, SMARTPING -> SP).
function initials(name: string) {
  const caps = name.replace(/[^A-Za-z]/g, "");
  const upper = caps.replace(/[^A-Z]/g, "");
  if (upper.length >= 2) return upper.slice(0, 2);
  return (caps[0] + (caps[1] ?? "")).toUpperCase();
}

export default function Workspace({ data }: { data: SheetData }) {
  const { reports, currentNumbers, source, fetchedAt } = data;

  // Rail tabs: one per report, plus a "Current Numbers" tab when the sheet has it.
  const tabs = [
    ...reports.map((r) => ({ slug: r.slug, name: r.name, badge: initials(r.name) })),
    ...(currentNumbers ? [{ slug: CURRENT_SLUG, name: "Current Numbers", badge: "CN" }] : []),
  ];

  const [activeSlug, setActiveSlug] = useState(tabs[0]?.slug);
  const active = tabs.find((t) => t.slug === activeSlug) ?? tabs[0];
  const activeReport = reports.find((r) => r.slug === active?.slug);

  return (
    <div className="shell">
      <nav className="rail" aria-label="Report workspaces">
        <div className="rail-list">
          {tabs.map((t) => (
            <button
              key={t.slug}
              className={`ws${t.slug === active?.slug ? " active" : ""}`}
              onClick={() => setActiveSlug(t.slug)}
              title={t.name}
              aria-current={t.slug === active?.slug}
            >
              <span className="ws-badge">{t.badge}</span>
              <span className="ws-tip">{t.name}</span>
            </button>
          ))}
        </div>
      </nav>
      <div className="rail-content">
        {activeReport ? (
          <Dashboard report={activeReport} source={source} fetchedAt={fetchedAt} />
        ) : currentNumbers ? (
          <CurrentNumbers data={currentNumbers} source={source} />
        ) : null}
      </div>
    </div>
  );
}
