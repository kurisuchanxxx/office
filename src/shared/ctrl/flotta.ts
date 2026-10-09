// The Flotta of ctrlOS (Ctrl Studio's back office: AI agents behind a button, not terminals) as the
// office shows it: who sits where on the floor they have to themselves, the signs over their
// sections, and how each one looks from what ctrlOS says about it. Pure code, for both sides.
//
// The agents' fields keep ctrlOS's own names (chiave, nome, sezione…), so what its route
// GET /api/flotta/cron/stato sends comes through as it is (see docs/ctrl/PIANO.md, step 2).

import { DESKS, DESK_SIZE, WING_DESKS, type DeskDef } from '../layout.js';

export type FlottaSection = 'sorveglianza' | 'produzione' | 'contatto';

export const FLOTTA_SECTIONS: readonly FlottaSection[] = ['sorveglianza', 'produzione', 'contatto'];

/** An agent's last run, as ctrlOS's agent_runs keeps it. */
export interface FlottaRun {
  ok: boolean;
  /** ISO time. */
  created_at: string;
  messaggio: string | null;
}

/** One agent of the fleet, as ctrlOS's route says. */
export interface FlottaAgent {
  /** Its key in ctrlOS ("blog-agent"). */
  chiave: string;
  nome: string;
  sezione: FlottaSection;
  /** Its page in ctrlOS, from the site's root ("/flotta/blog"). */
  href: string;
  /** How many things it has left waiting on a person. */
  coda: number;
  /** What those things are ("bozze da rivedere"); "—" or none for an agent with no queue. */
  codaLabel?: string;
  ultimoRun: FlottaRun | null;
}

/** The fleet as the office last read it, for every browser. */
export interface FlottaState {
  /** The floor it sits on: a floor's name, or its owner/name on GitHub. */
  floor: string;
  /** ctrlOS's address, which the agents' pages hang off. */
  base: string;
  /** Read from ctrlOS's route, or made up while there's none to read (see server/ctrl/demo.ts). */
  source: 'ctrlos' | 'demo';
  agents: FlottaAgent[];
  /** When it was read. */
  at: number;
  /** Why the last read failed, if it did: what's shown is the read before it. */
  error?: string;
}

/** Each section: what its sign says and its color (one of SIGN_COLORS), and the desks it fills, in order. */
export const SECTION: Record<FlottaSection, { label: string; color: string; desks: readonly string[] }> = {
  // The two pods by the boards, north of the room.
  produzione: { label: 'Produzione', color: '#06d6a0', desks: ['desk-1', 'desk-2', 'desk-3', 'desk-4', 'desk-5', 'desk-6', 'desk-7', 'desk-8'] },
  // The two pods to the south. They touch clients or money, so they get the warm color.
  contatto: { label: 'Contatto e incassi', color: '#f78c6b', desks: ['desk-9', 'desk-10', 'desk-11', 'desk-12', 'desk-13', 'desk-14'] },
  // The ones that only watch the numbers sit in the back office, built out both rows.
  sorveglianza: { label: 'Sorveglianza', color: '#118ab2', desks: ['desk-17', 'desk-18', 'desk-19', 'desk-20'] },
};

/** Where an agent goes when its section's desks are all taken (ctrlOS grew a section). */
export const SPARE_DESKS: readonly string[] = ['desk-15', 'desk-16'];

/** How long an agent that finished well keeps jumping about it. */
export const JUST_DONE_MS = 3 * 60_000;
/** An agent that hasn't run for this long is asleep. */
export const ASLEEP_MS = 30 * 24 * 3_600_000;

const ALL_DESKS = new Map<string, DeskDef>([...DESKS, ...WING_DESKS].map((d) => [d.id, d]));

/** Which desk each agent sits at, by its key: its section's desks in ctrlOS's order, then the spare ones. */
export function flottaSeats(agents: readonly FlottaAgent[]): Map<string, string> {
  const seats = new Map<string, string>();
  const spare = [...SPARE_DESKS];
  const free = new Map(FLOTTA_SECTIONS.map((s) => [s, [...SECTION[s].desks]]));
  for (const a of agents) {
    const desk = free.get(a.sezione)?.shift() ?? spare.shift();
    if (desk) seats.set(a.chiave, desk);
  }
  return seats;
}

