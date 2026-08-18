"use client";

import { useState } from "react";
import type { SheetData } from "@/lib/sheet";
import Dashboard from "./Dashboard";

// Two-letter workspace badge from a report name (OneXtel -> OX, SMARTPING -> SP).
function initials(name: string) {
  const caps = name.replace(/[^A-Za-z]/g, "");
  const upper = caps.replace(/[^A-Z]/g, "");
  if (upper.length >= 2) return upper.slice(0, 2);
  return (caps[0] + (caps[1] ?? "")).toUpperCase();
}

export default function Workspace({ data }: { data: SheetData }) {
  const { reports, source, fetchedAt } = data;
  const [activeSlug, setActiveSlug] = useState(reports[0]?.slug);
  const active = reports.find((r) => r.slug === activeSlug) ?? reports[0];

  return (
    <div className="shell">
      <nav className="rail" aria-label="Report workspaces">
      
        <div className="rail-list">
          {reports.map((r) => (
            <button
              key={r.slug}
              className={`ws${r.slug === active.slug ? " active" : ""}`}
              onClick={() => setActiveSlug(r.slug)}
              title={r.name}
              aria-current={r.slug === active.slug}
            >
              <span className="ws-badge">{initials(r.name)}</span>
              <span className="ws-tip">{r.name}</span>
            </button>
          ))}
        </div>
      </nav>
      <div className="rail-content">
        <Dashboard report={active} source={source} fetchedAt={fetchedAt} />
      </div>
    </div>
  );
}
