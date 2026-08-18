// Fetches and parses the OneXtel "Campaign Track Report" block from the
// wpc-track Google Sheet via the public gviz CSV endpoint.
//
// The sheet is transposed: metrics are rows, dates are columns. There are
// multiple stacked report blocks (OneXtel, then SMARTPING); we read the
// first "Date" row and the labelled metric rows immediately below it.

export const SHEET_ID =
  process.env.NEXT_PUBLIC_SHEET_ID ?? "1TXj2DDiffxG8IER_Ux3R4LEkPgqeJ9ys9TxS0WFn_Y4";
export const SHEET_GID = process.env.NEXT_PUBLIC_SHEET_GID ?? "0";

export const csvUrl = (id = SHEET_ID, gid = SHEET_GID) =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;

export type DayRecord = {
  date: string;
  campaigns: number | null;
  sent: number | null;
  delivered: number | null;
  deliveryPct: number | null;
  urlClicks: number | null;
  failed: number | null;
  read: number | null;
  leads: number | null;
  leadPct: number | null;
  utc: number | null;
  utcPct: number | null;
  followUp: number | null;
  scheduling: number | null;
  followUpPct: number | null;
  schedulingPct: number | null;
  unqualified: number | null;
  unqualifiedPct: number | null;
};

export type OneXtelData = {
  days: DayRecord[];
  totals: {
    campaigns: number;
    sent: number;
    delivered: number;
    read: number;
    leads: number;
    utc: number;
    followUp: number;
    scheduling: number;
    unqualified: number;
    deliveryPct: number;
    leadPct: number;
    readPct: number;
    activeDays: number;
  };
  source: "live" | "snapshot";
  fetchedAt: string;
};

// ---- CSV parsing (RFC-4180-ish, handles quotes and embedded newlines) ----
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const norm = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

