import test from 'node:test';
import assert from 'node:assert/strict';
import { ASLEEP_MS, flottaHref, flottaLook, flottaSeats, flottaSigns, flottaWing, isFlottaFloor, JUST_DONE_MS, SECTION, type FlottaAgent } from '../src/shared/ctrl/flotta.ts';
import { canLabel, SIGN_COLORS } from '../src/shared/floorplan.ts';
import { demoFleet } from '../src/server/ctrl/demo.ts';
import { cleanAgent, FlottaFeed, flottaConfig, parseFleet } from '../src/server/ctrl/flotta.ts';

const NOW = Date.parse('2026-10-09T10:20:00Z');
const agent = (over: Partial<FlottaAgent> = {}): FlottaAgent => ({
  chiave: 'blog-agent',
  nome: 'Blog',
  sezione: 'produzione',
  href: '/flotta/blog',
  coda: 0,
  codaLabel: 'bozze da rivedere',
  ultimoRun: { ok: true, created_at: new Date(NOW - 5 * 3_600_000).toISOString(), messaggio: null },
  ...over,
});

test('the whole fleet sits down: each section at its own desks, in ctrlOS order', () => {
  const fleet = demoFleet(NOW);
  assert.equal(fleet.length, 18);
  const seats = flottaSeats(fleet);
  assert.equal(seats.size, 18);
  assert.equal(new Set(seats.values()).size, 18, 'nobody shares a desk');
  for (const a of fleet) assert.ok(SECTION[a.sezione].desks.includes(seats.get(a.chiave)!), `${a.nome} sits with ${a.sezione}`);
  assert.equal(seats.get('marginalita'), 'desk-17');
  assert.equal(seats.get('meeting-recap'), 'desk-1');
  assert.equal(seats.get('lead-scout'), 'desk-9');
  assert.equal(flottaWing(fleet), 2, 'the watchers need the back office built out both rows');
});

test('a section that outgrows its desks spills onto the spare ones, and past those nobody sits', () => {
  const many = Array.from({ length: 12 }, (_, i) => agent({ chiave: `a${i}`, sezione: 'sorveglianza' }));
  const seats = flottaSeats(many);
  assert.deepEqual([...seats.values()], ['desk-17', 'desk-18', 'desk-19', 'desk-20', 'desk-15', 'desk-16']);
});

test('one sign per back-to-back pair, naming the section in its color', () => {
  const signs = flottaSigns(demoFleet(NOW));
  // Produzione's two pods, Contatto's pod and the back row of the next, Sorveglianza's two rows out back.
  assert.deepEqual([...signs.keys()].sort(), ['desk-1', 'desk-2', 'desk-5', 'desk-6', 'desk-9', 'desk-10', 'desk-13', 'desk-14', 'desk-17', 'desk-19'].sort());
  for (const [desk, sign] of signs) {
    assert.ok(canLabel(desk), `${desk} can have a sign`);
    assert.ok(SIGN_COLORS.some((c) => c.color === sign.color), `${sign.color} is a sign color`);
  }
  assert.equal(signs.get('desk-17')?.text, 'Sorveglianza');
  assert.equal(signs.get('desk-9')?.text, 'Contatto e incassi');
});

test('red and jumping while something waits or the last run failed, and saying what', () => {
  const waiting = flottaLook(agent({ coda: 3 }), NOW);
  assert.equal(waiting.status, 'needs_input');
  assert.equal(waiting.bounce, true);
  assert.equal(waiting.summary, '3 bozze da rivedere');
  const failed = flottaLook(agent({ ultimoRun: { ok: false, created_at: new Date(NOW - 60_000).toISOString(), messaggio: 'timeout' } }), NOW);
  assert.equal(failed.status, 'needs_input');
  assert.match(failed.summary, /fallita: timeout/);
  // An agent with no queue of its own ("—") says it plainly.
  assert.equal(flottaLook(agent({ coda: 2, codaLabel: '—' }), NOW).summary, '2 in coda');
});

test('just done jumps for a while, a month without a run is asleep, otherwise ready', () => {
  const run = (ago: number) => ({ ok: true, created_at: new Date(NOW - ago).toISOString(), messaggio: null });
  assert.equal(flottaLook(agent({ ultimoRun: run(60_000) }), NOW).status, 'done');
  assert.equal(flottaLook(agent({ ultimoRun: run(JUST_DONE_MS + 1) }), NOW).status, 'idle');
  assert.equal(flottaLook(agent({ ultimoRun: run(ASLEEP_MS + 1) }), NOW).status, 'exited');
  assert.equal(flottaLook(agent({ ultimoRun: null }), NOW).status, 'exited');
  assert.equal(flottaLook(agent(), NOW).summary, 'ultima corsa 5 h fa');
});

