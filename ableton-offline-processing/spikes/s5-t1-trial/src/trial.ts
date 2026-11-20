import { controller } from '../../s5-t1/src/flow.ts';
import type { Port } from '../../s5-t1/src/port.ts';
import { validateOutput } from '../../s5-design/fake-host.mjs';
import { CONTROLLED_TRIAL_PROFILE, OWNER_SOURCE } from './profile.ts';
import { trialConsent, type Preview } from './consent.ts';

export function trialPort(base: Port, ask: (p: Preview) => Promise<unknown>): Port {
  return { ...base,
    async render(snapshot) {
      const bytes = await base.render(snapshot);
      const meta = validateOutput(bytes, OWNER_SOURCE);
      if (meta.bitDepth !== OWNER_SOURCE.bitDepth) throw new Error('Trial render must be 32 bit');
      // Container bytes/hash may differ from original media after pre-FX rendering.
      // Original hash/192080 bytes are OWNER-MEASURED/ATTESTED, not a render hash assertion.
      return bytes;
    },
    async confirm(p) {
      if (!trialConsent(await ask(p), p.nonce)) return null;
      // Translate ONLY after the extra trial-specific approval/provenance gates pass.
      return JSON.stringify({ action: 'import-once', attest: true, nonce: p.nonce,
        phrase: 'IMPORT ONCE TO AOPX RESULT' });
    },
  };
}
export function controlledTrial(base: Port, ask: (p: Preview) => Promise<unknown>) {
  return controller(trialPort(base, ask), { enabled: CONTROLLED_TRIAL_PROFILE.enabled });
}
