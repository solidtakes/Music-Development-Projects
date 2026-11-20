import { CONTROLLED_TRIAL_PROFILE as PROFILE, OWNER_SOURCE } from './profile.ts';

export interface Preview { nonce: string; frames: number; channels: number; hash: string }
export function trialConsent(value: unknown, nonce: string): boolean {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const x = JSON.parse(value);
    return !!x && typeof x === 'object' && !Array.isArray(x) &&
      Object.keys(x).sort().join(',') === 'action,approvedArtifact,attest,nonce,phrase,sourceBytes,sourceSha256' &&
      x.action === 'import-once' && x.approvedArtifact === true && x.attest === true &&
      x.nonce === nonce && x.phrase === PROFILE.phrase && x.sourceBytes === OWNER_SOURCE.bytes &&
      typeof x.sourceSha256 === 'string' && x.sourceSha256.toLowerCase() === OWNER_SOURCE.sha256;
  } catch { return false; }
}

/** Only generated nonce and validated SHA-256 enter HTML. No names, paths or SDK errors. */
export function trialHtml(p: Preview): string {
  if (!/^[0-9a-f-]{36}$/.test(p.nonce) || !/^[0-9a-f]{64}$/.test(p.hash) ||
      p.frames !== OWNER_SOURCE.frames || p.channels !== OWNER_SOURCE.channels)
    throw new Error('Invalid trial preview');
  return `<!doctype html><meta charset="utf-8"><title>AOPX controlled T1</title>
  <h1>NOT AUTHORIZED FOR LIVE / DO NOT RUN</h1>
  <p>Profile ${PROFILE.id}. Cancel unless the owner separately approved this exact reviewed
  artifact and prospective protocol. This preparation approval is NOT permission to test.</p>
  <p>One import, one clip on existing AOPX RESULT. Reverse + Gain −3 dB. 120 BPM, 48,000
  frames, mono 48 kHz. Original stays in place. Media may remain after failure/Undo.</p>
  <p>Owner-measured original WAV: ${OWNER_SOURCE.bytes} bytes, 32 bit;
  SHA-256 <code>${OWNER_SOURCE.sha256}</code>. The SDK does not verify original-file bytes here.</p>
  <p>Processed output SHA-256: <code>${p.hash}</code>. This is NOT the original-file checksum.</p>
  <label><input id="approved" type="checkbox">The owner explicitly approved this exact
  candidate SHA/ZIP checksum and protocol for ONE disposable-Set trial.</label><br>
  <label><input id="attest" type="checkbox">I checked the original file hash/size externally
  and that this is its isolated Arrangement clip; the separate collected-media backup was
  opened/verified; working Set is 120 BPM; playback stopped; one CLI, no concurrent edits;
  no fades/FX/automation/routing/take-lane ambiguity; AOPX RESULT is the unique empty audio track.</label>
  <p>Paste verified ORIGINAL source SHA-256:</p><input id="source" autocomplete="off" size="68">
  <p>Type ${PROFILE.phrase}</p><input id="phrase" autocomplete="off" size="48">
  <button id="cancel">Cancel</button><button id="go" disabled>Confirm one import + one clip</button>
  <script>
  const approved=document.getElementById('approved'),a=document.getElementById('attest'),
  s=document.getElementById('source'),p=document.getElementById('phrase'),g=document.getElementById('go');
  function update(){g.disabled=!approved.checked||!a.checked||s.value.toLowerCase()!=='${OWNER_SOURCE.sha256}'||p.value!=='${PROFILE.phrase}';}
  for(const x of [approved,a,s,p]){x.oninput=x.onchange=update;}
  function send(value){const m={method:'close_and_send',params:[JSON.stringify(value)]};
  if(window.chrome?.webview)window.chrome.webview.postMessage(m);
  else if(window.webkit?.messageHandlers?.live)window.webkit.messageHandlers.live.postMessage(m);}
  document.getElementById('cancel').onclick=()=>send({action:'cancel'});
  g.onclick=()=>{if(g.disabled)return;g.disabled=true;send({action:'import-once',approvedArtifact:approved.checked,
  attest:a.checked,nonce:'${p.nonce}',phrase:p.value,sourceBytes:${OWNER_SOURCE.bytes},sourceSha256:s.value});};
  </script>`;
}
