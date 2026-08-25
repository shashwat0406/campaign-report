// Fetches and parses the WhatsApp "Campaign Track Report" blocks from the
// wpc-track Google Sheet via the raw CSV export endpoint.
//
// The sheet is transposed (metrics = rows, dates = columns) and stacks
// multiple report blocks vertically (OneXtel, then SMARTPING). We use the
// `export?format=csv` endpoint rather than `gviz` because gviz infers one
// type per column and silently blanks mixed cells (SMARTPING dates, ₹ spend).

export const SHEET_ID =
  process.env.NEXT_PUBLIC_SHEET_ID ?? "1TXj2DDiffxG8IER_Ux3R4LEkPgqeJ9ys9TxS0WFn_Y4";
export const SHEET_GID = process.env.NEXT_PUBLIC_SHEET_GID ?? "0";

export const csvUrl = (id = SHEET_ID, gid = SHEET_GID) =>
  `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;

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
  amountSpent: number | null;
  disburse: number | null;
  cac: number | null;
  followUpLsq: number | null;
  schedulingLsq: number | null;
};

// Block-level "Current Numbers" pipeline snapshot (from the "As on Today"
// column). Any metric the sheet leaves blank stays null and renders as "NA".
export type CurrentNumbers = {
  followUpLsq: number | null;
  schedulingLsq: number | null;
  unqualified: number | null;
  unqualifiedPct: number | null;
  utc: number | null;
  utcPct: number | null;
};

export type Totals = {
  campaigns: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  leads: number;
  utc: number;
  followUp: number;
  scheduling: number;
  unqualified: number;
  amountSpent: number;
  deliveryPct: number;
  leadPct: number;
  readPct: number;
  costPerLead: number | null;
  costPerMsg: number | null;
  activeDays: number;
  // Aggregate summary values read from the sheet's "As on Today" column.
  disburse: number | null;
  spend: number | null;
  cac: number | null;
};

export type Report = {
  name: string;
  slug: string;
  days: DayRecord[];
  totals: Totals;
  hasLeads: boolean;
  hasSpend: boolean;
};

export type SheetData = {
  reports: Report[];
  currentNumbers: CurrentNumbers | null;
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
  "scheduling/branch walkin": "scheduling",
  "follow up %": "followUpPct",
  "scheduling %": "schedulingPct",
  unqualified: "unqualified",
  "unqualified %": "unqualifiedPct",
  "amount spent": "amountSpent",
  disburse: "disburse",
  cac: "cac",
  "follow up (lsq)": "followUpLsq",
  "scheduling/branch walkin (lsq)": "schedulingLsq",
};

const TITLE_RE = /campaign track report\s*-\s*(.+)/i;

function emptyDay(date: string): DayRecord {
  return {
    date, campaigns: null, sent: null, delivered: null, deliveryPct: null,
    urlClicks: null, failed: null, read: null, leads: null, leadPct: null,
    utc: null, utcPct: null, followUp: null, scheduling: null, followUpPct: null,
    schedulingPct: null, unqualified: null, unqualifiedPct: null, amountSpent: null,
    disburse: null, cac: null, followUpLsq: null, schedulingLsq: null,
  };
}

// Extracts the "Current Numbers" pipeline snapshot from a block's aggregate
// ("As on Today") record. Returns null if the block carries none of them.
function currentNumbersFrom(s: DayRecord | undefined): CurrentNumbers | null {
  if (!s) return null;
  const cn: CurrentNumbers = {
    followUpLsq: s.followUpLsq,
    schedulingLsq: s.schedulingLsq,
    unqualified: s.unqualified,
    unqualifiedPct: s.unqualifiedPct,
    utc: s.utc,
    utcPct: s.utcPct,
  };
  return Object.values(cn).some((v) => v != null) ? cn : null;
}

type Block = { name: string; days: DayRecord[]; summary: DayRecord };

// Parses every "Campaign Track Report - X" block in the sheet into DayRecords.
// The "As on Today" column holds block-level aggregates (Disburse, Amount
// Spent, CAC) rather than a day, so it's pulled out into a `summary` record.
export function parseReports(csv: string): Block[] {
  const rows = parseCsv(csv);
  const blocks: Block[] = [];
  let i = 0;
  while (i < rows.length) {
    const m = (rows[i][0] ?? "").match(TITLE_RE);
    if (!m) {
      i++;
      continue;
    }
    const name = m[1].trim();
    // Find the Date row heading this block.
    let d = i + 1;
    while (d < rows.length && norm(rows[d][0]) !== "date") d++;
    if (d >= rows.length) break;

    const dateRow = rows[d];
    const cols: number[] = [];
    const days: DayRecord[] = [];
    const summary = emptyDay("As on Today");
    let summaryCol = -1;
    for (let c = 1; c < dateRow.length; c++) {
      const h = norm(dateRow[c]);
      if (h === "") continue;
      if (h === "as on today") {
        summaryCol = c; // aggregate column, not a day
        continue;
      }
      cols.push(c);
      days.push(emptyDay(dateRow[c].trim()));
    }
    // Read metric rows until the next block title or Date row.
    let r = d + 1;
    for (; r < rows.length; r++) {
      if (TITLE_RE.test(rows[r][0] ?? "") || norm(rows[r][0]) === "date") break;
      const key = LABELS[norm(rows[r][0])];
      if (!key) continue;
      cols.forEach((col, idx) => {
        (days[idx] as Record<string, number | null | string>)[key] = num(rows[r][col]);
      });
      if (summaryCol >= 0) {
        (summary as Record<string, number | null | string>)[key] = num(rows[r][summaryCol]);
      }
    }
    blocks.push({ name, days, summary });
    i = r;
  }
  return blocks;
}

function summarizeReport(name: string, days: DayRecord[], summary?: DayRecord): Report {
  const active = days.filter((x) => x.sent != null);
  const add = (k: keyof DayRecord) =>
    active.reduce((a, x) => a + ((x[k] as number | null) ?? 0), 0);
  const sent = add("sent");
  const delivered = add("delivered");
  const read = add("read");
  const leads = add("leads");
  const amountSpent = add("amountSpent");
  // Prefer the sheet's aggregate ("As on Today") spend; fall back to the
  // per-day sum for reports that only track spend daily (e.g. SMARTPING).
  const spend = summary?.amountSpent ?? (amountSpent > 0 ? amountSpent : null);
  const disburse = summary?.disburse ?? null;
  const cac = summary?.cac ?? null;
  const hasLeads = active.some((x) => (x.leads ?? 0) > 0);
  const hasSpend = active.some((x) => (x.amountSpent ?? 0) > 0);
  return {
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    days,
    hasLeads,
    hasSpend,
    totals: {
      campaigns: add("campaigns"),
      sent, delivered, read,
      failed: add("failed"),
      leads,
      utc: add("utc"),
      followUp: add("followUp"),
      scheduling: add("scheduling"),
      unqualified: add("unqualified"),
      amountSpent,
      deliveryPct: sent ? (delivered / sent) * 100 : 0,
      leadPct: sent ? (leads / sent) * 100 : 0,
      readPct: delivered ? (read / delivered) * 100 : 0,
      costPerLead: amountSpent > 0 && leads > 0 ? amountSpent / leads : null,
      costPerMsg: amountSpent > 0 && sent > 0 ? amountSpent / sent : null,
      activeDays: active.length,
      disburse,
      spend,
      cac,
    },
  };
}

// ---- Bundled snapshot fallback (used only if the sheet isn't public) ----
const OX = (
  date: string, campaigns: number | null, sent: number | null, delivered: number | null,
  deliveryPct: number | null, failed: number | null, read: number | null, leads: number | null,
  leadPct: number | null, utc: number | null, followUp: number | null, scheduling: number | null,
  unqualified: number | null, unqualifiedPct: number | null
): DayRecord => ({
  ...emptyDay(date), campaigns, sent, delivered, deliveryPct, failed, read, leads,
  leadPct, utc, followUp, scheduling, unqualified, unqualifiedPct,
});

const SP = (
  date: string, campaigns: number | null, sent: number | null, delivered: number | null,
  failed: number | null, read: number | null, amountSpent: number | null
): DayRecord => ({ ...emptyDay(date), campaigns, sent, delivered, failed, read, amountSpent });

const SNAPSHOT: { name: string; days: DayRecord[]; summary?: DayRecord }[] = [
  {
    name: "OneXtel",
    summary: {
      ...emptyDay("As on Today"),
      disburse: 3125000, amountSpent: 120000, cac: 3.84,
      followUpLsq: 36, schedulingLsq: 5, unqualified: 507, utc: 1425,
    },
    days: [
      OX("05-Aug", 2, 35213, 11113, 31.56, 23783, 6498, 211, 1.9, 104, 7, 7, 91, 43.13),
      OX("06-Aug", 1, 2072, 1125, 54.3, 908, 628, 21, 1.87, 17, 2, 0, 8, 38.1),
      OX("07-Aug", 1, 31993, 16445, 51.4, 15073, 8556, 64, 0.39, 31, 3, 2, 24, 37.5),
      OX("08-Aug", 1, 19767, 10814, 54.71, 8831, 6025, 62, 0.57, 25, 9, 2, 25, 40.32),
      OX("09-Aug", 1, 19722, 9992, 50.66, 9603, 5622, 42, 0.42, 28, 2, 0, 8, 19.05),
      OX("10-Aug", 1, 19826, 10227, 51.58, 9284, 5140, 79, 0.77, 45, 4, 2, 21, 26.58),
      OX("11-Aug", 1, 22302, 7237, 32.45, 14926, 3806, 42, 0.58, 17, 3, 2, 14, 33.33),
      OX("12-Aug", 0, null, null, null, null, null, null, null, null, null, null, null, null),
      OX("13-Aug", 2, 92592, 47001, 50.76, 43185, 27441, 282, 0.6, 148, 9, 3, 86, 30.5),
    ],
  },
  {
    name: "SMARTPING",
    days: [
      SP("13-Aug", 1, 243, 149, 94, 110, 139.3),
      SP("14-Aug", 1, 157, 101, 56, 78, 90.9),
      SP("15-Aug", null, null, null, null, null, null),
      SP("16-Aug", null, null, null, null, null, null),
      SP("17-Aug", 2, 830, 440, 380, 303, 396),
      SP("18-Aug", 1, 350, 173, 154, 50, 155.7),
    ],
  },
];

export async function getSheetData(): Promise<SheetData> {
  try {
    const res = await fetch(csvUrl(), { next: { revalidate: 300 } });
    const text = await res.text();
    if (!res.ok || text.trimStart().startsWith("<")) throw new Error("not public");
    const blocks = parseReports(text);
    const withData = blocks.filter((b) => b.days.some((x) => x.sent != null));
    if (!withData.length) throw new Error("empty");
    return {
      reports: withData.map((b) => summarizeReport(b.name, b.days, b.summary)),
      currentNumbers: withData.map((b) => currentNumbersFrom(b.summary)).find(Boolean) ?? null,
      source: "live",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      reports: SNAPSHOT.map((b) => summarizeReport(b.name, b.days, b.summary)),
      currentNumbers: SNAPSHOT.map((b) => currentNumbersFrom(b.summary)).find(Boolean) ?? null,
      source: "snapshot",
      fetchedAt: new Date().toISOString(),
    };
  }
}
