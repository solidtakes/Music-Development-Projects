/** BUILD-ONLY / NOT AUTHORIZED FOR LIVE. No launcher is supplied. */
import { initialize, AudioClip, AudioTrack, type ActivationContext } from '@ableton-extensions/sdk';
import { controller } from './flow.ts';
import { livePort } from './live-port.ts';

// Deliberately compiled closed. A future owner-approved trial requires a separately reviewed
// build changing this gate. Neither environment variables nor command arguments can unlock it.
export const LIVE_TRIAL_ENABLED: boolean = false;
export function activate(activation: ActivationContext): void {
  try {
  const context = initialize(activation, '1.0.0');
  let argument: unknown; let commandBusy = false;
  const run = controller(livePort(context, () => argument, { AudioClip, AudioTrack }), { enabled: LIVE_TRIAL_ENABLED });
  context.commands.registerCommand('aopx.s5.t1.build-only', (...args: unknown[]) => {
    if (commandBusy) return;
    commandBusy = true; argument = args[0];
    void run().then(result => console.log(JSON.stringify({ event: 'AOPX_T1_STATUS', status: result.status })))
      .catch(() => console.log('{"event":"AOPX_T1_STATUS","status":"rejected"}'))
      .finally(() => { commandBusy = false; });
  });
  void context.ui.registerContextMenuAction('AudioClip', 'AOPX T1 BUILD-ONLY — LOCKED / DO NOT RUN', 'aopx.s5.t1.build-only')
    .catch(() => console.log('{"event":"AOPX_T1_STATUS","status":"registration-rejected"}'));
  // Activation only registers a locked command. No render/import/create or auto-execution.
  } catch {
    console.log('{"event":"AOPX_T1_STATUS","status":"activation-rejected"}');
  }
}
