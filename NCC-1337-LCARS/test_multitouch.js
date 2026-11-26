'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/ncc1337-direct-osc-addon.js','utf8');
const indices=[0,1,2,4,6,7,8,9,10,11];
const outs=['MAIN','PHONES','MON2'];
const state={version:'0.8',inputs:indices.map(index=>({index,name:'Strip '+index,partner_db:{},sends:Object.fromEntries(outs.map(o=>[o,{state:'OBSERVED',dB:-30,age_s:0.5}]))})),last_send:null,manual_fader_packets_sent:0,automatic_fader_packets_sent:0};
class Root{
 constructor(){this.handlers={};this.activeElement=null;}
 addEventListener(t,h){(this.handlers[t]??=[]).push(h)}
 querySelector(){return null}
 querySelectorAll(){return []}
 async fire(type,e){for(const cb of this.handlers[type]||[])await cb(e)}
}
class Card{
 constructor(){this.shadowRoot=new Root();this.isConnected=true;this._styles='';this._mixer={snapshot:null,disconnect(){}};this._submix='headphones';this._view='audio';}
 setConfig(c){this._config=c;}connectedCallback(){}disconnectedCallback(){}render(){this.rendered=(this.rendered||0)+1}
 bank(){return '<div class="lf-vbank-fader">'.repeat(10)}mixerPanel(){return ''}readGlobalInputBank(){return null}
 set hass(h){this._hass=h}
}
const sent=[],timers=new Map();let tid=0;
const ctx={customElements:{whenDefined(){return Promise.resolve()},get(){return Card}},document:{querySelectorAll(){return []}},console,
 fetch(url,opts){sent.push({url,opts});return Promise.resolve({ok:true,json:async()=>url.endsWith('/api/state')?state:{sent:true}})},
 setInterval(fn,ms){timers.set(++tid,{fn,ms});return tid},clearInterval(id){timers.delete(id)}};
function target(i){return {dataset:{directIndex:String(i)},closest(sel){if(sel.includes('data-direct-touch'))return this;return null;},getBoundingClientRect(){return {height:150}},setPointerCapture(){},hasPointerCapture(){return false},setAttribute(){}}}
function evt(t,p,y){return {target:t,pointerId:p,clientY:y,button:0,preventDefault(){},stopImmediatePropagation(){}}}
async function settle(){await Promise.resolve();await new Promise(r=>setImmediate(r));}
async function tick(){for(const t of timers.values())if(t.ms===120)await t.fn();await settle();}
(async()=>{
 vm.createContext(ctx);vm.runInContext(source,ctx);await settle();const c=new Card();c.setConfig({});c.render();await settle();
 assert.match(c._styles,/touch-action:none/);assert.match(c.bank(),/role="slider"/);
 assert.equal((c.bank().match(/data-direct-touch/g)||[]).length,10);
 const first=target(0),second=target(1);
 await c.shadowRoot.fire('pointerdown',evt(first,101,90));
 await c.shadowRoot.fire('pointerdown',evt(second,102,90));
 assert.equal(c._nccGestures.size,2,'two independent Android fingers');
 await c.shadowRoot.fire('pointermove',evt(first,101,70));
 await c.shadowRoot.fire('pointermove',evt(second,102,112));
 assert.equal(c._nccQueue.size,2);
 assert.equal(sent.filter(x=>x.url.endsWith('/api/send')).length,0,'feedback and pointer move do not flood network');
 const before=c.rendered;c.render();assert.equal(c.rendered,before,'render never steals pointer capture');
 await tick();let sends=sent.filter(x=>x.url.endsWith('/api/send'));assert.equal(sends.length,1,'global rate limit');
 await tick();sends=sent.filter(x=>x.url.endsWith('/api/send'));assert.equal(sends.length,2);
 assert.deepEqual(sends.map(s=>JSON.parse(s.opts.body).input_index),[0,1]);
 const a=JSON.parse(sends[0].opts.body),b=JSON.parse(sends[1].opts.body);
 assert(a.target_db>-30&&b.target_db<-30,'independent opposite-direction drags');
 assert.equal(a.submix,'PHONES');assert.equal(b.submix,'PHONES');
 await c.shadowRoot.fire('pointerup',evt(first,101,70));await c.shadowRoot.fire('pointerup',evt(second,102,112));
 assert.equal(c._nccGestures.size,0);
 // Tap alone selects but doesn't transmit.
 const sentBefore=sent.filter(x=>x.url.endsWith('/api/send')).length;
 await c.shadowRoot.fire('pointerdown',evt(first,201,90));await c.shadowRoot.fire('pointerup',evt(first,201,90));await tick();
 assert.equal(sent.filter(x=>x.url.endsWith('/api/send')).length,sentBefore,'tap sends nothing');
 // Audio telemetry changes and polls must not enqueue transmissions.
 state.inputs[0].sends.PHONES.dB=-23.05;
 for(const t of timers.values())if(t.ms===1200)await t.fn();await settle();await tick();
 assert.equal(sent.filter(x=>x.url.endsWith('/api/send')).length,sentBefore,'feedback never writes');
 // Stale feedback is not allowed to write.
 state.inputs[0].sends.PHONES.age_s=40;
 await c.shadowRoot.fire('pointerdown',evt(first,301,95));await c.shadowRoot.fire('pointermove',evt(first,301,50));await tick();
 assert.equal(sent.filter(x=>x.url.endsWith('/api/send')).length,sentBefore);
 // Keyboard adjustment is explicit, without touch action.
 state.inputs[0].sends.PHONES.age_s=0.5;
 const kev={target:first,key:'ArrowUp',preventDefault(){},stopImmediatePropagation(){}};
 await c.shadowRoot.fire('keydown',kev);await tick();
 assert.equal(sent.filter(x=>x.url.endsWith('/api/send')).length,sentBefore+1);
 c.disconnectedCallback();assert.equal(timers.size,0,'cleanly shut down poll and sender timers');
 console.log('PASS: 10 vertical SVG faders, 2-pointer independent Android gestures, no tap writes, global 120ms send rate, no RX-TX, stale guard, no capture-clobber');
})().catch(e=>{console.error(e);process.exitCode=1});
