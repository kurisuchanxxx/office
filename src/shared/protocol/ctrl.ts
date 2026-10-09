// Ctrl Studio's own messages: the Flotta of ctrlOS on its floor (see shared/ctrl/flotta.ts).
import type { FlottaState } from '../ctrl/flotta.js';

export type { FlottaAgent, FlottaRun, FlottaSection, FlottaState } from '../ctrl/flotta.js';

/** A page asks for the fleet once it's in, and is sent it then and whenever it changes. */
export type CtrlClientMsg = { t: 'flotta.hello' };

export type CtrlServerMsg = { t: 'flotta'; state: FlottaState };
