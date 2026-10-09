// Ctrl Studio's messages (shared/protocol/ctrl.ts): the Flotta of ctrlOS, read from the first time a
// page asks for it, and its floor furnished for it.
import { flottaSigns, flottaWing, isFlottaFloor, type FlottaState } from '../../shared/ctrl/flotta.js';
import type { CtrlClientMsg } from '../../shared/protocol.js';
import type { Ctx } from '../office/context.js';
import type { HandlerMap } from '../ws/handlers/types.js';
import { FlottaFeed, flottaConfig } from './flotta.js';

const feeds = new WeakMap<Ctx, FlottaFeed>();
/** The floors already furnished for the fleet in this run of the office, by id. */
const furnished = new WeakMap<Ctx, Set<string>>();

/** The office's fleet, read from now on. */
function feedOf(ctx: Ctx): FlottaFeed {
  let feed = feeds.get(ctx);
  if (!feed) {
    feed = new FlottaFeed(flottaConfig(), (state) => {
      furnish(ctx, state);
      ctx.broadcast({ t: 'flotta', state });
    });
    feeds.set(ctx, feed);
    feed.start();
  }
  return feed;
}

/**
 * The fleet's floor gets its back office built out as far as its desks need, and a sign over each
 * section, once per run of the office. A desk that already has a sign keeps it: whoever hung it
 * meant it, and taking one down sticks until the office restarts.
 */
function furnish(ctx: Ctx, state: FlottaState) {
  if (!state.agents.length) return;
  let done = furnished.get(ctx);
  if (!done) furnished.set(ctx, (done = new Set()));
  for (const floor of ctx.floors.values()) {
    if (done.has(floor.id) || !isFlottaFloor(floor.def, state.floor)) continue;
    done.add(floor.id);
    let changed = false;
    while (floor.plan.wing < flottaWing(state.agents) && typeof floor.plan.expand() !== 'string') changed = true;
    const labels = floor.plan.state().labels;
    for (const [desk, sign] of flottaSigns(state.agents)) {
      if (!labels[desk] && typeof floor.plan.label(desk, sign.text, sign.color, 'Flotta') !== 'string') changed = true;
    }
    if (!changed) continue;
    ctx.toFloor(floor, { t: 'plan', plan: floor.plan.state() });
    ctx.floorsChanged();
  }
}

export const ctrlHandlers = {
  'flotta.hello'(ctx, c) {
    const feed = feedOf(ctx);
    furnish(ctx, feed.state());
    ctx.sendTo(c, { t: 'flotta', state: feed.state() });
  },
} satisfies HandlerMap<CtrlClientMsg>;
