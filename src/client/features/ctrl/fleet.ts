// The Flotta's agents at their desks: a worker's character and laptop each, painted from what ctrlOS
// says about it (see shared/ctrl/flotta.ts). They aren't workers (nothing to type to, no terminal),
// so the desk they sit at offers no hiring while they're there: E at one opens its page in ctrlOS.
import * as THREE from 'three';
import { deskBuilt } from '../../../shared/layout';
import { flottaLook, flottaSeats, SECTION, type FlottaAgent, type FlottaLook } from '../../../shared/ctrl/flotta';
import { noOutline } from '../../core/outline';
import { store } from '../../state';
import { Worker } from '../../world/character';
import type { DeskView, Interactable } from '../../world/types';
import { Laptop } from '../workers/laptop';

/** A jumping agent holds still while you're near enough to read its card (as a worker does). */
const HOLD_NEAR = 4;
const HOLD_LEAVE = 5;

/** One agent sat at its desk. */
export interface Seated {
  agent: FlottaAgent;
  desk: DeskView;
  model: Worker;
  laptop: Laptop;
  /** What E is at, on the agent itself: aiming at it, or standing by it in third person. */
  it: Interactable;
  /** The desk's own E (hire someone), put away while the agent sits there. */
  deskIt?: Interactable;
  look?: FlottaLook;
}

export class Fleet {
  /** By desk id. */
  readonly seated = new Map<string, Seated>();
  private readonly pos = new THREE.Vector3();

  constructor(
    /** The desks of the office everyone shares, by id. */
    private desks: () => ReadonlyMap<string, DeskView>,
    /** The office's own things to use, where each desk's E is. */
    private interactables: () => readonly Interactable[],
    /** 'laptop', or a map's own (the castle's tomes). */
    private device: () => 'laptop' | 'tome',
  ) {}

  /** The agents on the floor you're on: each at its seat, unless a worker is there or it isn't built. None clears the floor. */
  sync(agents: readonly FlottaAgent[]) {
    const seats = flottaSeats(agents);
    const want = new Map<string, FlottaAgent>();
    for (const a of agents) {
      const id = seats.get(a.chiave);
      const desk = id ? this.desks().get(id) : undefined;
      if (!id || !desk || !deskBuilt(desk.def, store.floorPlan.wing) || store.workerAtDesk(id)) continue;
      want.set(id, a);
    }
    for (const [id, s] of this.seated) {
      if (want.get(id)?.chiave !== s.agent.chiave) this.unseat(id);
    }
    for (const [id, a] of want) {
      const s = this.seated.get(id) ?? this.seat(id, a);
      s.agent = a;
    }
    this.paint(Date.now());
  }

  /** Each agent as it looks at `now`: what ctrlOS said, against the clock (a run gets older). */
  paint(now: number) {
    for (const s of this.seated.values()) {
      const look = flottaLook(s.agent, now);
      const was = s.look;
      if (was && was.status === look.status && was.bounce === look.bounce && was.summary === look.summary && was.screen === look.screen) continue;
      // Just finished a run: a little spin, as a worker does.
      if (was && look.status === 'done' && was.status !== 'done') s.model.celebrate();
      s.look = look;
      s.model.setStatus(look.status, look.bounce);
      s.model.setTask({ name: `🤖 ${s.agent.nome}`, summary: look.summary });
      s.laptop.setPlaceholder(look.screen);
      noOutline(s.model.root);
    }
  }

  /** Every frame: the agents move, their laptops show what waits, and their desks don't offer a seat. */
  update(dt: number, t: number, player: THREE.Vector3, cam: THREE.Vector3) {
    for (const s of this.seated.values()) {
      const d = s.model.root.getWorldPosition(this.pos).distanceTo(player);
      s.model.held = d < (s.model.held ? HOLD_LEAVE : HOLD_NEAR);
      s.model.update(dt, t);
      s.laptop.update(dt, undefined, Math.hypot(s.desk.def.x - cam.x, s.desk.def.z - cam.z));
      // The workers' view shows a free desk's "+" whenever the workers change: not over an agent.
      s.desk.vacancy.visible = false;
    }
  }

  /** The agent sat at `deskId`, if any. */
  at(deskId: string | undefined): Seated | undefined {
    return deskId ? this.seated.get(deskId) : undefined;
  }

  /** What there is to use of the fleet: its agents. */
  usable(): Interactable[] {
    return [...this.seated.values()].map((s) => s.it);
  }

  clear() {
    for (const id of [...this.seated.keys()]) this.unseat(id);
  }

  private seat(id: string, agent: FlottaAgent): Seated {
    const desk = this.desks().get(id)!;
    const model = new Worker(agent.nome, SECTION[agent.sezione].color);
    model.setCostume(store.theme.active);
    desk.seatAnchor.add(model.root);
    const laptop = new Laptop(this.device());
    desk.laptopAnchor.add(laptop.root);
    noOutline(desk.group);
    desk.chair.rotation.y = 0;
    const it: Interactable = { kind: 'flotta', x: desk.def.x, z: desk.def.z, radius: 1.6, deskId: id };
    model.root.userData.interact = it;
    const deskIt = this.interactables().find((i) => i.kind === 'desk' && i.deskId === id && !i.off);
    if (deskIt) deskIt.off = true;
    const s: Seated = { agent, desk, model, laptop, it, deskIt };
    this.seated.set(id, s);
    return s;
  }

  private unseat(id: string) {
    const s = this.seated.get(id);
    if (!s) return;
    s.model.root.removeFromParent();
    s.laptop.root.removeFromParent();
    s.model.dispose();
    s.laptop.dispose();
    if (s.deskIt) s.deskIt.off = false;
    this.seated.delete(id);
  }
}
