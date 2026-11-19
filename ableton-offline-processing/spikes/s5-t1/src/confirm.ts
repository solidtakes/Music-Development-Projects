export function consent(value: unknown, nonce: string): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const x = JSON.parse(value);
    return !!x && typeof x === 'object' && !Array.isArray(x) &&
      Object.keys(x).sort().join(',') === 'action,attest,nonce,phrase' &&
      x.action === 'import-once' && x.nonce === nonce && x.attest === true &&
      x.phrase === 'IMPORT ONCE TO AOPX RESULT';
  } catch { return false; }
}

// Fixed markup + generated UUID only; no file paths, names or host error text enter HTML.
export function confirmationHtml(nonce: string): string {
  if (!/^[0-9a-f-]{36}$/.test(nonce)) throw new Error('Invalid nonce');
  return `<!doctype html><meta charset="utf-8"><title>AOPX T1</title>
  <h1>One import and one Arrangement clip</h1>
  <p>Reverse + Gain −3 dB, 48 kHz, one second. Original stays in place.
  Project media may remain after failure or Undo. No automatic retry, deletion or rollback.</p>
  <p>This candidate is BUILD-ONLY / NOT AUTHORIZED FOR LIVE. Cancel unless the exact
  artifact and this trial have received separate owner approval.</p>
  <label><input id="a" type="checkbox">I verified the separate project backup and discard/reopen;
  this is the intended disposable 120 BPM Set; playback is stopped; no other CLI or edits;
  source has no fades, automation, FX, routing or take-lane ambiguity; target AOPX RESULT is empty.</label>
  <p>Type IMPORT ONCE TO AOPX RESULT</p><input id="p" autocomplete="off">
  <button id="cancel">Cancel</button><button id="go" disabled>Import once</button>
  <script>
  const a=document.getElementById('a'),p=document.getElementById('p'),g=document.getElementById('go');
  function send(x){const s=JSON.stringify(x);const m={method:'close_and_send',params:[s]};
  if(window.chrome?.webview)window.chrome.webview.postMessage(m);
  else if(window.webkit?.messageHandlers?.live)window.webkit.messageHandlers.live.postMessage(m);}
  function update(){g.disabled=!a.checked||p.value!=='IMPORT ONCE TO AOPX RESULT';}
  a.onchange=p.oninput=update;document.getElementById('cancel').onclick=()=>send({action:'cancel'});
  g.onclick=()=>{if(g.disabled)return;g.disabled=true;send({action:'import-once',nonce:'${nonce}',attest:a.checked,phrase:p.value});};
  </script>`;
}
