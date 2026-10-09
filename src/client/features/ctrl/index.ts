import type { Ctx } from '../../core/context';
import { aside, hintTitle, key, onE } from '../../core/hint';
import { store } from '../../state';
import { flottaHref, isFlottaFloor, type FlottaState } from '../../../shared/ctrl/flotta';
import { Fleet } from './fleet';

// The kinds of thing you can use that this defines (see InteractKinds in world/types.ts).
declare module '../../world/types' {
  interface InteractKinds {
    flotta: true;
  }
}

/**
 * Ctrl Studio's Flotta: the agents of ctrlOS at the desks of the floor they have to themselves (see
 * shared/ctrl/flotta.ts and docs/ctrl/PIANO.md). Red and jumping while something waits on a person,
 * and E at one opens its page in ctrlOS, where that's done.
 */
export function installFlotta(ctx: Ctx): Fleet {
  let state: FlottaState | null = null;
  const fleet = new Fleet(
    () => ctx.world().desks,
    () => ctx.office.interactables,
    () => ctx.world().device,
  );

  /** On the fleet's floor, in the office (a map of its own has its own seats): its agents sit down; anywhere else, none. */
  function sync() {
    const here = state && ctx.inOffice() && isFlottaFloor(store.floors.find((f) => f.id === store.floor), state.floor);
    fleet.sync(here && state ? state.agents : []);
  }

  ctx.messages.on('welcome', () => ctx.net.send({ t: 'flotta.hello' }));
  ctx.messages.on('flotta', (m) => {
    state = m.state;
    sync();
  });
  for (const topic of ['floor', 'floors', 'workers', 'floorPlan'] as const) store.on(topic, sync);

  ctx.usables.add({ usable: () => fleet.usable() });
  /** When the agents' looks were last brought up to the clock (a run that "just finished" stops being news). */
  let paintedAt = 0;
  ctx.ticks.add('others', ({ dt, t, now }) => {
    if (!fleet.seated.size) return;
    if (now - paintedAt > 1000) {
      paintedAt = now;
      fleet.paint(Date.now());
    }
    fleet.update(dt, t, ctx.player.pos, ctx.camera.position);
  });

  ctx.interactions.define('flotta', {
    reach: 3.5,
    hint: (it) => {
      const s = fleet.at(it.deskId);
      if (!s) return { k: '', parts: [] };
      const from = state?.source === 'demo' ? ' (dati di prova)' : '';
      return {
        k: `${s.agent.chiave}|${s.look?.summary}|${from}`,
        parts: [hintTitle(`🤖 ${s.agent.nome}`), aside(`${s.look?.summary ?? ''}${from}`), key('E', 'Apri in ctrlOS')],
      };
    },
    use: onE((it) => {
      const s = fleet.at(it.deskId);
      if (s && state) window.open(flottaHref(state.base, s.agent), '_blank', 'noopener');
    }),
  });
  return fleet;
}