test('the fleet’s floor is found by name or owner/name, whatever the case', () => {
  assert.ok(isFlottaFloor({ name: 'flotta' }, 'Flotta'));
  assert.ok(isFlottaFloor({ name: 'x', repo: 'kurisuchanxxx/Flotta' }, 'kurisuchanxxx/flotta'));
  assert.ok(!isFlottaFloor({ name: 'ctrlos', repo: 'kurisuchanxxx/ctrlos' }, 'flotta'));
  assert.ok(!isFlottaFloor(undefined, 'flotta'));
  assert.equal(flottaHref('https://ctrlos.vercel.app/', agent()), 'https://ctrlos.vercel.app/flotta/blog');
});

test('what the route sends is checked: bad agents are dropped, the rest trimmed', () => {
  assert.equal(cleanAgent({ chiave: 'x', nome: 'X', sezione: 'altro', href: '/x' }), undefined);
  assert.equal(cleanAgent({ chiave: 'x', nome: 'X', sezione: 'produzione', href: 'https://evil.example' }), undefined, 'only pages of ctrlOS itself');
  const a = cleanAgent({ chiave: 'x', nome: 'X', sezione: 'produzione', href: '/x', coda: 2.7, ultimoRun: { ok: 'yes', created_at: 'nonsense' } });
  assert.equal(a?.coda, 2);
  assert.equal(a?.ultimoRun, null);
  const list = parseFleet({ agenti: [agent(), agent(), agent({ chiave: 'other' }), 42] });
  assert.deepEqual(
    list.map((x) => x.chiave),
    ['blog-agent', 'other'],
  );
  assert.throws(() => parseFleet({ nope: true }), /no list/);
});

test('the demo only changes when something in it does', () => {
  const a = JSON.stringify(demoFleet(NOW));
  assert.equal(JSON.stringify(demoFleet(NOW + 20_000)), a, 'twenty seconds later it is the same');
  assert.notEqual(JSON.stringify(demoFleet(NOW + 4 * 60_000)), a, 'the next turn, somebody else just finished');
  assert.ok(demoFleet(NOW).some((x) => flottaLook(x, NOW).status === 'done'), 'somebody is always just done');
});

test('config: the demo without a route; the base follows the route unless set', () => {
  assert.deepEqual(flottaConfig({}), { url: undefined, token: undefined, floor: 'flotta', base: 'https://ctrlos.vercel.app' });
  const c = flottaConfig({ CTRL_FLOTTA_URL: 'https://ctrl.example/api/flotta/cron/stato', CTRL_FLOTTA_TOKEN: 't', CTRL_FLOTTA_FLOOR: 'kurisuchanxxx/flotta' });
  assert.equal(c.base, 'https://ctrl.example');
  assert.equal(c.floor, 'kurisuchanxxx/flotta');
});

test('the feed reads the route with its token, tells only of changes, and keeps the last fleet when a read fails', async () => {
  let body: unknown = { agenti: [agent({ coda: 1 })] };
  let status = 200;
  const asked: { url: string; auth?: string }[] = [];
  const fetcher = (async (url: string, init?: { headers?: Record<string, string> }) => {
    asked.push({ url, auth: init?.headers?.authorization });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  const heard: number[] = [];
  const feed = new FlottaFeed({ url: 'https://ctrl.example/api/flotta/cron/stato', token: 'secret', floor: 'flotta', base: 'https://ctrl.example' }, (s) => heard.push(s.agents.length), fetcher);
  await feed.read();
  assert.equal(asked[0].auth, 'Bearer secret');
  assert.equal(feed.state().source, 'ctrlos');
  assert.equal(heard.length, 1);
  await feed.read();
  assert.equal(heard.length, 1, 'the same fleet again is no news');
  status = 500;
  await feed.read();
  assert.equal(feed.state().agents.length, 1, 'still the last fleet');
  assert.match(feed.state().error ?? '', /500/);
  status = 200;
  body = { agenti: [agent(), agent({ chiave: 'other' })] };
  await feed.read();
  assert.equal(feed.state().error, undefined);
  assert.deepEqual(heard, [1, 1, 2]);
});
