// Reads the Flotta of ctrlOS every so often and tells every browser when it changes (see
// shared/ctrl/flotta.ts). From ctrlOS's route when it's set up, else made-up numbers (demo.ts):
//
//   CTRL_FLOTTA_URL    the route, e.g. https://ctrlos.vercel.app/api/flotta/cron/stato
//   CTRL_FLOTTA_TOKEN  its bearer token (its own, revocable on its own; never in the code)
//   CTRL_FLOTTA_FLOOR  the floor the fleet sits on, by name or owner/name (default "flotta")
//   CTRL_BASE_URL      ctrlOS's address for the agents' pages (default the route's, else ctrlos.vercel.app)
import { FLOTTA_SECTIONS, type FlottaAgent, type FlottaRun, type FlottaSection, type FlottaState } from '../../shared/ctrl/flotta.js';
import { demoFleet } from './demo.js';

const EVERY_MS = 60_000;
/** The demo moves on the minute, so a page sees the turns change soon after they do. */
const DEMO_EVERY_MS = 20_000;
const TIMEOUT_MS = 15_000;
const MAX_AGENTS = 40;

export interface FlottaConfig {
  url?: string;
  token?: string;
  floor: string;
  base: string;
}

export function flottaConfig(env: NodeJS.ProcessEnv = process.env): FlottaConfig {
  const url = env.CTRL_FLOTTA_URL?.trim() || undefined;
  let base = env.CTRL_BASE_URL?.trim();
  if (!base && url) {
    try {
      base = new URL(url).origin;
    } catch {
      // a bad route is said so on its first read
    }
  }
  return { url, token: env.CTRL_FLOTTA_TOKEN?.trim() || undefined, floor: env.CTRL_FLOTTA_FLOOR?.trim() || 'flotta', base: base || 'https://ctrlos.vercel.app' };
}

const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/** One agent from the route, checked and trimmed, or undefined when it isn't one. */
export function cleanAgent(raw: unknown): FlottaAgent | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const chiave = text(r.chiave, 64);
  const nome = text(r.nome, 64);
  const sezione = FLOTTA_SECTIONS.find((s) => s === r.sezione) as FlottaSection | undefined;
  const href = text(r.href, 300);
  if (!chiave || !nome || !sezione || !href || !href.startsWith('/')) return undefined;
  const coda = typeof r.coda === 'number' && Number.isFinite(r.coda) ? Math.max(0, Math.floor(r.coda)) : 0;
  let ultimoRun: FlottaRun | null = null;
  const run = r.ultimoRun as Record<string, unknown> | null | undefined;
  if (run && typeof run === 'object' && typeof run.created_at === 'string' && Number.isFinite(Date.parse(run.created_at))) {
    ultimoRun = { ok: run.ok === true, created_at: run.created_at, messaggio: text(run.messaggio, 200) ?? null };
  }
  return { chiave, nome, sezione, href, coda, codaLabel: text(r.codaLabel, 60), ultimoRun };
}

/** The agents in what the route sent: `{ agenti: [...] }`, or the list itself. */
export function parseFleet(body: unknown): FlottaAgent[] {
  const list = Array.isArray(body) ? body : body && typeof body === 'object' ? (body as { agenti?: unknown }).agenti : undefined;
  if (!Array.isArray(list)) throw new Error('the route sent no list of agents');
  const seen = new Set<string>();
  const out: FlottaAgent[] = [];
  for (const raw of list.slice(0, MAX_AGENTS)) {
    const a = cleanAgent(raw);
    if (a && !seen.has(a.chiave)) {
      seen.add(a.chiave);
      out.push(a);
    }
  }
  return out;
}

export class FlottaFeed {
  private current: FlottaState;
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private cfg: FlottaConfig,
    /** Hears the fleet whenever it's different from the last read. */
    private changed: (state: FlottaState) => void,
    private fetcher: typeof fetch = fetch,
  ) {
    this.current = { floor: cfg.floor, base: cfg.base, source: cfg.url ? 'ctrlos' : 'demo', agents: cfg.url ? [] : demoFleet(Date.now()), at: Date.now() };
  }

  state(): FlottaState {
    return this.current;
  }

  /** Reads now, then every so often for as long as the office runs. */
  start() {
    void this.tick();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async tick() {
    await this.read();
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), this.cfg.url ? EVERY_MS : DEMO_EVERY_MS);
    this.timer.unref?.();
  }

  /** One read: the fleet as it is now, or (keeping the last one) why it couldn't be had. */
  async read(): Promise<void> {
    const { url, token, floor, base } = this.cfg;
    let next: FlottaState;
    if (!url) next = { floor, base, source: 'demo', agents: demoFleet(Date.now()), at: Date.now() };
    else {
      try {
        const res = await this.fetcher(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`ctrlOS answered ${res.status}`);
        next = { floor, base, source: 'ctrlos', agents: parseFleet(await res.json()), at: Date.now() };
      } catch (err) {
        next = { ...this.current, error: (err as Error).message.slice(0, 200) };
      }
    }
    // The time it was read at changes every time: only what's in it counts as a change.
    const same = JSON.stringify({ ...next, at: 0 }) === JSON.stringify({ ...this.current, at: 0 });
    this.current = next;
    if (!same) this.changed(next);
  }
}
