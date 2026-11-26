/* NCC-1337 LCARS Direct OSC v1.0 (instant pointer faders + Android multi-touch)
 * Uses the already-installed v0.6.3 LCARS card and its ten-fader visual bank.
 * All ten hardware input indices and three submix indices are from the verified
 * NCC1337 Global OSC capture. No credential or manual approval UI.
 * RX updates display only; deliberate pointer gestures and SEND ONCE can invoke /api/send.
 * Local Windows browser to 127.0.0.1:8772; NEVER exposes LAN audio writes.
 */
(() => {
  'use strict';
  const ELEMENT = 'ncc1337-lcars-v063-card';
  const API = 'http://127.0.0.1:8772';
  const INPUTS = [
    {index:0,name:'Mic Chain'}, {index:1,name:'Digitech SV'},
    {index:2,name:'OB TEO5',stereo:true}, {index:4,name:'DMX 1 / DJ',stereo:true},
    {index:6,name:'DMX 3'}, {index:7,name:'DMX 4'},
    {index:8,name:'LMDRUM'}, {index:9,name:'PRO12ASB'},
    {index:10,name:'ESQ1'}, {index:11,name:'DX100'}
  ];
  const SUBMIX_NAMES = ['MAIN','PHONES','MON2'];
  const SUBMIX = {main:'MAIN',headphones:'PHONES',speakerb:'MON2'};
  const STYLES = `
    .ncc-direct{margin:10px 0 4px;padding:13px;background:#160e20;border-left:6px solid #8ebaf9;
      color:#e9defc;font:12px/1.45 system-ui,Segoe UI,sans-serif}
    .ncc-direct h3{font-size:15px;color:#ffe27a;margin:0 0 8px;letter-spacing:.05em}
    .ncc-direct-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}
    .ncc-stat{background:#0c0916;padding:8px;min-width:0}
    .ncc-stat small{display:block;color:#c6b5d4;font-size:10px}
    .ncc-stat strong{display:block;color:#ffe27a;font-size:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    .ncc-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 0}
    .ncc-direct select,.ncc-direct input[type=number]{background:#0e0818;color:#ffe27a;
      padding:8px;border:1px solid #9270bd;font:inherit;min-height:36px}
    .ncc-direct select{max-width:100%;min-width:155px;font-weight:700}
    .ncc-direct input[type=number]{width:95px;font-size:15px}
    .ncc-direct input[type=range]{width:100%;accent-color:#a872dd;min-height:23px}
    .ncc-direct button{border:0;background:#a87be1;color:#120a1e;padding:9px 12px;
      min-height:38px;font-weight:900;border-radius:0 9px 9px 0;cursor:pointer}
    .ncc-direct button.ncc-send{background:#ffe27a}
    .ncc-direct button:disabled{opacity:.42;cursor:not-allowed}
    .ncc-direct-msg{margin:6px 0;color:#a5eac7;min-height:16px;overflow-wrap:anywhere}
    .ncc-direct-touch{position:absolute;inset:0;border:1px solid #ffe06b65;background:transparent!important;
      z-index:11;width:100%;min-height:0!important;cursor:ns-resize;border-radius:0!important;
      touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;overscroll-behavior:contain}
    .ncc-direct-touch:focus-visible,.ncc-direct-touch[data-active=true]{outline:2px solid #ffe06b;outline-offset:-2px}
    .lf-vbank-fader{position:relative;touch-action:none}
    .lf-vbank-channel.ncc-dragging{box-shadow:inset 0 0 0 2px #a6ffc0!important}
    .lf-vbank-channel.ncc-dragging .lf-vbank-level{color:#b9ffd5!important}
    .ncc-touch-info{color:#a5eac7;font-weight:800;font-size:11px;padding:4px 0 1px}
    .ncc-route-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:8px 0}
    .ncc-route{background:#100a1a;border-left:4px solid #634a83;padding:6px;min-width:0;display:flex;flex-direction:column;gap:2px}
    .ncc-route[data-active=true]{border-left-color:#ffde73;background:#27183a}
    .ncc-route small{font-size:10px;color:#b9a7d2;letter-spacing:.04em}
    .ncc-route strong{font-size:13px;color:#ffe27a;font-variant-numeric:tabular-nums}
    .ncc-route em{font-style:normal;color:#b5d5ef;font-size:9px}
    .ncc-direct-bank-live{font-weight:900;color:#a5eac7!important}
    .ncc-direct-bank-partial{font-weight:900;color:#ffcd85!important}
    .lf-vbank-channel.ncc-direct-selected{box-shadow:inset 0 0 0 2px #ffe36e}
    .ncc-direct-title{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap}
    .ncc-direct-flag{color:#ffda65;font-size:10px;font-weight:700}
    @container lcars (max-width:710px){
      .lf-vbank-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important}
      .lf-vbank-fader{min-height:185px!important}
      .lf-vbank-fader .lf-fader.compact{--lf-height:185px!important}
      .ncc-direct-touch{min-width:100%;min-height:185px!important}
      .lf-vbank-level{font-size:9px!important}
    }
    @container lcars (max-width:710px){.ncc-direct{padding:8px}.ncc-stat strong{font-size:15px}}
  `;
  const fmt = x => typeof x === 'number' && Number.isFinite(x) ? (x <= -299 ? 'OFF' : x.toFixed(2)+' dB') : '—';
  const clamp = x => Math.max(-65,Math.min(6,Math.round(Number(x)*20)/20));
  function output(card){return SUBMIX[card._submix] || 'PHONES';}
  function current(card,index=card._nccIndex,submix=output(card)) {
    return card._nccState?.inputs?.find(i=>i.index===index)?.sends?.[submix] || null;
  }
  function selectedInput(card) {return INPUTS.find(i=>i.index===card._nccIndex) || INPUTS[9];}
  function inputOptions(card) {
    return INPUTS.map(i=>`<option value="${i.index}" ${i.index===card._nccIndex?'selected':''}>${i.name}${i.stereo?' (stereo)':''}</option>`).join('');
  }
  function validDraft(card){return Number.isFinite(card._nccDraft) && card._nccDraft >=-65 && card._nccDraft <=6;}
  function baseDraft(card){
    const v=current(card)?.dB;
    return Number.isFinite(v)&&v> -299 ? clamp(v) : null;
  }
  function adjust(card, delta){
    const base=validDraft(card) ? card._nccDraft : baseDraft(card);
    if(base===null){card._nccNote='This send is OFF or unreadable. Enter a level explicitly to enable it.';writeFields(card);return;}
    card._nccDraft=clamp(base+delta);
    card._nccDirty=true;
    writeFields(card);
  }
  async function post(path, body={}) {
    const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),cache:'no-store'});
    let obj={};try{obj=await r.json();}catch(e){}
    if(!r.ok)throw Error(obj.error || 'HTTP '+r.status);
    return obj;
  }
  function fresh(reading){return reading && typeof reading.age_s==='number' && reading.age_s<=20 &&
    (reading.state==='OFF'||reading.state==='OBSERVED');}
  function routeMarkup(card){
    return SUBMIX_NAMES.map(name=>{
      const reading=current(card,card._nccIndex,name);
      const active=name===output(card);
      const stereo=selectedInput(card).stereo;
      const partner=card._nccState?.inputs?.find(x=>x.index===card._nccIndex)?.partner_db?.[name];
      const partnerLabel=stereo?(Number.isFinite(partner)?fmt(partner):'—') : null;
      return `<div class="ncc-route" data-route="${name}" data-active="${active}"><small>${name}${active?' / SELECTED':''}</small>`+
        `<strong>${fmt(reading?.dB)}</strong><em>${!reading?'NO DATA':fresh(reading)?'LIVE':'STALE'}${stereo?' · R: '+partnerLabel:''}</em></div>`;
    }).join('');
  }
  // Independent pointerId gesture objects: two Android fingers can drag two
  // separate faders concurrently. No touch identifier is ever shared.
  const SEND_PERIOD_MS = 120;   // one total OSC fader command per 120ms, not per touchmove
  function routeKey(index,submix){return index+':'+submix;}
  function pendingDb(card,index,submix){
    const p=card._nccOptimistic?.get(routeKey(index,submix));
    if(!p)return null;
    const actual=current(card,index,submix)?.dB;
    if((Number.isFinite(actual)&&Math.abs(actual-p.db)<0.12) || Date.now()-p.at>3500){
      card._nccOptimistic.delete(routeKey(index,submix));return null;
    }
    return p.db;
  }
  function touchReady(card,index,submix){
    const r=current(card,index,submix);
    return !!card.isConnected && !card.demo && !!r && fresh(r) && !!card._nccState;
  }
  function touchDb(card,index,submix){
    const pending=pendingDb(card,index,submix);
    if(Number.isFinite(pending))return pending;
    const db=current(card,index,submix)?.dB;
    return Number.isFinite(db)&&db>-299?clamp(db):-65;
  }
  function paintTouch(card,index,submix,db){
    if(submix!==output(card))return;
    const n=INPUTS.findIndex(i=>i.index===index);
    if(n<0)return;
    const channel=card.shadowRoot.querySelectorAll('.lf-vbank-channel')[n];
    if(!channel)return;
    const fader=channel.querySelector('.lf-fader');
    if(fader){
      const p=(8+Math.max(0,Math.min(1,-db/70))*84).toFixed(2)+'%';
      fader.style.setProperty('--lf-position',p);
      fader.classList.remove('no-value');
    }
    const label=channel.querySelector('.lf-vbank-level');
    if(label)label.textContent=fmt(db);
    const slider=channel.querySelector('[data-direct-touch]');
    if(slider){slider.setAttribute('aria-valuenow',db.toFixed(2));slider.setAttribute('aria-valuetext',fmt(db));}
    channel.classList.toggle('ncc-dragging',Array.from(card._nccGestures?.values()||[]).some(g=>g.index===index&&g.out===submix));
    if(card._nccIndex===index){card._nccDraft=db;card._nccDirty=true;
      const preview=card.shadowRoot.querySelector('[data-direct-preview]');if(preview)preview.textContent=fmt(db);}
  }
  function queueLive(card,index,submix,db){
    if(!touchReady(card,index,submix))return;
    const key=routeKey(index,submix);
    if(card._nccLastSent.get(key)===db && !card._nccQueue.has(key)){paintTouch(card,index,submix,db);return;}
    card._nccQueue.set(key,{index,submix,db});
    card._nccOptimistic.set(key,{db,at:Date.now()});
    paintTouch(card,index,submix,db);
  }
  async function pumpLive(card){
    // Receiver feedback and polling NEVER enqueue commands. This is called
    // only by user gestures/keyboard through queueLive(), with one in-flight TX.
    if(card._nccPumpBusy||!card.isConnected||card._nccQueue.size===0)return;
    const [key,job]=card._nccQueue.entries().next().value;
    card._nccQueue.delete(key);
    if(!touchReady(card,job.index,job.submix)){
      card._nccNote='Touch send held: TotalMix feedback is unavailable or stale.';
      writeFields(card);return;
    }
    card._nccPumpBusy=true;
    try{
      await post('/api/send',{input_index:job.index,submix:job.submix,target_db:job.db});
      card._nccTouchTx=(card._nccTouchTx||0)+1;
      card._nccLastSent.set(key,job.db);
      card._nccNote='LIVE DRAG • '+INPUTS.find(i=>i.index===job.index).name+' → '+job.submix+' • '+fmt(job.db);
    }catch(err){
      // Do not keep retrying an unknown audio write; require a new gesture.
      card._nccQueue.clear();card._nccOptimistic.clear();
      card._nccNote='LIVE DRAG HELD: '+err.message;
    }finally{card._nccPumpBusy=false;writeFields(card);}
  }
  function pointerStart(card,e){
    const target=e.target.closest?.('[data-direct-touch]');if(!target)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(e.button!==undefined&&e.button!==0)return;
    const index=Number(target.dataset.directIndex),out=output(card);
    if(!touchReady(card,index,out)){
      card._nccNote='Fader held: wait for fresh live TotalMix feedback.';writeFields(card);return;
    }
    // One finger per fader, but unrelated faders can move simultaneously.
    if(Array.from(card._nccGestures.values()).some(g=>g.index===index&&g.out===out))return;
    const baseline=touchDb(card,index,out),rect=target.getBoundingClientRect();
    card._nccIndex=index;
    card._nccDraft=baseline;card._nccDirty=true;
    const g={pointer:e.pointerId,target,index,out,startY:e.clientY,baseline,db:baseline,
      height:Math.max(75,rect.height),moved:false};
    card._nccGestures.set(e.pointerId,g);
    if(target.setPointerCapture)try{target.setPointerCapture(e.pointerId);}catch(_){}
    target.dataset.active='true';paintTouch(card,index,out,baseline);
  }
  function pointerMove(card,e){
    const g=card._nccGestures?.get(e.pointerId);if(!g)return;
    e.preventDefault();e.stopImmediatePropagation();
    const dy=g.startY-e.clientY;
    // 4px deadband prevents a tap from making a loud, unexpected jump.
    if(!g.moved&&Math.abs(dy)<4)return;
    g.moved=true;
    const db=clamp(g.baseline+dy/g.height*71);
    if(db===g.db)return;
    g.db=db;queueLive(card,g.index,g.out,db);
  }
  function pointerFinish(card,e,cancel=false){
    const g=card._nccGestures?.get(e.pointerId);if(!g)return;
    e.preventDefault();e.stopImmediatePropagation();
    card._nccGestures.delete(e.pointerId);
    if(g.target.releasePointerCapture && g.target.hasPointerCapture?.(e.pointerId))
      try{g.target.releasePointerCapture(e.pointerId);}catch(_){}
    if(g.target.dataset)g.target.dataset.active='false';
    if(g.moved&&!cancel)queueLive(card,g.index,g.out,g.db); // final latest target
    paintTouch(card,g.index,g.out,g.db);
    if(!card._nccGestures.size)writeFields(card);
  }
  function keyboardTouch(card,e){
    const target=e.target.closest?.('[data-direct-touch]');if(!target)return;
    if(!['ArrowUp','ArrowDown','PageUp','PageDown'].includes(e.key))return;
    e.preventDefault();e.stopImmediatePropagation();
    const index=Number(target.dataset.directIndex),out=output(card);
    if(!touchReady(card,index,out))return;
    const step=e.key==='ArrowUp'?0.5:e.key==='ArrowDown'?-0.5:e.key==='PageUp'?3:-3;
    const db=clamp(touchDb(card,index,out)+step);
    card._nccIndex=index;queueLive(card,index,out,db);
  }
  function writeFields(card){
    const root=card.shadowRoot;
    const val=validDraft(card)?card._nccDraft:null;
    const selected=current(card);
    const updateText=(selector, text)=>{const el=root.querySelector(selector);if(el)el.textContent=text;};
    updateText('[data-direct-current]',fmt(selected?.dB));
    updateText('[data-direct-age]',typeof selected?.age_s==='number'?selected.age_s.toFixed(1)+'s':'—');
    updateText('[data-direct-preview]',fmt(val));
    const ownLast = card._nccState?.last_send;
    const match = ownLast && ownLast.input_index===card._nccIndex && ownLast.submix===output(card);
    updateText('[data-direct-readback]',match?ownLast.status:'NO COMMAND');
    updateText('[data-direct-last]',match?fmt(ownLast.readback_db):'—');
    updateText('[data-direct-tx]',String(card._nccState?.manual_fader_packets_sent??'—'));
    updateText('[data-direct-autotx]',String(card._nccState?.automatic_fader_packets_sent??'—'));
    updateText('[data-direct-notice]',card._nccNote || (!card._nccState ?
      'Local bridge unavailable.' : 'Drag a vertical fader for immediate audio changes. Multi-touch enabled.'));
    for(const el of root.querySelectorAll('[data-direct-number],[data-direct-range]')){
      if(el!==root.activeElement)el.value=val===null?'':val.toFixed(2);
    }
    const select=root.querySelector('[data-direct-select]');
    if(select && select!==root.activeElement) select.value=String(card._nccIndex);
    const overview=root.querySelector('[data-direct-route-overview]');
    if(overview) overview.innerHTML=routeMarkup(card);
    const out=output(card);
    let total=0, live=0;
    for(const definition of INPUTS){
      const reading=current(card,definition.index,out);
      if(reading?.state==='OBSERVED'||reading?.state==='OFF')total++;
      if(fresh(reading))live++;
    }
    const status=live===10?'LIVE DIRECT OSC':live>0?'PARTIAL DIRECT OSC':'NO LIVE OSC';
    const header=root.querySelector('.bank-title span:last-child');
    if(header){header.textContent=status;header.classList.toggle('ncc-direct-bank-live',live===10);
      header.classList.toggle('ncc-direct-bank-partial',live!==10);}
    const summary=root.querySelector('.lf-vbank-header b');
    if(summary)summary.textContent=live===10?'10 INPUTS · LIVE TOTALMIX':`${live}/10 LIVE · ${total}/10 OBSERVED`;
    const typeLabel=root.querySelector('.lf-vbank-note');
    if(typeLabel) typeLabel.textContent='LIVE OSC · Drag faders to control TotalMix immediately · 2-finger Android touch supported.';
    const send=root.querySelector('[data-direct-action="send"]');
    if(send) send.disabled=card._nccBusy || !validDraft(card) || !selected ||
      selected.state==='UNAVAILABLE' || typeof selected.age_s!=='number' || selected.age_s>20;
    root.querySelectorAll('.lf-vbank-channel').forEach((node, n)=>{
      const def=INPUTS[n], s=current(card,def.index,out);
      node.classList.toggle('ncc-direct-selected',card._nccIndex===def.index);
      const label=node.querySelector('.lf-vbank-level');
      if(label)label.textContent=s?.state==='UNAVAILABLE'||!fresh(s)?'UNAVAILABLE':fmt(s?.dB);
      const touch=node.querySelector('[data-direct-touch]');
      if(touch){touch.setAttribute('aria-disabled',String(!fresh(s)));touch.dataset.active=String(Array.from(card._nccGestures.values()).some(g=>g.index===def.index&&g.out===out));}
      const optimistic=pendingDb(card,def.index,out);
      if(Number.isFinite(optimistic))paintTouch(card,def.index,out,optimistic);
    });
  }
  function stage(card, index){
    if(!INPUTS.some(x=>x.index===index))return;
    card._nccIndex=index;
    card._nccDirty=false;
    card._nccDraft=baseDraft(card);
    card._nccNote='';
    card.render();
    const control=card.shadowRoot.querySelector('[data-direct-number]');
    control?.focus();
  }
  function ensure(card){
    if(!card._nccStyles){card._styles=String(card._styles||'')+STYLES;card._nccStyles=true;}
    if(card._nccWired)return;
    card._nccWired=true;
    card._nccIndex=11;
    card._nccDraft=null;
    card._nccDirty=false;
    card._nccBusy=false;
    card._nccState=null;
    card._nccNote='';
    card._nccRenderSig='';
    card._nccGestures=new Map();
    card._nccQueue=new Map();
    card._nccOptimistic=new Map();
    card._nccLastSent=new Map();
    card._nccPumpBusy=false;
    card._nccTouchTx=0;
    card.shadowRoot.addEventListener('click',async e=>{
      const tab=e.target.closest('button[data-submix]');
      if(tab && tab.getAttribute('data-submix')!==card._submix){
        if(card._nccGestures.size){e.preventDefault();e.stopImmediatePropagation();return;}
        card._nccDraft=null;card._nccDirty=false;card._nccNote='';
      }
      const b=e.target.closest('button[data-direct-action]');
      if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      const action=b.dataset.directAction;
      if(action==='stage'){
        stage(card,Number(b.dataset.directIndex));return;
      }
      if(action==='minus'||action==='plus'){
        adjust(card, action==='minus'?-0.5:0.5);return;
      }
      if(action==='refresh'){
        try{await post('/api/refresh',{submix:output(card)});card._nccNote='Refresh requested.';}
        catch(err){card._nccNote='Refresh failed: '+err.message;}
        writeFields(card);return;
      }
      if(action!=='send'||card._nccBusy)return;
      const observed=current(card);
      if(!validDraft(card)||!observed||observed.state==='UNAVAILABLE'||observed.age_s>20){
        card._nccNote='No fresh observed value or valid target. No command sent.';writeFields(card);return;
      }
      card._nccBusy=true;writeFields(card);
      try{
        await post('/api/send',{input_index:card._nccIndex,submix:output(card),target_db:card._nccDraft});
        card._nccNote='One '+selectedInput(card).name+' → '+output(card)+' command sent. Checking read-back.';
        card._nccDirty=false;
      }catch(err){card._nccNote='Command not confirmed: '+err.message;}
      finally{card._nccBusy=false;writeFields(card);}
    },true);
    card.shadowRoot.addEventListener('pointerdown',e=>pointerStart(card,e),true);
    card.shadowRoot.addEventListener('pointermove',e=>pointerMove(card,e),true);
    card.shadowRoot.addEventListener('pointerup',e=>pointerFinish(card,e),true);
    card.shadowRoot.addEventListener('pointercancel',e=>pointerFinish(card,e,true),true);
    card.shadowRoot.addEventListener('lostpointercapture',e=>pointerFinish(card,e,true),true);
    card.shadowRoot.addEventListener('keydown',e=>keyboardTouch(card,e),true);
    card.shadowRoot.addEventListener('change',e=>{
      if(e.target.matches('[data-direct-select]')){stage(card,Number(e.target.value));}
    },true);
    card.shadowRoot.addEventListener('input',e=>{
      if(!e.target.matches('[data-direct-number],[data-direct-range]'))return;
      if(e.target.value===''){
        card._nccDraft=null;card._nccDirty=true;writeFields(card);return;
      }
      const v=Number(e.target.value);
      if(Number.isFinite(v)){card._nccDraft=clamp(v);card._nccDirty=true;}
      writeFields(card);
    },true);
  }
  function renderPanel(card){
    const input=selectedInput(card), out=output(card), reading=current(card), last=card._nccState?.last_send;
    const match=last?.input_index===card._nccIndex&&last?.submix===out;
    const val=validDraft(card)?card._nccDraft:null;
    return `<section class="ncc-direct" aria-label="NCC-1337 ten-input Direct OSC">
      <div class="ncc-direct-title"><h3>${input.name.toUpperCase()} → ${out} / DIRECT OSC</h3><span class="ncc-direct-flag">${input.stereo?'STEREO L/R • PRIMARY-SEND':''} INPUT OSC ${input.index}</span></div>
      <div class="ncc-touch-info">LIVE TOUCH: drag any vertical input fader to send continuously. On Android, drag two different faders at once. Tap without dragging only selects.</div>
      <label>Select input <select data-direct-select aria-label="Hardware input">${inputOptions(card)}</select></label>
      <div class="ncc-route-overview" data-direct-route-overview aria-label="Three submix sends for selected input">${routeMarkup(card)}</div>
      <div class="ncc-direct-stats">
        <div class="ncc-stat"><small>LIVE TOTALMIX</small><strong data-direct-current>${fmt(reading?.dB)}</strong></div>
        <div class="ncc-stat"><small>LAST FEEDBACK</small><strong data-direct-age>${reading?.age_s?.toFixed(1)??'—'}s</strong></div>
        <div class="ncc-stat"><small>READ-BACK</small><strong data-direct-readback>${match?last.status:'NO COMMAND'}</strong></div>
      </div>
      <label>Requested level: <b data-direct-preview>${fmt(val)}</b></label>
      <input type="range" data-direct-range min="-65" max="6" step="0.05" value="${val===null?'':val.toFixed(2)}">
      <div class="ncc-controls">
        <input type="number" data-direct-number aria-label="Target send level in dB" min="-65" max="6" step="0.05" value="${val===null?'':val.toFixed(2)}" placeholder="Set dB">
        <button type="button" data-direct-action="minus">−0.5 dB</button>
        <button type="button" data-direct-action="plus">+0.5 dB</button>
        <button type="button" class="ncc-send" data-direct-action="send">SEND ONCE</button>
        <button type="button" data-direct-action="refresh">Refresh ${out}</button>
      </div>
      <div class="ncc-direct-stats">
        <div class="ncc-stat"><small>AFTER-SEND OSC</small><strong data-direct-last>${match?fmt(last.readback_db):'—'}</strong></div>
        <div class="ncc-stat"><small>MANUAL FADER TX</small><strong data-direct-tx>${card._nccState?.manual_fader_packets_sent??'—'}</strong></div>
        <div class="ncc-stat"><small>RX-TRIGGERED TX</small><strong data-direct-autotx>${card._nccState?.automatic_fader_packets_sent??'—'}</strong></div>
      </div>
      <p class="ncc-direct-msg" data-direct-notice>${card._nccNote||'10 mapped input sends. No passwords or approval codes. Only SEND ONCE writes.'}</p>
      ${input.stereo?'<p class="ncc-direct-flag">Stereo L/R: primary channel receives each deliberate drag command; TotalMix handles stereo linking. Partner level remains read-only.</p>':''}
    </section>`;
  }
  async function poll(card){
    if(!card.isConnected||card._nccPolling)return;
    card._nccPolling=true;
    try{
      const r=await fetch(API+'/api/state',{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      const state=await r.json();
      if(state.version!=='0.8'||!Array.isArray(state.inputs)||state.inputs.length!==10)throw Error('Expected v0.8 bridge; restart old v0.7 backend.');
      card._nccState=state;
      if(card._nccNote.startsWith('Local v0.8 OSC service unavailable:'))card._nccNote='';
      const sig=state.inputs.map(x=>['MAIN','PHONES','MON2'].map(o=>x.sends[o]?.dB).join(',')).join('|');
      if(sig!==card._nccRenderSig && !card._nccGestures?.size){
        const focus=card.shadowRoot.activeElement;
        if(!focus?.matches?.('[data-direct-range],[data-direct-number],[data-direct-select]')){
          card._nccRenderSig=sig;
          card.render();
        }
      }
      if(!card._nccDirty && !card._nccGestures?.size)card._nccDraft=baseDraft(card);
    }catch(err){
      card._nccState=null;
      card._nccNote='Local v0.8 OSC service unavailable: '+err.message;
    }finally{card._nccPolling=false;writeFields(card);}
  }
  function start(card){
    ensure(card);
    if(card._nccTimer)return;
    card._nccTimer=setInterval(()=>poll(card),1200);
    card._nccSendTimer=setInterval(()=>pumpLive(card),SEND_PERIOD_MS);
    poll(card);
  }
  function patch(Card){
    const p=Card.prototype;
    if(p.__nccDirectV10)return;
    p.__nccDirectV10=true;
    const original={setConfig:p.setConfig,connected:p.connectedCallback,disconnected:p.disconnectedCallback,
      render:p.render,bank:p.bank,mixerPanel:p.mixerPanel,readBank:p.readGlobalInputBank};
    const hassProperty=Object.getOwnPropertyDescriptor(p,'hass');
    p.setConfig=function(cfg){ensure(this);return original.setConfig.call(this,{...cfg,gateway_url:undefined,offline_gateway_demo:false});};
    p.connectedCallback=function(){ensure(this);original.connected?.call(this);start(this);};
    p.disconnectedCallback=function(){
      if(this._nccTimer)clearInterval(this._nccTimer);this._nccTimer=null;
      if(this._nccSendTimer)clearInterval(this._nccSendTimer);this._nccSendTimer=null;
      this._nccGestures?.clear();this._nccQueue?.clear();
      original.disconnected?.call(this);
    };
    if(hassProperty?.set){Object.defineProperty(p,'hass',{
      configurable:true,get:hassProperty.get,
      set(h){const active=this.shadowRoot?.activeElement;
        if(this._nccGestures?.size || active?.matches?.('[data-direct-number],[data-direct-range],[data-direct-select]')){this._hass=h;return;}
        hassProperty.set.call(this,h);
      }
    });}
    p.readGlobalInputBank=function(){
      if(this._nccState?.inputs?.length===10)return this._nccState.inputs;
      return original.readBank?.call(this)??null;
    };
    p.bank=function(){
      // Preserve each original LCARS vertical SVG fader; only overlay touch hit areas.
      let html=original.bank.call(this),n=0;
      return html.replace(/<div class="lf-vbank-fader">/g,match=>{
        const definition=INPUTS[n++];
        return !definition?match:match+`<div class="ncc-direct-touch" data-direct-touch data-direct-index="${definition.index}" role="slider" tabindex="0" aria-orientation="vertical" aria-label="${definition.name} ${output(this)} live send" aria-valuemin="-65" aria-valuemax="6" aria-disabled="false"></div>`;
      });
    };
    p.mixerPanel=function(){return renderPanel(this);};
    p.render=function(...args){
      ensure(this);
      if(this.isConnected)start(this);
      if(this._nccGestures?.size)return; // never destroy active Android pointer captures
      // Prevent stale old gateway snapshot masking live local data.
      if(this._nccState&&this._mixer) this._mixer.snapshot=null;
      const result=original.render.call(this,...args);
      const label=this.shadowRoot?.querySelector('.utility strong');
      if(label&&!this.demo)label.textContent='HOME ASSISTANT / DIRECT OSC';
      writeFields(this);
      return result;
    };
    document.querySelectorAll(ELEMENT).forEach(card=>{
      try{card._mixer?.disconnect(false);ensure(card);if(card._config)card.setConfig(card._config);if(card.isConnected)start(card);card.render();}
      catch(err){console.warn('NCC-1337 v1.0:',err);}
    });
  }
  customElements.whenDefined(ELEMENT).then(()=>patch(customElements.get(ELEMENT)));
})();
