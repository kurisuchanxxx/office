// The fleet while ctrlOS has no route to read it from (CTRL_FLOTTA_URL unset): its real 18 agents,
// as web/lib/flotta.ts in ctrlOS lists them, with made-up numbers that move with the clock so the
// floor has something going on. Only agents' names and counts: nothing about clients or leads.
import type { FlottaAgent, FlottaSection } from '../../shared/ctrl/flotta.js';

/** chiave, nome, sezione, href, codaLabel: ctrlOS's AGENTI, in its order. */
const AGENTS: [string, string, FlottaSection, string, string][] = [
  ['marginalita', 'Marginalità', 'sorveglianza', '/flotta/margini', 'segnalazioni'],
  ['delivery', 'Delivery Watchdog', 'sorveglianza', '/flotta/delivery', 'anomalie'],
  ['weekly-digest', 'Weekly Digest', 'sorveglianza', '/flotta/digest', 'digest'],
  ['diagnosi-recap', 'Diagnosi Recap', 'sorveglianza', '/diagnosi', 'da gestire'],
  ['meeting-recap', 'Meeting Recap', 'produzione', '/flotta/meeting', '—'],
  ['onboarding', 'Onboarding AI', 'produzione', '/clienti', '—'],
  ['blog-agent', 'Blog', 'produzione', '/flotta/blog', 'bozze da rivedere'],
  ['linkedin-agent', 'LinkedIn', 'produzione', '/flotta/linkedin', 'post da rivedere'],
  ['progetto-publisher', 'Progetti', 'produzione', '/flotta/progetti', 'schede da rivedere'],
  ['case-study', 'Case Study', 'produzione', '/flotta/casestudy', 'bozze da rivedere'],
  ['scoping', 'Scoping', 'produzione', '/flotta/scoping', 'stime aperte'],
  ['audit', 'Audit', 'produzione', '/flotta/audit', 'audit da rivedere'],
  ['lead-scout', 'Lead Scout', 'contatto', '/reach?fase=valuta', 'prospect in valutazione'],
  ['outreach-drafter', 'Outreach', 'contatto', '/reach?fase=valuta', 'bozze nel pool'],
  ['mockup-designer', 'Mockup Designer', 'contatto', '/reach?fase=valuta&filtro=senza_mockup', 'prospect senza mockup'],
  ['collections', 'Collections', 'contatto', '/approvazioni', 'in approvazione'],
  ['rinnovi', 'Rinnovi', 'contatto', '/flotta/rinnovi', 'clienti da riattivare'],
  ['report-cliente', 'Report Cliente', 'contatto', '/flotta/report', 'report da rivedere'],
];

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** How each one is getting on, by key: its queue, and how long ago it last ran (and whether that went well). */
const STATE: Record<string, { coda: number; ranAgo: number; ok?: boolean; messaggio?: string }> = {
  marginalita: { coda: 1, ranAgo: 2 * DAY },
  delivery: { coda: 0, ranAgo: 5 * HOUR },
  'weekly-digest': { coda: 0, ranAgo: 4 * DAY },
  'diagnosi-recap': { coda: 0, ranAgo: 9 * DAY },
  'meeting-recap': { coda: 0, ranAgo: 2 * DAY },
  onboarding: { coda: 0, ranAgo: 45 * DAY },
  'blog-agent': { coda: 2, ranAgo: 20 * HOUR },
  'linkedin-agent': { coda: 0, ranAgo: 3 * HOUR },
  'progetto-publisher': { coda: 0, ranAgo: 6 * DAY },
  'case-study': { coda: 1, ranAgo: 3 * DAY },
  scoping: { coda: 0, ranAgo: 7 * HOUR, ok: false, messaggio: 'timeout della chiamata al modello' },
  audit: { coda: 0, ranAgo: 1 * DAY },
  'lead-scout': { coda: 12, ranAgo: 2 * HOUR },
  'outreach-drafter': { coda: 4, ranAgo: 2 * HOUR },
  'mockup-designer': { coda: 3, ranAgo: 2 * HOUR },
  collections: { coda: 0, ranAgo: 1 * DAY },
  rinnovi: { coda: 2, ranAgo: 3 * DAY },
  'report-cliente': { coda: 0, ranAgo: 8 * DAY },
};

/** The ones that take turns finishing a run, one every few minutes, so somebody's always just done. */
const TAKING_TURNS = ['linkedin-agent', 'delivery', 'audit', 'collections', 'progetto-publisher', 'report-cliente'];
const TURN_MS = 4 * MIN;

/**
 * The fleet as it would be at `now`. Its times hang off the start of the hour (and the turn's off
 * the start of its turn), so reading it again a minute later finds nothing new unless something is.
 */
export function demoFleet(now: number): FlottaAgent[] {
  const slot = Math.floor(now / TURN_MS);
  const turn = TAKING_TURNS[slot % TAKING_TURNS.length];
  const hour = Math.floor(now / HOUR) * HOUR;
  return AGENTS.map(([chiave, nome, sezione, href, codaLabel]) => {
    const s = STATE[chiave];
    const ranAt = chiave === turn ? slot * TURN_MS : hour - s.ranAgo;
    // The scout keeps finding a few more prospects as the hour goes on.
    const coda = chiave === 'lead-scout' ? s.coda + Math.floor((now / (10 * MIN)) % 6) : s.coda;
    const ok = chiave === turn ? true : (s.ok ?? true);
    return {
      chiave,
      nome,
      sezione,
      href,
      codaLabel,
      coda,
      ultimoRun: { ok, created_at: new Date(ranAt).toISOString(), messaggio: ok ? null : (s.messaggio ?? null) },
    };
  });
}
