/** SEPARATE controlled entry. DO NOT INSTALL/LOAD/RUN until new exact-artifact owner approval. */
import { initialize, AudioClip, AudioTrack, type ActivationContext } from '@ableton-extensions/sdk';
import { livePort } from '../../s5-t1/src/live-port.ts';
import { controlledTrial } from './trial.ts';
import { trialHtml } from './consent.ts';
export { CONTROLLED_TRIAL_PROFILE } from './profile.ts';

export function activate(activation: ActivationContext): void {
  try {
    const context = initialize(activation, '1.0.0');
    let argument: unknown; let busy = false;
    const base = livePort(context, () => argument, { AudioClip, AudioTrack });
    const run = controlledTrial(base, p => context.ui.showModalDialog(
      `data:text/html;base64,${Buffer.from(trialHtml(p)).toString('base64')}`, 820, 760));
    context.commands.registerCommand('aopx.s5.t1.controlled-trial', (...args: unknown[]) => {
      if (busy) return;
      busy = true; argument = args[0];
      void run().then(r => console.log(JSON.stringify({ event: 'AOPX_T1_TRIAL', status: r.status })))
        .catch(() => console.log('{"event":"AOPX_T1_TRIAL","status":"rejected"}'))
        .finally(() => { busy = false; });
    });
    void context.ui.registerContextMenuAction('AudioClip',
      'AOPX CONTROLLED T1 — DO NOT RUN WITHOUT APPROVAL', 'aopx.s5.t1.controlled-trial')
      .catch(() => console.log('{"event":"AOPX_T1_TRIAL","status":"registration-rejected"}'));
    // Registration ONLY: no invocation, render, import, or clip creation on connection.
  } catch { console.log('{"event":"AOPX_T1_TRIAL","status":"activation-rejected"}'); }
}
