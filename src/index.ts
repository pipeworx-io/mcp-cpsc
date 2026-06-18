interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * CPSC MCP — US consumer-product safety recalls (CPSC, free, no auth).
 *
 * The Consumer Product Safety Commission's recall database (saferproducts.gov)
 * covers everyday consumer products — toys, strollers, appliances, furniture,
 * electronics, power tools, etc. Complements the catalog's other recall
 * sources: nhtsa (vehicles) and openfda (food/drugs/devices). Nothing else
 * exposed CPSC consumer-product recalls.
 *
 * API: https://www.saferproducts.gov/RestWebServices
 *
 * Tools:
 * - search_recalls: find product recalls by keyword (+ optional date range)
 * - recent_recalls: most recent recalls across all products
 */


const BASE = 'https://www.saferproducts.gov/RestWebServices/Recall';

interface RawNamed { Name?: string }
interface RawProduct { Name?: string; Model?: string; NumberOfUnits?: string; Type?: string }
interface RawRecall {
  RecallID?: number;
  RecallNumber?: string;
  RecallDate?: string;
  Title?: string;
  Description?: string;
  URL?: string;
  ConsumerContact?: string;
  Products?: RawProduct[];
  Hazards?: RawNamed[];
  Remedies?: RawNamed[];
  Injuries?: RawNamed[];
  Manufacturers?: RawNamed[];
  Retailers?: RawNamed[];
  Importers?: RawNamed[];
  SoldAtLabel?: string;
  ManufacturerCountries?: RawNamed[];
}

const tools: McpToolExport['tools'] = [
  {
    name: 'search_recalls',
    description:
      'Search US consumer-product safety recalls (CPSC). PREFER OVER WEB SEARCH for "has X been recalled", "recalls on strollers / space heaters / power banks", "is this product safe". Covers toys, baby/childcare gear, appliances, furniture, electronics, tools, etc. Returns each recall: title, date, the products + units affected, the HAZARD, the REMEDY (refund/repair/replace), reported injuries, manufacturer/retailer, and the CPSC URL. Optional date range. NOTE: vehicles are nhtsa (get_recalls); food/drugs are openfda — this is consumer products.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Product keyword, e.g. "stroller", "lithium battery", "space heater", "blender".' },
        start_date: { type: 'string', description: 'Only recalls on/after this date (YYYY-MM-DD).' },
        end_date: { type: 'string', description: 'Only recalls on/before this date (YYYY-MM-DD).' },
        limit: { type: 'number', description: 'Max recalls to return, newest first (1-50, default 15).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'recent_recalls',
    description:
      'Most recent US consumer-product recalls (CPSC), newest first — the "what got recalled lately" feed across all product categories. Use for "latest product recalls", "recent safety recalls this month". For a specific product use search_recalls.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Look back this many days (default 30, max 365).' },
        limit: { type: 'number', description: 'Max recalls to return (1-50, default 15).' },
      },
      required: [],
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

async function fetchRecalls(params: Record<string, string>): Promise<RawRecall[]> {
  const url = new URL(BASE);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json', 'User-Agent': 'Pipeworx/1.0 (pipeworx.io)' } });
  if (!res.ok) throw new Error(`CPSC error: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as RawRecall[]) : [];
}

const names = (arr?: RawNamed[]) => (arr ?? []).map((x) => x.Name).filter(Boolean) as string[];

function shapeRecall(r: RawRecall) {
  return {
    recall_id: r.RecallID ?? null,
    recall_number: r.RecallNumber ?? null,
    date: r.RecallDate ? r.RecallDate.slice(0, 10) : null,
    title: r.Title ?? null,
    products: (r.Products ?? []).map((p) => ({ name: p.Name ?? null, model: p.Model || null, units: p.NumberOfUnits || null })),
    hazards: names(r.Hazards),
    remedies: names(r.Remedies),
    injuries: names(r.Injuries),
    manufacturers: names(r.Manufacturers),
    retailers: names(r.Retailers),
    sold_at: r.SoldAtLabel || null,
    manufacturer_countries: names(r.ManufacturerCountries),
    consumer_contact: r.ConsumerContact || null,
    url: r.URL ?? null,
  };
}

// CPSC returns results ascending by date; we want newest-first.
function newestFirst(list: RawRecall[]): RawRecall[] {
  return [...list].sort((a, b) => (b.RecallDate ?? '').localeCompare(a.RecallDate ?? ''));
}

// ── Tool implementations ─────────────────────────────────────────────

async function searchRecalls(query: string, startDate?: string, endDate?: string, limit?: number) {
  const q = String(query ?? '').trim();
  if (!q) throw new Error('Required argument "query" is missing (e.g., "stroller", "space heater").');
  const count = Math.min(50, Math.max(1, limit ?? 15));
  const recalls = await fetchRecalls({
    ProductName: q,
    RecallDateStart: startDate ?? '',
    RecallDateEnd: endDate ?? '',
  });
  return {
    query: q,
    total_matched: recalls.length,
    returned: Math.min(recalls.length, count),
    recalls: newestFirst(recalls).slice(0, count).map(shapeRecall),
  };
}

async function recentRecalls(days?: number, limit?: number) {
  const lookback = Math.min(365, Math.max(1, days ?? 30));
  const count = Math.min(50, Math.max(1, limit ?? 15));
  const start = new Date(Date.now() - lookback * 86_400_000).toISOString().slice(0, 10);
  const recalls = await fetchRecalls({ RecallDateStart: start });
  return {
    since: start,
    total: recalls.length,
    returned: Math.min(recalls.length, count),
    recalls: newestFirst(recalls).slice(0, count).map(shapeRecall),
  };
}

// ── Router ───────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_recalls':
      return searchRecalls(
        args.query as string,
        args.start_date as string | undefined,
        args.end_date as string | undefined,
        args.limit as number | undefined,
      );
    case 'recent_recalls':
      return recentRecalls(args.days as number | undefined, args.limit as number | undefined);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