function num(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = raw.replace(/[₹,%\s]/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Maps normalized OneXtel row labels to record keys.
const LABELS: Record<string, keyof DayRecord> = {
  "campaign count": "campaigns",
  "total sent": "sent",
  delivered: "delivered",
  "delivery %": "deliveryPct",
  "url clicks": "urlClicks",
  failed: "failed",
  read: "read",
  "leads created": "leads",
  "lead %": "leadPct",
  utc: "utc",
  "utc %": "utcPct",
  "follow up": "followUp",
  "scheduling/branch walkin - query": "scheduling",
  "follow up %": "followUpPct",
  "scheduling %": "schedulingPct",
  unqualified: "unqualified",
  "unqualified %": "unqualifiedPct",
};

export function parseOneXtel(csv: string): DayRecord[] {
  const rows = parseCsv(csv);
  // Find the first "Date" row — this heads the OneXtel block.
  const dateRowIdx = rows.findIndex((r) => norm(r[0]) === "date");
  if (dateRowIdx === -1) return [];

  const dateRow = rows[dateRowIdx];
  const dateCols: number[] = [];
  const dates: string[] = [];
  for (let c = 1; c < dateRow.length; c++) {
    if (norm(dateRow[c]) !== "") {
      dateCols.push(c);
      dates.push(dateRow[c].trim());
    }
  }

  const days: DayRecord[] = dates.map((date) => ({
    date,
    campaigns: null,
    sent: null,
    delivered: null,
    deliveryPct: null,
    urlClicks: null,
    failed: null,
    read: null,
    leads: null,
    leadPct: null,
    utc: null,
    utcPct: null,
    followUp: null,
    scheduling: null,
    followUpPct: null,
    schedulingPct: null,
    unqualified: null,
    unqualifiedPct: null,
  }));

  // Walk rows below the Date row until the next section (another "Date" row).
  for (let r = dateRowIdx + 1; r < rows.length; r++) {
    const label = norm(rows[r][0]);
    if (label === "date") break; // reached the SMARTPING block
    const key = LABELS[label];
    if (!key) continue;
    dateCols.forEach((col, i) => {
      (days[i] as Record<string, number | null | string>)[key] = num(rows[r][col]);
    });
  }
  return days;
}

export function summarize(days: DayRecord[], source: OneXtelData["source"]): OneXtelData {
  const active = days.filter((d) => d.sent != null);
  const add = (k: keyof DayRecord) =>
    active.reduce((a, d) => a + ((d[k] as number | null) ?? 0), 0);
  const sent = add("sent");
  const delivered = add("delivered");
  const read = add("read");
  const leads = add("leads");
  return {
    days,
    totals: {
      campaigns: add("campaigns"),
      sent,
      delivered,
      read,
      leads,
      utc: add("utc"),
      followUp: add("followUp"),
      scheduling: add("scheduling"),
      unqualified: add("unqualified"),
      deliveryPct: sent ? (delivered / sent) * 100 : 0,
      leadPct: sent ? (leads / sent) * 100 : 0,
      readPct: delivered ? (read / delivered) * 100 : 0,
      activeDays: active.length,
    },
    source,
    fetchedAt: new Date().toISOString(),
  };
}

// Bundled snapshot (05–13 Aug 2026) so the dashboard always renders even if
// the sheet isn't publicly shared yet.
export const SNAPSHOT: DayRecord[] = [
  { date: "05-Aug", campaigns: 2, sent: 35213, delivered: 11113, deliveryPct: 31.56, urlClicks: null, failed: 23783, read: 6498, leads: 211, leadPct: 1.9, utc: 104, utcPct: 49.29, followUp: 7, scheduling: 7, followUpPct: 3.32, schedulingPct: 3.32, unqualified: 91, unqualifiedPct: 43.13 },
  { date: "06-Aug", campaigns: 1, sent: 2072, delivered: 1125, deliveryPct: 54.3, urlClicks: null, failed: 908, read: 628, leads: 21, leadPct: 1.87, utc: 17, utcPct: 80.95, followUp: 2, scheduling: 0, followUpPct: 9.52, schedulingPct: 0, unqualified: 8, unqualifiedPct: 38.1 },
  { date: "07-Aug", campaigns: 1, sent: 31993, delivered: 16445, deliveryPct: 51.4, urlClicks: null, failed: 15073, read: 8556, leads: 64, leadPct: 0.39, utc: 31, utcPct: 48.44, followUp: 3, scheduling: 2, followUpPct: 4.69, schedulingPct: 3.13, unqualified: 24, unqualifiedPct: 37.5 },
  { date: "08-Aug", campaigns: 1, sent: 19767, delivered: 10814, deliveryPct: 54.71, urlClicks: null, failed: 8831, read: 6025, leads: 62, leadPct: 0.57, utc: 25, utcPct: 40.32, followUp: 9, scheduling: 2, followUpPct: 14.52, schedulingPct: 3.23, unqualified: 25, unqualifiedPct: 40.32 },
  { date: "09-Aug", campaigns: 1, sent: 19722, delivered: 9992, deliveryPct: 50.66, urlClicks: null, failed: 9603, read: 5622, leads: 42, leadPct: 0.42, utc: 28, utcPct: 66.67, followUp: 2, scheduling: 0, followUpPct: 4.76, schedulingPct: 0, unqualified: 8, unqualifiedPct: 19.05 },
  { date: "10-Aug", campaigns: 1, sent: 19826, delivered: 10227, deliveryPct: 51.58, urlClicks: null, failed: 9284, read: 5140, leads: 79, leadPct: 0.77, utc: 45, utcPct: 56.96, followUp: 4, scheduling: 2, followUpPct: 5.06, schedulingPct: 2.53, unqualified: 21, unqualifiedPct: 26.58 },
  { date: "11-Aug", campaigns: 1, sent: 22302, delivered: 7237, deliveryPct: 32.45, urlClicks: null, failed: 14926, read: 3806, leads: 42, leadPct: 0.58, utc: 17, utcPct: 40.48, followUp: 3, scheduling: 2, followUpPct: 7.14, schedulingPct: 4.76, unqualified: 14, unqualifiedPct: 33.33 },
  { date: "12-Aug", campaigns: 0, sent: null, delivered: null, deliveryPct: null, urlClicks: null, failed: null, read: null, leads: null, leadPct: null, utc: null, utcPct: null, followUp: null, scheduling: null, followUpPct: null, schedulingPct: null, unqualified: null, unqualifiedPct: null },
  { date: "13-Aug", campaigns: 2, sent: 92592, delivered: 47001, deliveryPct: 50.76, urlClicks: 1606, failed: 43185, read: 27441, leads: 282, leadPct: 0.6, utc: 148, utcPct: 52.48, followUp: 9, scheduling: 3, followUpPct: 3.19, schedulingPct: 1.06, unqualified: 86, unqualifiedPct: 30.5 },
];

export async function getOneXtelData(): Promise<OneXtelData> {
  try {
    const res = await fetch(csvUrl(), { next: { revalidate: 300 } });
    const text = await res.text();
    // A non-public sheet returns an HTML sign-in page, not CSV.
    if (!res.ok || text.trimStart().startsWith("<")) throw new Error("not public");
    const days = parseOneXtel(text);
    if (!days.length || days.every((d) => d.sent == null)) throw new Error("empty");
    return summarize(days, "live");
  } catch {
    return summarize(SNAPSHOT, "snapshot");
  }
}
