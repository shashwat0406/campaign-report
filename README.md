# WPC Dashboard — OneXtel Campaign Analytics

A Next.js dashboard visualizing the **OneXtel** WhatsApp campaign block of the
`wpc-track` Google Sheet, for indiagold's gold-loan lead acquisition.

Stack: Next.js 16 (App Router) · Tailwind v4 · Recharts · TypeScript.

## Run

```bash
npm run dev
```

Open http://localhost:3000

## Data source

The dashboard reads the sheet through the public **CSV export** endpoint
(`/export?format=csv`) and parses *every* transposed "Campaign Track Report"
block — currently **OneXtel** and **SMARTPING** — into per-day records
([lib/sheet.ts](lib/sheet.ts)). Switch between them with the Slack-style
workspace rail on the left.

> We use `export?format=csv` rather than the `gviz` endpoint because gviz
> infers one type per column and silently blanks mixed cells (it dropped the
> SMARTPING dates and the ₹ Amount Spent values); the raw export is faithful.

- If the sheet tab is publicly readable, it shows **live** data (revalidated
  every 5 minutes) — you'll see a green "Live · sheet" chip.
- Otherwise it falls back to a **bundled snapshot** (05–13 Aug 2026) so the UI
  always renders — an amber "Snapshot" chip.

### To go live

Make the sheet readable by "Anyone with the link" (Viewer), or
File → Share → Publish to web for the relevant tab. No credentials needed.

Override the target sheet/tab with env vars if needed:

```bash
NEXT_PUBLIC_SHEET_ID=<id>
NEXT_PUBLIC_SHEET_GID=<gid>
```

## Structure

| Path | Purpose |
| --- | --- |
| `lib/sheet.ts` | Fetch + CSV parse of the OneXtel block, totals, snapshot fallback |
| `lib/theme.tsx` | Light/dark theme context + palette (also drives Recharts colors) |
| `app/page.tsx` | Server component — fetches data, renders the workspace |
| `app/components/Workspace.tsx` | Slack-style rail; switches the active report |
| `app/components/Dashboard.tsx` | Report-aware layout: KPIs, funnel/spend, donut, table |
| `app/components/charts.tsx` | Recharts: trend, leads bar, spend bar, donut, sparklines |
| `app/actions.ts` | Server action for the on-demand Refresh button |
| `app/globals.css` | Design tokens + component styles |

The dashboard adapts to each report's metrics: reports with lead data
(OneXtel) show the lead funnel + leads-per-day; reports with spend data
(SMARTPING) show a spend summary + amount-spent-per-day and Cost/Message KPIs.

## Next steps

- Add the **lead-level tables** (Converted/Scheduling and Follow-up) as a
  filterable table with owner / city / lender breakdowns.
- Deploy (e.g. Vercel) for an always-on shared URL.
