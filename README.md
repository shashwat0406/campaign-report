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

The dashboard reads the sheet through the public **gviz CSV** endpoint and
parses the transposed OneXtel report block ([lib/sheet.ts](lib/sheet.ts)).

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
| `app/page.tsx` | Server component — fetches data, renders the dashboard |
| `app/components/Dashboard.tsx` | Layout: KPIs, funnel, donut, table |
| `app/components/charts.tsx` | Recharts: trend area chart, leads bar, delivery donut, sparklines |
| `app/globals.css` | Design tokens + component styles |

## Next steps

- Add the **SMARTPING** report block (second `Date` row in the same tab).
- Add the **lead-level tables** (Converted/Scheduling and Follow-up) as a
  filterable table with owner / city / lender breakdowns.
- Wire **Amount Spent** to compute real Cost/Lead once SMARTPING spend flows in.