/** The desk back to back with `id` across its pair, if there is one. */
function partner(id: string): string | undefined {
  const d = ALL_DESKS.get(id);
  if (!d) return undefined;
  for (const e of ALL_DESKS.values()) {
    if (e !== d && Math.abs(e.x - d.x) < 0.01 && Math.abs(Math.abs(e.z - d.z) - DESK_SIZE.depth) < 0.01) return e.id;
  }
  return undefined;
}

/**
 * The signs the fleet's floor hangs, by desk: one over each back-to-back pair its agents sit at,
 * naming the section. A sign reads the same from behind while its partner has none of its own.
 */
export function flottaSigns(agents: readonly FlottaAgent[]): Map<string, { text: string; color: string }> {
  const signs = new Map<string, { text: string; color: string }>();
  const bySeat = new Map([...flottaSeats(agents)].map(([chiave, desk]) => [desk, agents.find((a) => a.chiave === chiave)!]));
  for (const [desk, a] of bySeat) {
    const p = partner(desk);
    if (signs.has(desk) || (p && signs.has(p))) continue;
    signs.set(desk, { text: SECTION[a.sezione].label, color: SECTION[a.sezione].color });
  }
  return signs;
}

/** How many back office rows the fleet's floor needs built for its agents' desks. */
export function flottaWing(agents: readonly FlottaAgent[]): number {
  let rows = 0;
  for (const desk of flottaSeats(agents).values()) rows = Math.max(rows, ALL_DESKS.get(desk)?.wing ?? 0);
  return rows;
}

/** Whether `floor` (its name, or its owner/name) is the one the fleet sits on. */
export function isFlottaFloor(floor: { name: string; repo?: string } | undefined, wanted: string): boolean {
  if (!floor || !wanted) return false;
  const w = wanted.toLowerCase();
  return floor.name.toLowerCase() === w || floor.repo?.toLowerCase() === w;
}

/** How an agent looks at its desk: a worker's status light and whether it jumps, and the lines on its card and laptop. */
export interface FlottaLook {
  status: 'needs_input' | 'done' | 'idle' | 'exited';
  bounce: boolean;
  /** Under its name on the card over its head. */
  summary: string;
  /** On its laptop's screen. */
  screen: string;
}

/** "3 min fa", "5 h fa", "2 giorni fa". */
export function ago(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ieri' : `${d} giorni fa`;
}

/** What `a` has waiting on a person, in a few words ("3 bozze da rivedere"), or undefined for nothing. */
function queued(a: FlottaAgent): string | undefined {
  if (!(a.coda > 0)) return undefined;
  const what = a.codaLabel && a.codaLabel !== '—' ? a.codaLabel : 'in coda';
  return `${a.coda} ${what}`;
}

/**
 * Red, and jumping, while something waits on a person or its last run failed; a little celebration
 * just after it finished well; asleep (grey) once it hasn't run for a month; otherwise ready.
 */
export function flottaLook(a: FlottaAgent, now: number): FlottaLook {
  const run = a.ultimoRun;
  const at = run ? Date.parse(run.created_at) : NaN;
  const since = Number.isFinite(at) ? now - at : Infinity;
  const waiting = queued(a);
  const failed = run && !run.ok ? `⚠️ ultima corsa fallita${run.messaggio ? `: ${run.messaggio}` : ''}` : undefined;
  const last = Number.isFinite(since) ? `ultima corsa ${ago(since)}` : 'mai partita';
  if (waiting || failed) {
    const summary = [waiting, failed].filter(Boolean).join(' · ');
    return { status: 'needs_input', bounce: true, summary, screen: summary };
  }
  if (run?.ok && since < JUST_DONE_MS) return { status: 'done', bounce: true, summary: `✅ ha appena finito (${ago(since)})`, screen: 'tutto fatto, niente in coda' };
  if (since >= ASLEEP_MS) return { status: 'exited', bounce: false, summary: `💤 ${last}`, screen: `💤 ${last}` };
  return { status: 'idle', bounce: false, summary: last, screen: 'niente in coda' };
}

/** The page of `a` in ctrlOS. */
export function flottaHref(base: string, a: FlottaAgent): string {
  return `${base.replace(/\/+$/, '')}/${a.href.replace(/^\/+/, '')}`;
}
