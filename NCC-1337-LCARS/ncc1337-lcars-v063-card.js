/* NCC-1337 LCARS v0.4.0: installed HA test-card candidate; live verified MQTT master telemetry; 10 input slots unmapped; no hardware writes. */
let NCC1337_V042_STYLES = ":host{display:block;--bg:#050508;--deep:#0c0910;--ink:#f6e7d0;--muted:#a99ba5;--peach:#f9b68d;--orange:#ff9c55;--coral:#ff817d;--lav:#bea4eb;--violet:#8a7ad9;--blue:#86c4e2;--sub:#18121b;font-family:'Arial Narrow','Roboto Condensed','Helvetica Neue',Arial,sans-serif;color:var(--ink)}\n:host *, :host *:before,:host *:after{box-sizing:border-box}\n:host [data-theme=\"blue\"]{--peach:#80cdeb;--orange:#83b9f9;--coral:#729aff;--lav:#87b2ec;--violet:#6693d2;--blue:#d3eaff;--ink:#e6f7ff;--muted:#98b6c9;--sub:#091826}\nbutton{font:inherit;cursor:pointer;touch-action:manipulation}button:focus-visible{outline:3px solid white;outline-offset:3px}button:disabled{opacity:.45;cursor:not-allowed}\nha-card{display:block;border-radius:0;border:0;background:none;box-shadow:none;overflow:hidden;container:lcars / inline-size}\n.lcars{background:var(--bg);padding:18px 22px 20px;max-width:1680px;margin:auto;min-height:770px;overflow:hidden}\n.head{display:grid;grid-template-columns:165px minmax(0,1fr);gap:0;position:relative}\n.head-elbow{height:122px;background:var(--peach);border-radius:74px 0 0 0;display:flex;align-items:flex-end;justify-content:center;color:var(--bg);font-weight:1000;letter-spacing:.08em;padding:16px 5px;font-size:19px}\n.head-right{padding:7px 0 0 14px;min-width:0}\n.head-top{display:flex;align-items:center;gap:16px;min-width:0}\n.head-title{font-size:clamp(29px,4.2vw,70px);font-weight:1000;letter-spacing:-.072em;line-height:.95;margin:0;color:var(--peach);white-space:nowrap}\n.head-id{align-self:center;margin-left:auto;color:var(--lav);font-size:clamp(11px,1.4vw,18px);font-weight:900;letter-spacing:.1em;text-align:right}\n.head-sub{margin:8px 0 0;display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--muted);letter-spacing:.16em;font-weight:800;text-transform:uppercase}\n.header-bars{display:grid;grid-template-columns:1.25fr .15fr .83fr .11fr .48fr;gap:7px;margin-top:13px;height:25px}\n.header-bars i{display:block;background:var(--lav)}.header-bars i:nth-child(2){background:var(--bg)}.header-bars i:nth-child(3){background:var(--coral)}.header-bars i:nth-child(4){background:var(--bg)}.header-bars i:nth-child(5){background:var(--orange);border-radius:0 22px 22px 0}\n.structure{display:grid;grid-template-columns:165px minmax(0,1fr);gap:0}\n.spine{position:relative;display:flex;flex-direction:column;min-height:688px;padding:4px 11px 0 43px}\n.spine:before{content:\"\";position:absolute;left:0;top:0;bottom:0;width:43px;background:var(--peach);border-radius:0 0 0 74px}\n.spine:after{content:\"\";position:absolute;left:43px;bottom:0;width:calc(100% - 43px);height:23px;background:var(--peach);border-radius:0 24px 0 0}\n.spine button{position:relative;width:100%;border:0;background:var(--lav);margin:0 0 6px 0;min-height:62px;padding:8px 9px 8px 12px;color:#090710;text-align:left;text-transform:uppercase;font-weight:1000;line-height:1.02;font-size:13px;letter-spacing:.035em;border-radius:0 13px 13px 0}\n.spine button:nth-child(2){background:var(--coral)}.spine button:nth-child(3){background:var(--violet)}.spine button:nth-child(4){background:var(--orange)}.spine button:nth-child(5){background:var(--blue)}\n.spine button.active{box-shadow:inset -9px 0 0 var(--bg);filter:saturate(1.18) brightness(1.06)}.spine button .mobile{display:none}.spine button small{display:block;font-size:9px;opacity:.66;margin-top:6px;letter-spacing:.03em}\n.spine .spine-flex{flex:1}.spine-label{writing-mode:vertical-rl;position:absolute;bottom:48px;left:13px;color:#21111b;font-size:13px;font-weight:1000;letter-spacing:.20em;transform:rotate(180deg)}\n.work{padding:7px 0 0 15px;min-width:0}\n.utility{display:flex;gap:10px;align-items:center;min-height:35px;margin-bottom:10px;font-size:11px;letter-spacing:.11em;text-transform:uppercase;font-weight:900;flex-wrap:wrap}\n.utility strong{color:var(--orange)}.sep{height:9px;width:9px;border-radius:50%;background:var(--lav);display:inline-block}.utility .time{margin-left:auto;color:var(--muted);white-space:nowrap}\n.theme-switch{background:var(--violet);border:0;border-radius:0 17px 17px 0;font-size:11px;font-weight:1000;color:#09070a;padding:7px 13px;letter-spacing:.08em}\n.band{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#050508;font-weight:1000;letter-spacing:.055em;text-transform:uppercase;padding:9px 16px;min-height:40px;font-size:18px;overflow:hidden}\n.band .serial{font-weight:900;font-size:11px;letter-spacing:.12em;opacity:.66}.peach{background:var(--peach)}.orange{background:var(--orange)}.coral{background:var(--coral)}.lav{background:var(--lav)}.violet{background:var(--violet)}.blue{background:var(--blue)}\n.main-grid{display:grid;grid-template-columns:minmax(0,1.22fr) minmax(280px,.78fr);gap:14px;align-items:start}\n.module{min-width:0;position:relative}.inner{padding:18px 16px 18px 19px;background:var(--bg)}\n.module.skin{border-left:12px solid var(--peach)}.module.skin .band{margin-left:-12px}\n.audio-summary{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:24px;min-height:225px}\n.kicker{font-size:11px;letter-spacing:.18em;font-weight:1000;color:var(--lav);text-transform:uppercase}\n.big-number{font-size:clamp(51px,6vw,106px);line-height:1;letter-spacing:-.085em;font-weight:1000;color:var(--peach);margin:10px 0 3px;white-space:nowrap;font-variant-numeric:tabular-nums}\n.unit{font-size:21px;letter-spacing:0;color:var(--muted)}.speaker-name{font-size:15px;font-weight:1000;letter-spacing:.13em;margin-top:10px}\n.readout{border-bottom:2px solid #34243b;padding:12px 0;display:flex;justify-content:space-between;align-items:baseline;gap:10px}.readout strong{font-size:clamp(21px,2.2vw,35px);color:var(--lav);font-variant-numeric:tabular-nums;white-space:nowrap}.readout .left small{display:block;color:var(--muted);font-size:10px;letter-spacing:.10em;margin-top:3px}.readout .left b{font-size:13px;letter-spacing:.08em}\n.notice{margin-top:7px;background:#1a1117;border-left:7px solid var(--coral);padding:10px 13px;font-size:11px;letter-spacing:.03em;line-height:1.5;color:#e6c2bf}.notice b{color:var(--coral)}\n.links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.linkbit{background:#151019;padding:11px 10px;min-width:0}.linkbit label{display:block;color:var(--muted);font-size:10px;letter-spacing:.09em}.linkbit strong{font-size:23px;display:block;color:var(--peach);margin-top:4px}\n.rail-group{display:grid;grid-template-columns:1fr 1fr .38fr;gap:7px;height:15px;margin:12px 0 14px}.rail-group span{background:var(--orange)}.rail-group span:nth-child(2){background:var(--lav)}.rail-group span:nth-child(3){background:var(--coral);border-radius:0 15px 15px 0}\n.matrix{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px;padding:9px 12px 13px}.matrix-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 4px;border-bottom:1px solid #372936;min-width:0}.matrix-row span{font-size:12px;font-weight:1000;letter-spacing:.075em;overflow-wrap:anywhere}.state{font-size:12px;white-space:nowrap;color:var(--lav);font-weight:1000}.state.on{color:var(--peach)}.state.off{color:var(--muted)}.state.unknown{color:var(--coral)}\n.lower-grid{display:grid;grid-template-columns:1fr .9fr 1fr;gap:14px;margin-top:14px}.small-body{min-height:166px;padding:12px 15px;background:var(--bg)}\n.small-row{padding:11px 0;border-bottom:1px solid #342634;display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:800;letter-spacing:.05em}.small-row span:last-child{color:var(--lav)}\n.strip-btn{border:0;display:block;width:100%;background:var(--violet);color:#0a070d;text-align:left;padding:12px 13px;font-weight:1000;font-size:13px;letter-spacing:.07em;margin:6px 0}.strip-btn.selected{background:var(--orange)}.strip-btn.slim{padding:8px 12px;background:var(--lav)}\n.info-copy{color:var(--muted);font-size:12px;line-height:1.6}.info-copy b{color:var(--peach)}\n.footer-bars{display:grid;grid-template-columns:1fr .2fr 2fr .13fr .47fr;gap:7px;height:18px;margin-top:13px}.footer-bars span{background:var(--lav)}.footer-bars span:nth-child(2){background:var(--bg)}.footer-bars span:nth-child(3){background:var(--orange)}.footer-bars span:nth-child(4){background:var(--bg)}.footer-bars span:nth-child(5){background:var(--coral);border-radius:0 16px 16px 0}\n.footer-note{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;color:var(--muted);font-size:10px;letter-spacing:.09em;padding:9px 0 0;text-transform:uppercase}\n.focus-panel{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(245px,.55fr);gap:14px}.focus-stack{padding:15px 20px;min-height:410px}.focus-side{background:#100d13;padding:15px;border-left:10px solid var(--lav);color:var(--muted);font-size:13px;line-height:1.6}.focus-side h3{color:var(--peach);margin:0 0 12px;font-size:20px;letter-spacing:.03em}\n.focus-matrix{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:15px 0}.channel{padding:16px;background:#121019;min-width:0;border-left:8px solid var(--lav)}.channel .name{color:var(--muted);font-size:11px;font-weight:1000;letter-spacing:.14em}.channel .value{font-size:clamp(25px,3vw,46px);font-weight:1000;margin-top:6px;color:var(--peach);letter-spacing:-.06em}.channel .sublabel{font-size:10px;letter-spacing:.05em;color:var(--muted);margin-top:7px}\n.flat-heading{font-size:11px;letter-spacing:.16em;color:var(--lav);font-weight:1000;margin:18px 0 8px}\n.action-buttons{display:grid;grid-template-columns:1fr 1fr;gap:7px}.action-buttons button{background:var(--violet);border:0;color:#0c0610;text-align:left;font-size:11px;font-weight:1000;padding:11px;letter-spacing:.06em}.action-buttons button:disabled{opacity:.7;cursor:not-allowed}\n.readonly-tag{font-size:10px;color:var(--bg);background:var(--peach);padding:5px 12px;border-radius:0 14px 14px 0;font-weight:1000;letter-spacing:.1em}\n.energy{height:9px;background:#241b2a;overflow:hidden;margin:15px 0 0}.energy span{display:block;height:100%;width:60%;background:var(--lav)}\n@container lcars (max-width:1050px){.lcars{padding:11px}.head,.structure{grid-template-columns:112px minmax(0,1fr)}.head-elbow{height:107px;font-size:13px;padding-bottom:12px}.head-title{font-size:clamp(30px,4.3vw,53px)}.spine{padding-left:32px;min-height:640px}.spine:before{width:32px}.spine:after{left:32px;width:calc(100% - 32px)}.spine button{font-size:11px;min-height:54px;padding-left:7px}.spine-label{left:8px;font-size:9px}.head-right{padding-left:10px}.work{padding-left:10px}.lower-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lower-grid>:last-child{grid-column:1/-1}.audio-summary{gap:13px}.inner{padding:13px 10px}.main-grid{grid-template-columns:minmax(0,1fr) minmax(220px,.7fr)}.big-number{font-size:clamp(48px,5.7vw,78px)}}\n@container lcars (max-width:710px){.lcars{padding:7px;min-height:0}.head,.structure{grid-template-columns:67px minmax(0,1fr)}.head-elbow{height:82px;border-radius:41px 0 0 0;font-size:9px;padding:0 1px 10px}.head-right{padding:5px 0 0 5px}.head-title{font-size:clamp(25px,6.7vw,45px)}.head-id{font-size:9px}.head-sub{font-size:8px;letter-spacing:.06em;line-height:1.3}.head-sub span:last-child{display:none}.header-bars{gap:4px;height:13px;margin-top:10px}.spine{padding:4px 3px 0 13px;min-height:715px}.spine:before{width:13px;border-radius:0 0 0 22px}.spine:after{left:13px;width:calc(100% - 13px);height:12px}.spine button{padding:7px 1px;text-align:center;min-height:58px;font-size:0;border-radius:0 5px 5px 0;margin-bottom:4px}.spine button .name{display:none}.spine button .mobile{display:inline;font-size:11px;letter-spacing:0}.spine button small{display:none}.spine button.active{box-shadow:inset -3px 0 0 var(--bg)}.spine-label{display:none}.work{padding:5px 0 0 6px}.utility{font-size:9px;gap:6px;margin-bottom:8px}.utility .time{display:none}.theme-switch{font-size:9px;padding:6px}.main-grid,.focus-panel{grid-template-columns:1fr}.lower-grid{grid-template-columns:1fr}.lower-grid>:last-child{grid-column:auto}.audio-summary{grid-template-columns:1fr 1fr;min-height:155px}.big-number{font-size:clamp(41px,9.5vw,78px)}.unit{font-size:15px}.band{min-height:33px;font-size:13px;padding:7px 9px}.band .serial{font-size:9px}.inner{padding:11px}.readout{padding:8px 0}.readout strong{font-size:20px}.notice{font-size:10px}.links{margin-top:8px}.linkbit strong{font-size:18px}.small-body{min-height:0}.focus-stack{min-height:0;padding:12px}.focus-side{font-size:12px;padding:10px}.matrix{grid-template-columns:1fr}.spine{min-height:900px}.footer-note{font-size:9px}.main-grid{gap:6px}.lower-grid{gap:6px;margin-top:6px}.rail-group{margin:7px 0}.head-id{white-space:normal}}\n@container lcars (max-width:410px){.head-title{font-size:26px}.head-id{display:none}.audio-summary{gap:7px}.big-number{font-size:46px}.speaker-name{font-size:11px}.readout .left b{font-size:11px}.channel{padding:9px}.channel .value{font-size:25px}}\n";
NCC1337_V042_STYLES += String.raw`
/* v0.3.1 - original master slider language, made visual-only */
.master-level{min-width:0;margin:16px 0 9px}
.master-level .mix-track{height:30px}
.mix-track{position:relative;height:22px;width:100%;min-width:0;border:2px solid var(--lav);border-radius:16px;background:#18111b;overflow:hidden;box-shadow:inset 0 0 0 3px #060407;isolation:isolate}
.mix-track:before{content:"";pointer-events:none;position:absolute;z-index:3;inset:4px;border:1px solid color-mix(in srgb,var(--lav) 75%,transparent);border-radius:12px}
.mix-fill{height:100%;max-width:100%;border-radius:12px 0 0 12px;background:linear-gradient(90deg,#f78f53,var(--orange) 56%,#ffc16c);box-shadow:inset 0 -3px 0 #a45f42}
.mix-track .mix-tip{position:absolute;z-index:2;top:0;bottom:0;left:var(--level,0%);width:2px;max-width:calc(100% - 2px);background:#fff2db;opacity:.68}
.mix-track.no-data .mix-tip,.mix-track.no-data .mix-fill{display:none}
.mix-track.no-data{border-color:#57475e}
.mix-caption{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;margin:6px 0 4px;color:var(--muted);font-weight:850;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.mix-caption .current{color:var(--lav);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.monitor-mini{margin:8px 0 14px;min-width:0}
.monitor-mini .mix-track{height:21px}
.monitor-mini .mix-caption{margin-bottom:7px}
.bank-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:11px 0 9px;font-size:11px;letter-spacing:.09em;color:var(--muted);font-weight:900;flex-wrap:wrap}
.bank-title strong{color:var(--lav)}
.bank-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 12px}
.bank-tabs button{border:0;background:#403045;color:var(--ink);min-height:38px;padding:8px 12px;font-size:11px;letter-spacing:.05em;font-weight:1000;border-radius:0 15px 15px 0}
.bank-tabs button.active{background:var(--orange);color:#110909;box-shadow:inset 5px 0 var(--lav)}
.bank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px;row-gap:6px}
.bank-row{min-width:0;border-bottom:1px solid #302434;padding:5px 0 8px}
.bank-label{display:flex;justify-content:space-between;align-items:center;gap:7px;font-size:11px;letter-spacing:.06em;font-weight:900;margin:0 0 5px;color:var(--ink)}
.bank-label .bank-num{background:var(--lav);color:var(--bg);padding:4px 6px;min-width:33px;text-align:center;font-size:10px;border-radius:0 8px 8px 0}
.bank-label .bank-source{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bank-label .bank-value{color:var(--lav);white-space:nowrap;font-variant-numeric:tabular-nums}
.bank-row .mix-track{height:18px;border-width:1px}
.bank-row .mix-track:before{inset:3px;border-radius:9px}
.bank-row .mix-fill{border-radius:10px 0 0 10px}

/* LCARS Purple & Yellow alternate submix palette. Scoped to illustrative bank ONLY. */
.submix-alt-palette{
 --bank-purple:#aa8bf0;--bank-purple-hi:#c5a8ff;
 --bank-purple-deep:#6b469f;--bank-yellow:#ffd45b;
 --bank-yellow-hi:#ffe99a;--bank-dark:#160d1b;
 background:#0b0710;
 border-left:9px solid var(--bank-purple);
 border-bottom:5px solid var(--bank-yellow);
 padding:10px 13px 12px;
 min-width:0;
}
.submix-alt-palette .bank-title{color:var(--bank-yellow-hi);margin:1px 0 10px;gap:9px}
.submix-alt-palette .bank-title strong{color:var(--bank-purple-hi)}
.submix-alt-palette .bank-tabs{gap:6px;margin-bottom:10px}
.submix-alt-palette .bank-tabs button{background:var(--bank-purple-deep);color:#fff2c9;box-shadow:inset 4px 0 0 var(--bank-purple-hi);border-radius:0 13px 13px 0}
.submix-alt-palette .bank-tabs button.active{background:var(--bank-yellow);color:#201027;box-shadow:inset 5px 0 0 var(--bank-purple)}
.submix-alt-palette .bank-row{border-color:#3d284c}
.submix-alt-palette .bank-label .bank-source{color:#f5e4ff}
.submix-alt-palette .bank-row .mix-track{background:var(--bank-dark);box-shadow:inset 0 0 0 2px #060409;}
.submix-alt-palette .bank-row .mix-track:before{border-color:color-mix(in srgb,var(--bank-yellow) 52%,transparent)}
/* Every other submix fader swaps purple and yellow, preserving master styling. */
.submix-alt-palette .bank-row:nth-child(odd) .bank-num{background:var(--bank-purple);color:#180b22}
.submix-alt-palette .bank-row:nth-child(odd) .bank-value{color:var(--bank-purple-hi)}
.submix-alt-palette .bank-row:nth-child(odd) .mix-track{border-color:var(--bank-yellow)}
.submix-alt-palette .bank-row:nth-child(odd) .mix-fill{background:linear-gradient(90deg,var(--bank-purple-deep),var(--bank-purple-hi))}
.submix-alt-palette .bank-row:nth-child(even) .bank-num{background:var(--bank-yellow);color:#1c1020}
.submix-alt-palette .bank-row:nth-child(even) .bank-value{color:var(--bank-yellow-hi)}
.submix-alt-palette .bank-row:nth-child(even) .mix-track{border-color:var(--bank-purple)}
.submix-alt-palette .bank-row:nth-child(even) .mix-fill{background:linear-gradient(90deg,#f5b93f,var(--bank-yellow-hi))}
.submix-alt-palette .bank-row .mix-tip{background:#fff9e2}
.submix-alt-palette .bank-legend{background:#1b1222;border-left:7px solid var(--bank-yellow);color:#dccbe4;margin-bottom:0}
.submix-band{background:#9f7ad6!important;color:#160923!important}
.submix-band .serial{color:#251129;background:var(--bank-yellow,#ffda67);padding:2px 7px;border-radius:0 10px 10px 0;opacity:1!important}
@container lcars (max-width:710px){
 .submix-alt-palette{padding:8px 8px 11px;border-left-width:6px}
 .submix-alt-palette .bank-title{font-size:9px}
 .submix-alt-palette .bank-label{gap:5px}
}


/* 03.8 – user-specified compact vertical equalizer-format FADERS.
   All eight fill bars are PURPLE (NOT alternating yellow); yellow accents
   are limited to LCARS rails, numbered tabs, and position indicators.
   Draw only; these are not interactive sliders. */
.submix-alt-palette{
 --bank-purple:#9860de;--bank-purple-hi:#d6a5ff;
 --bank-purple-deep:#623598;--bank-yellow:#ffdc53;
 --bank-yellow-hi:#ffebb0;--bank-dark:#100b1c;
 border-left:0;border-bottom:0;background:#07060a;
 padding:0 0 11px 0;
}
.submix-alt-palette .bank-title{padding:10px 8px 2px;margin:0;color:#ffe081;}
.submix-alt-palette .bank-title strong{color:#dcb8ff}
.submix-alt-palette .bank-tabs{padding:6px 8px 12px;margin:0;gap:6px}
.submix-alt-palette .bank-tabs button{border-radius:0 13px 13px 0;background:#7144a8;box-shadow:inset 4px 0 0 #c89aff;color:#fff}
.submix-alt-palette .bank-tabs button.active{background:var(--bank-yellow);box-shadow:inset 5px 0 0 var(--bank-purple);color:#1b092a}
.v-bank-shell{border-left:9px solid #a06bdf;border-bottom:6px solid #a06bdf;border-radius:35px 0 0 0;background:linear-gradient(180deg,#0b0812,#09070f);padding:0 9px 9px;min-width:0}
.v-bank-toprail{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:29px;margin-left:-1px;background:var(--bank-yellow);color:#1a0a27;border-radius:28px 0 0 0;padding:6px 12px 5px 18px;font-size:11px;letter-spacing:.1em;font-weight:1000;text-transform:uppercase}
.v-bank-toprail b{background:#7a48b3;color:#fff;font-size:9px;padding:4px 7px;border-radius:0 9px 9px 0;white-space:nowrap}
.v-bank-trim{height:9px;margin:3px 0 12px;display:grid;grid-template-columns:4fr 1fr 2fr;gap:5px}
.v-bank-trim i{background:#9860de;display:block}.v-bank-trim i:nth-child(2){background:#0a0711}.v-bank-trim i:nth-child(3){background:#ffdc53;border-radius:0 9px 9px 0}
.bank-grid.v-bank-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:7px;margin:0 auto;max-width:690px;min-width:0}
.v-bank-grid .bank-row{min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:3px;border:0;padding:0;position:relative}
.v-bank-grid .v-fader-number{display:block;text-align:center;min-width:0;padding:5px 0 3px;color:#26122f;background:var(--bank-yellow);font-weight:1000;font-size:10px;line-height:1;border-radius:0 9px 9px 0;letter-spacing:.03em}
.v-bank-grid .v-fader-well{height:215px;position:relative;width:100%;overflow:hidden;isolation:isolate;min-width:0;background:repeating-linear-gradient(to top,#15152b 0px,#15152b 10px,#05050b 10px,#05050b 14px);border:2px solid #b487f0;border-bottom:5px solid #ffdc53;border-radius:19px 19px 0 0;box-shadow:inset 0 0 0 3px #06030e}
.v-bank-grid .v-fader-well:before{content:"";position:absolute;z-index:4;pointer-events:none;inset:4px 4px 0;border:1px solid #5f3a8b;border-bottom:0;border-radius:14px 14px 0 0}
.v-bank-grid .v-fader-fill{position:absolute;left:0;right:0;bottom:0;max-height:100%;background:repeating-linear-gradient(to top,transparent 0px,transparent 10px,#0d0918 10px,#0d0918 14px),linear-gradient(to top,#57278d 0%,#8c49cb 58%,#d19aff 100%);box-shadow:inset 3px 0 0 #a565e5,inset -3px 0 0 #632eab}
.v-bank-grid .v-fader-thumb{height:7px;position:absolute;left:1px;right:1px;z-index:5;min-width:0;background:linear-gradient(90deg,#ffeb95,#ffdc53 85%);border:1px solid #fff0aa;box-shadow:0 1px 0 #27113c,0 -1px 0 #27113c;pointer-events:none}
.v-bank-grid .v-fader-name{display:block;color:#d1a8ff;text-align:center;font-size:10px;font-weight:1000;white-space:nowrap;letter-spacing:.015em;line-height:1.5}
.v-bank-grid .v-fader-value{color:#ffe07c;text-align:center;font-size:11px;font-weight:1000;font-variant-numeric:tabular-nums;line-height:1.4}
.v-bank-footrail{margin-top:8px;display:grid;grid-template-columns:1fr 3fr 1fr;gap:5px;height:9px}
.v-bank-footrail i{background:#ffdc53}.v-bank-footrail i:nth-child(2){background:#ad7fe7}.v-bank-footrail i:last-child{background:#ffdc53;border-radius:0 7px 7px 0}
.submix-alt-palette .bank-legend{margin:9px 0 0;padding:8px 10px;background:#160e21;border-left:6px solid #ffdc53;color:#d9c4e5;font-size:10px;line-height:1.5}
@container lcars (max-width:710px){
 .submix-alt-palette{padding:0 0 8px;border-left:0}
 .submix-alt-palette .bank-title{padding:8px 5px 0;gap:5px}
 .submix-alt-palette .bank-tabs{gap:3px;padding:6px 4px 8px}
 .v-bank-shell{padding:0 4px 7px;border-left-width:5px;border-bottom-width:5px;border-radius:23px 0 0 0}
 .v-bank-toprail{min-height:24px;border-radius:20px 0 0 0;padding:4px 4px 3px 8px;font-size:8px;letter-spacing:.02em}
 .v-bank-toprail b{font-size:7px;padding:3px 4px}
 .v-bank-trim{margin:3px 0 7px;height:6px}
 .bank-grid.v-bank-grid{grid-template-columns:repeat(8,minmax(0,1fr));gap:3px}
 .v-bank-grid .v-fader-well{height:170px;border-width:1px;border-bottom-width:4px;border-radius:12px 12px 0 0}
 .v-bank-grid .v-fader-well:before{inset:2px 2px 0;border-radius:9px 9px 0 0}
 .v-bank-grid .v-fader-number{font-size:8px;padding:4px 0 3px;border-radius:0 5px 5px 0}
 .v-bank-grid .v-fader-name{font-size:7px}
 .v-bank-grid .v-fader-value{font-size:8px}
 .v-bank-grid .v-fader-thumb{height:5px}
 .v-bank-grid .v-fader-fill{box-shadow:inset 2px 0 0 #a565e5,inset -2px 0 0 #632eab}
 .submix-alt-palette .bank-legend{font-size:9px;padding:6px}
}
@container lcars (max-width:380px){
 .bank-grid.v-bank-grid{gap:2px}
 .v-bank-grid .v-fader-well{height:145px}
 .v-bank-grid .v-fader-name{font-size:6px}
 .v-bank-grid .v-fader-value{font-size:7px}
 .v-bank-toprail{font-size:7px}
}

.bank-legend{background:#180f1b;border-left:7px solid var(--coral);margin:11px 0 0;padding:9px 12px;color:var(--muted);font-size:11px;line-height:1.5;letter-spacing:.025em}
.master-console{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:16px;padding:12px 0 14px}
.master-console .big-number{font-size:clamp(45px,5vw,82px)}
.master-console .speaker-name{margin:6px 0}
.master-console .notice{margin-top:9px}
.master-console .readout{padding:10px 0}
.audio-focus-rebuilt .focus-stack{padding:12px 18px}
.audio-focus-rebuilt .focus-side{overflow-wrap:anywhere}
.lcars{position:relative}
.lcars [data-visual-only]{cursor:default}
/* Mobile closure: use a real orange structural rail, not horizontal clipping. */
@container lcars (max-width:710px){
 .lcars{padding:7px 20px 15px 7px;overflow:hidden}
 .lcars:after{content:"";position:absolute;z-index:5;right:0;top:9px;bottom:10px;width:10px;background:var(--orange);border-radius:15px 0 0 16px;pointer-events:none}
 .head,.structure,.work,.main-grid,.focus-panel,.audio-summary,.inner,.focus-stack{min-width:0}
 .head-title{white-space:normal;overflow-wrap:anywhere;line-height:.93}
 .audio-summary{grid-template-columns:minmax(0,1fr);gap:8px}
 .audio-summary .big-number{font-size:clamp(39px,11vw,70px)}
 .audio-summary .readout{padding:8px 0}
 .master-level{margin:11px 0 8px}
 .main-grid{min-width:0}
 .master-console{grid-template-columns:minmax(0,1fr);gap:6px}
 .master-console .big-number{font-size:clamp(38px,10vw,70px)}
 .audio-focus-rebuilt .focus-stack{padding:10px}
 .bank-grid{grid-template-columns:minmax(0,1fr);gap:4px}
 .bank-tabs button{flex:1;font-size:9px;padding:7px 4px;min-height:38px}
 .band{gap:6px;overflow-wrap:anywhere}
 .band .serial{white-space:normal;text-align:right}
 .mix-track{max-width:100%}
}
@container lcars (max-width:380px){
 .lcars{padding-right:17px}.lcars:after{width:8px}
 .head,.structure{grid-template-columns:54px minmax(0,1fr)}
 .head-elbow{font-size:8px}
 .head-title{font-size:22px}
 .spine{padding-left:10px}.spine:before{width:10px}.spine:after{left:10px;width:calc(100% - 10px)}
 .spine button .mobile{font-size:9px}
 .work{padding-left:4px}
 .utility span:not(.sep){font-size:8px}
 .big-number{letter-spacing:-.09em}
 .bank-title{font-size:9px}
}
`;
(function(){
'use strict';
NCC1337_V042_STYLES += "\n\n/* v0.3.8 \u2014 Universal LCARS fader. ONE structural silhouette across all sizes.\n   Reference: squared-off C-bracket with one rounded left elbow, precise fine\n   graduated track, white oblong pointer extending to right. Not a bar graph.\n   Read-only meters, not range inputs; compact units omit the numbered scale. */\n.lf-rack {display:grid;grid-template-columns:minmax(170px,1fr) 145px 145px;gap:13px;align-items:start;padding:10px 0 9px;min-width:0}\n.lf-readout {min-width:0; padding:7px 3px 0 0}\n.lf-readout .big-number {font-size:clamp(48px,5.6vw,81px);line-height:1.03;margin:8px 0}\n.lf-master-note {margin-top:17px;padding:10px 12px 10px 14px;background:#17101b;border-left:6px solid var(--coral);font-weight:800;font-size:11px;line-height:1.5;color:#d8c6cf}\n.lf-master-note b {color:var(--peach)}\n.lf-output-status {margin-top:10px;display:grid;gap:5px}\n.lf-output-status div{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px;padding:9px 4px;border-bottom:1px solid #362536;font-size:12px}\n.lf-output-status strong{color:var(--lav);font-size:15px;white-space:nowrap;font-variant-numeric:tabular-nums}\n.lf-monitor {min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px;border-left:4px solid #25152f;padding-left:6px}\n.lf-monitor-head{font-size:11px;font-weight:1000;color:var(--lav);letter-spacing:.09em;text-align:center;min-height:25px;display:flex;align-items:center;justify-content:center}\n.lf-monitor .lf-level-value{font-size:18px;color:var(--peach);font-weight:1000;font-variant-numeric:tabular-nums;text-align:center;white-space:nowrap}\n.lf-monitor .lf-subcaption{font-size:9px;color:var(--muted);letter-spacing:.08em;text-align:center;line-height:1.2}\n.lf-fader{--lf-frame:#ffa365;--lf-tick:#ffc45b;--lf-scale:#a58feb;--lf-black:#050508;--lf-height:236px;min-width:0;width:105px;display:block;user-select:none;-webkit-user-select:none;touch-action:pan-y}\n.lf-fader.purple{--lf-frame:#b178e5;--lf-tick:#ffdd50;--lf-scale:#e8beff}\n.lf-fader.orange{--lf-frame:#ff9e5c;--lf-tick:#ffd56e;--lf-scale:#a996ee;background:transparent!important}\n.lf-fader .lf-face{height:var(--lf-height);width:100%;display:grid;grid-template-columns:30px minmax(0,1fr);align-items:stretch;min-width:0}\n.lf-fader .lf-numbers{min-width:0;height:100%;padding:21px 0 20px;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;line-height:1;font-weight:1000;font-size:10px;letter-spacing:-.06em;color:var(--lf-scale);font-variant-numeric:tabular-nums}\n.lf-fader .lf-numbers span:nth-child(3n){color:#ffd270}\n.lf-fader .lf-housing{position:relative;min-width:0;height:100%;width:100%;overflow:visible}\n.lf-fader .lf-crail{position:absolute;left:6px;top:2px;bottom:2px;width:42px;border-left:10px solid var(--lf-frame);border-top:8px solid var(--lf-frame);border-bottom:8px solid var(--lf-frame);border-radius:0 0 0 21px;filter:drop-shadow(0 0 1px #805025);pointer-events:none}\n.lf-fader .lf-crail::before{content:\"\";position:absolute;left:0;top:10px;bottom:10px;width:3px;background:#ffe2a5;opacity:.48;border-radius:0 0 2px 2px}\n.lf-fader .lf-gauge{position:absolute;top:25px;bottom:25px;left:14px;width:10px;background:repeating-linear-gradient(to bottom,var(--lf-tick) 0px,var(--lf-tick) 3px,#130e1c 3px,#130e1c 8px);border-left:2px solid #43243d;border-right:2px solid #e4a655;box-shadow:0 0 0 1px #070609;pointer-events:none}\n.lf-fader .lf-thumb{position:absolute;top:var(--lf-position);left:23px;width:39px;height:13px;background:linear-gradient(180deg,#fffef5 0%,#fffdf4 39%,#ddd9d1 100%);border:1px solid #fff7da;border-radius:999px;box-shadow:0 1px 4px #000,0 0 0 1px #4a3c48;transform:translateY(-50%);z-index:2;pointer-events:none}\n.lf-fader .lf-thumb::before{content:\"\";position:absolute;left:-11px;top:50%;width:11px;height:3px;transform:translateY(-50%);background:var(--lf-tick);box-shadow:0 0 0 1px #000}\n.lf-fader .lf-housing::after{content:\"\";position:absolute;top:var(--lf-position);left:14px;width:9px;height:2px;transform:translateY(-50%);background:#fff0aa;pointer-events:none}\n.lf-fader.no-value .lf-thumb,.lf-fader.no-value .lf-housing::after{opacity:.17}\n.lf-fader.compact{--lf-height:174px;width:100%;max-width:66px;margin:0 auto;touch-action:pan-y}\n.lf-fader.compact .lf-face{display:block;position:relative;height:var(--lf-height)}\n.lf-fader.compact .lf-numbers{display:none}\n.lf-fader.compact .lf-housing{height:100%}\n.lf-fader.compact .lf-crail{left:6%;top:2px;bottom:2px;width:69%;border-left-width:8px;border-top-width:6px;border-bottom-width:6px;border-radius:0 0 0 16px}\n.lf-fader.compact .lf-crail::before{left:0;width:2px;top:6px;bottom:6px}\n.lf-fader.compact .lf-gauge{left:calc(6% + 6px);top:15px;bottom:15px;width:9px;border-left-width:1px;border-right-width:1px}\n.lf-fader.compact .lf-thumb{left:42%;width:52%;max-width:34px;min-width:13px;height:11px}\n.lf-fader.compact .lf-thumb::before{left:-9px;width:9px}\n.lf-fader.compact .lf-housing::after{left:calc(6% + 6px);width:8px}\n.lf-bank-outer{border-left:10px solid #b37ae7;border-radius:37px 0 0 0;border-bottom:6px solid #b37ae7;padding:0 9px 8px;background:linear-gradient(180deg,#110b1c,#09070d)}\n.lf-bank-cap{margin-left:-1px;background:#ffdc52;color:#1e1028;border-radius:28px 0 0 0;padding:8px 13px 6px 18px;font-size:11px;font-weight:1000;letter-spacing:.07em;display:flex;justify-content:space-between;gap:10px}\n.lf-bank-cap b{background:#8853c5;color:white;font-size:9px;padding:3px 8px;white-space:nowrap;border-radius:0 9px 9px 0}\n.lf-bank-divider{height:7px;display:grid;grid-template-columns:1fr 1fr 2fr;gap:5px;margin:6px 0 14px}\n.lf-bank-divider i{background:#a775de}.lf-bank-divider i:nth-child(2){background:#ffde67}.lf-bank-divider i:last-child{background:#a775de;border-radius:0 7px 7px 0}\n.lf-bank-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;align-items:start;max-width:700px;margin:0 auto}\n.lf-bank-cell{min-width:0;text-align:center;padding:0;display:flex;flex-direction:column;align-items:center;gap:3px}\n.lf-bank-name{display:block;background:#ffdf5d;color:#201129;align-self:stretch;font-weight:1000;font-size:10px;line-height:1;padding:5px 0 4px;border-radius:0 10px 10px 0}\n.lf-bank-id{color:#e1b5ff;font-size:9px;font-weight:1000;letter-spacing:.03em}\n.lf-bank-val{color:#ffe28c;font-size:10px;font-weight:1000;font-variant-numeric:tabular-nums}\n.lf-bank-footer{height:8px;margin-top:10px;display:grid;grid-template-columns:2fr .7fr 1fr;gap:5px}\n.lf-bank-footer i{background:#ae7be3}.lf-bank-footer i:nth-child(2){background:#ffdb59}.lf-bank-footer i:last-child{background:#a373db;border-radius:0 8px 8px 0}\n.lf-hint{background:#130d1c;border-left:6px solid #ffda59;font-size:10px;color:#d4bedf;line-height:1.5;margin:9px 0 0;padding:8px 11px}\n.lf-orient-note{margin:0 0 10px;color:#e0b5ff;font-size:11px;letter-spacing:.05em}\n/* Same frame in horizontal mode is supported by .lf-fader.horizontal.\n   Vertical is the user-selected default for Master, Headphones and submix. */\n.lf-fader.horizontal{width:100%;max-width:295px;--lf-height:74px}\n.lf-fader.horizontal .lf-face{display:flex;flex-direction:column-reverse;height:74px;width:100%}\n.lf-fader.horizontal .lf-numbers{display:flex;height:20px;width:100%;padding:0 12px;flex-direction:row;align-items:center;justify-content:space-between;font-size:9px}\n.lf-fader.horizontal .lf-housing{height:52px;width:100%}\n.lf-fader.horizontal .lf-crail{left:3px;right:3px;top:3px;bottom:auto;width:auto;height:31px;border-left:8px solid var(--lf-frame);border-top:8px solid var(--lf-frame);border-bottom:8px solid var(--lf-frame);border-radius:0 0 0 16px}\n.lf-fader.horizontal .lf-gauge{left:18px;right:18px;top:16px;bottom:auto;height:7px;width:auto;background:repeating-linear-gradient(to right,var(--lf-tick) 0px,var(--lf-tick) 3px,#130e1c 3px,#130e1c 8px)}\n.lf-fader.horizontal .lf-thumb{left:var(--lf-position);top:11px;transform:translateX(-50%);height:28px;width:12px;border-radius:99px}\n.lf-fader.horizontal .lf-thumb::before,.lf-fader.horizontal .lf-housing::after{display:none}\n@container lcars (max-width:980px){.lf-rack{grid-template-columns:minmax(150px,1fr) 116px 116px;gap:6px}.lf-readout .big-number{font-size:clamp(46px,6.7vw,77px)}.lf-fader{width:95px}}\n@container lcars (max-width:710px){\n .lf-rack{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 7px}\n .lf-readout{grid-column:1/-1;padding:0 0 4px}\n .lf-readout .big-number{font-size:clamp(45px,11vw,76px);margin:5px 0}\n .lf-master-note{margin-top:5px}\n .lf-output-status{display:grid;grid-template-columns:1fr 1fr;gap:5px}\n .lf-output-status div{font-size:10px;padding:7px 4px}\n .lf-output-status strong{font-size:12px}\n .lf-monitor{border-left:0;border-top:6px solid #3d234b;padding:8px 0 0}\n .lf-fader{width:106px}\n .lf-monitor-head{min-height:23px}\n .lf-bank-outer{padding:0 4px 7px;border-left-width:6px;border-bottom-width:5px;border-radius:23px 0 0 0}\n .lf-bank-cap{font-size:9px;letter-spacing:0;padding:6px 4px 5px 8px;border-radius:20px 0 0 0}\n .lf-bank-cap b{font-size:7px;padding:3px 4px}\n .lf-bank-divider{margin:5px 0 10px;height:6px}\n .lf-bank-grid{gap:2px}\n .lf-bank-name{font-size:7px;border-radius:0 6px 6px 0;padding:4px 0}\n .lf-fader.compact{--lf-height:142px;width:100%}\n .lf-fader.compact .lf-crail{left:1%;width:75%;border-left-width:5px;border-top-width:5px;border-bottom-width:5px;border-radius:0 0 0 11px}\n .lf-fader.compact .lf-gauge{left:calc(1% + 4px);width:7px;top:13px;bottom:13px}\n .lf-fader.compact .lf-thumb{left:45%;width:55%;height:9px;min-width:10px}\n .lf-fader.compact .lf-housing::after{left:calc(1% + 4px);width:6px}\n .lf-bank-id,.lf-bank-val{font-size:8px}\n .lf-hint{font-size:9px;padding:7px}\n}\n@container lcars (max-width:380px){.lf-fader.compact{--lf-height:125px}.lf-bank-grid{gap:1px}.lf-bank-id,.lf-bank-val{font-size:7px}.lf-bank-name{font-size:6px}}\n";
NCC1337_V042_STYLES += "\n/* v0.3.8 exact shared silhouette: HARD 90-degree top corner; only the\n   BOTTOM-LEFT elbow is curved. Top is flat and square. No upper bend.\n   The numeric row is above each fader, separate from the instrument scale. */\n.lf-fader .lf-crail {border-radius:0 0 0 23px !important}\n.lf-fader.compact .lf-crail {border-radius:0 0 0 16px !important}\n.lf-fader.horizontal .lf-crail {border-radius:0 0 0 16px !important}\n@container lcars (max-width:710px){.lf-fader.compact .lf-crail{border-radius:0 0 0 11px !important}}\n.lf-entry{display:flex;align-items:stretch;justify-content:center;gap:0;width:100%;max-width:107px;height:30px;margin:0 0 6px 0;position:relative;border-left:5px solid var(--orange);border-bottom:3px solid var(--orange);background:#110d15;min-width:0}\n.lf-entry input{display:block;width:100%;min-width:0;min-height:0;background:#110d15;color:#fff0bd;border:none;border-radius:0;outline:none;text-align:center;font-size:16px;line-height:24px;font-family:inherit;font-weight:1000;font-variant-numeric:tabular-nums;padding:2px 3px 0;appearance:textfield;-moz-appearance:textfield}\n.lf-entry input::-webkit-inner-spin-button,.lf-entry input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}\n.lf-entry input:focus-visible{outline:2px solid #ffef8c;outline-offset:2px}\n.lf-entry input:disabled{opacity:1;-webkit-text-fill-color:#fff0bd;cursor:default}\n.lf-entry .lf-unit{background:var(--orange);color:#140c16;font-size:9px;font-weight:1000;display:flex;align-items:center;justify-content:center;min-width:23px;padding:0 4px}\n.lf-entry .lf-note{position:absolute;top:-11px;left:0;color:#bda1da;font-size:8px;font-weight:900;letter-spacing:.06em;white-space:nowrap}\n.lf-monitor{padding-top:8px}\n.lf-monitor-head{min-height:23px}\n.lf-entry.compact{height:25px;max-width:62px;margin:5px 0 7px;border-left:3px solid #ad7add;border-bottom:3px solid #ad7add}\n.lf-entry.compact input{font-size:11px;line-height:20px;padding:0 2px}\n.lf-entry.compact .lf-unit{min-width:11px;padding:0 1px;background:#aa7ade;color:#190d24;font-size:8px}\n.lf-entry.compact .lf-note{display:none}\n.lf-bank-cell{gap:1px}\n.lf-monitor .lf-subcaption{line-height:1.4}\n.lf-bank-val{display:none} /* numeric percentages are now ABOVE each mini fader */\n.lf-fader.compact{margin-top:0}\n@container lcars (max-width:710px){\n .lf-entry.compact{height:23px;max-width:100%;margin:4px 0 5px;border-left-width:2px;border-bottom-width:2px}\n .lf-entry.compact input{font-size:10px;padding:0 1px}\n .lf-entry.compact .lf-unit{font-size:7px;min-width:9px;padding:0}\n .lf-entry{max-width:110px}\n}\n@container lcars (max-width:380px){\n .lf-entry.compact input{font-size:9px}\n .lf-entry.compact .lf-unit{font-size:6px;min-width:7px}\n}\n";
NCC1337_V042_STYLES += "\n/* v0.3.8: precision cleanup requested after v0.3.5. DO NOT draw a\n   numeric readout bracket or a cap crossing the top of any fader.\n   Black-backed bare text field + single vertical rail with bottom-only soft\n   endpoint. This exact CSS is shared by Master, Phones and mini eight bank. */\n.lf-entry,.lf-entry.compact {\n background:transparent!important;border:0!important;box-shadow:none!important;\n display:flex;align-items:baseline;justify-content:center;gap:3px;\n width:100%;max-width:112px;min-width:0;height:30px;padding:0;margin:2px 0 10px;\n border-radius:0!important;\n}\n.lf-entry .lf-note{display:none!important}\n.lf-entry input,.lf-entry.compact input {\n border:0!important;border-radius:0!important;box-shadow:none!important;\n background:transparent!important;text-align:right;color:#ffe8bd!important;\n font-size:18px;line-height:26px;height:29px;padding:0!important;\n width:66px;max-width:calc(100% - 22px);font-weight:1000;\n}\n.lf-entry input:disabled,.lf-entry.compact input:disabled{-webkit-text-fill-color:#ffe8bd!important;opacity:1}\n.lf-entry input:focus-visible{outline:1px solid #ffdb74;outline-offset:1px;background:#191020!important}\n.lf-entry .lf-unit,.lf-entry.compact .lf-unit{\n background:transparent!important;border:0!important;color:#f9bc84!important;\n font-size:11px;min-width:0;height:auto;padding:0!important;line-height:26px;\n}\n.lf-entry.compact{max-width:100%;height:24px;margin:3px 0 6px;gap:1px}\n.lf-entry.compact input{font-size:12px;line-height:22px;height:23px;width:calc(100% - 11px);max-width:none}\n.lf-entry.compact .lf-unit{font-size:9px;line-height:22px;color:#ffdc70!important}\n/* Straight, neatly cut top. Bottom-left is the ONLY curved endpoint.\n   No top horizontal bar, no stepped or extended bottom tail. */\n.lf-fader .lf-crail{\n border-top:0!important;border-bottom:0!important;\n border-left:10px solid var(--lf-frame)!important;\n width:23px!important;\n border-radius:0 0 0 20px!important;\n filter:none!important;\n}\n.lf-fader.compact .lf-crail{\n border-top:0!important;border-bottom:0!important;\n border-left-width:8px!important;width:16px!important;\n border-radius:0 0 0 14px!important;\n}\n.lf-fader.horizontal .lf-crail{border-top:0!important;border-bottom:0!important;width:auto!important}\n.lf-monitor{padding-top:5px}\n.lf-monitor-head{min-height:25px}\n.lf-bank-cell{gap:2px}\n@container lcars (max-width:710px){\n .lf-fader.compact .lf-crail{border-left-width:5px!important;width:11px!important;border-radius:0 0 0 10px!important}\n .lf-entry.compact{height:22px;max-width:100%;margin:2px 0 5px}\n .lf-entry.compact input{font-size:10px;height:21px;line-height:21px}\n .lf-entry.compact .lf-unit{font-size:8px;line-height:21px}\n}\n@container lcars (max-width:380px){\n .lf-entry.compact input{font-size:9px}\n .lf-entry.compact .lf-unit{font-size:7px}\n}\n";
NCC1337_V042_STYLES += "\n/* LCARS v0.3.8 \u2013 detail matched to the user's original reference.\n   ONE continuous square-cut rail at top, long lower-left elbow curling\n   smoothly right, subtle sectioned internal accent, OVAL white marker.\n   Full-size values positioned to the RIGHT of rail near its top, unboxed.\n   Compact bank uses identical geometry scaled down. */\n.lf-monitor{position:relative;overflow:visible;}\n.lf-instrument{width:128px;max-width:100%;position:relative;display:block;min-height:var(--lf-height);}\n.lf-instrument>.lf-entry:not(.compact){\n position:absolute!important;z-index:5;top:5px;left:55px;width:76px;max-width:none;\n margin:0!important;padding:0!important;height:25px;justify-content:flex-start!important;\n background:transparent!important;border:0!important;box-shadow:none!important;\n}\n.lf-instrument>.lf-entry:not(.compact) input{\n background:transparent!important;color:#ffe8be!important;text-align:left!important;\n width:56px;max-width:56px;font-size:16px;line-height:24px;height:25px;font-weight:1000;\n border:0!important;outline:none;box-shadow:none!important;padding:0!important;\n}\n.lf-instrument>.lf-entry:not(.compact) .lf-unit{font-size:10px;line-height:24px}\n.lf-instrument>.lf-fader{margin:0;}\n.lf-fader .lf-crail,.lf-fader.compact .lf-crail {\n border-top:0!important;border-bottom:0!important;border-radius:0!important;\n}\n/* Lower elbow has a longer continuous return, not an extra hard rectangle. */\n.lf-fader .lf-crail::after{\n content:\"\";position:absolute;pointer-events:none;box-sizing:border-box;\n left:-10px;bottom:-2px;width:42px;height:31px;\n border-left:10px solid var(--lf-frame);border-bottom:9px solid var(--lf-frame);\n border-bottom-left-radius:31px;border-bottom-right-radius:0;\n}\n/* Discreet internal color sections right beside the graduated gold ruler. */\n.lf-fader .lf-crail::before{\n content:\"\";position:absolute;pointer-events:none;box-sizing:border-box;\n left:10px;top:25px;bottom:34px;width:12px;opacity:1;border-radius:0!important;\n background:linear-gradient(to bottom,#dc7971 0% 15%,#130b17 15% 17%,#f1a36a 17% 32%,#130b17 32% 34%,#ffd38a 34% 50%,#130b17 50% 52%,#f1af74 52% 71%,#130b17 71% 73%,#d9797c 73% 91%,#ff9e6a 91% 100%);\n border-left:1px solid #573144;border-right:1px solid #6d3b37;\n box-shadow:inset 0 0 2px #0005;\n}\n/* Replace old capsule with wider, softer, convincing oval. */\n.lf-fader .lf-thumb{\n width:44px!important;height:15px!important;left:25px!important;\n border-radius:50% / 50%!important;\n background:linear-gradient(180deg,#fffdf4 0%,#fffbed 39%,#e6dfd5 100%)!important;\n box-shadow:0 1px 5px #000c,0 0 0 1px #736657!important;\n}\n.lf-fader .lf-thumb::before{left:-10px;width:10px;height:3px}\n.lf-fader.compact .lf-crail::after{\n left:-8px;bottom:-1px;width:25px;height:21px;\n border-left-width:8px;border-bottom-width:6px;border-bottom-left-radius:22px;\n}\n.lf-fader.compact .lf-crail::before{\n left:6px;top:15px;bottom:23px;width:7px;\n border-left:0;border-right:1px solid #482649;\n background:linear-gradient(to bottom,#9261bd 0% 18%,#130b17 18% 21%,#d8a6ff 21% 38%,#130b17 38% 41%,#e7c0ff 41% 60%,#130b17 60% 63%,#a66dd2 63% 82%,#130b17 82% 85%,#8351a9 85%);\n}\n.lf-fader.compact .lf-thumb{\n left:40%!important;width:65%!important;max-width:32px!important;min-width:13px;\n height:12px!important;border-radius:50% / 50%!important;\n}\n.lf-fader.compact .lf-thumb::before{left:-8px;width:8px;height:2px}\n.lf-entry.compact{margin:1px 0 4px!important}\n.lf-monitor .lf-subcaption{margin-top:5px}\n@container lcars (max-width:710px){\n .lf-instrument{width:130px;max-width:100%;}\n .lf-instrument>.lf-entry:not(.compact){left:60px;top:4px}\n .lf-fader.compact .lf-crail::after{left:-5px;width:15px;height:14px;border-left-width:5px;border-bottom-width:4px;border-bottom-left-radius:15px}\n .lf-fader.compact .lf-crail::before{left:4px;top:12px;bottom:18px;width:5px}\n .lf-fader.compact .lf-thumb{height:10px!important;width:60%!important;left:42%!important}\n}\n";
NCC1337_V042_STYLES += "\n/* v0.3.8: NON-NEGOTIABLE EXACT SHAPE: SQUARE / STRAIGHT TOP; CURVE AT BOTTOM ONLY.\n   Structural rail is an SVG path. First commands M and V are exclusively straight;\n   the only curve command Q occurs 205 px LOWER at the lower elbow.\n   Removing the old CSS rail/pseudoelements eliminates accidental top curvature. */\n.lf-fader .lf-crail,.lf-fader .lf-crail::before,.lf-fader .lf-crail::after{display:none!important;content:none!important}\n.lf-fader .lf-rail-svg{display:block;position:absolute;top:0;left:0;width:72px;height:100%;overflow:visible;pointer-events:none}\n.lf-fader .lf-rail-svg .lf-rail-path{\n  fill:none;stroke:var(--lf-frame);stroke-width:10;\n  stroke-linecap:butt;stroke-linejoin:round;\n}\n.lf-rail-sections rect{stroke:none;rx:0;ry:0}\n.lf-sect-a{fill:#ef9f70}.lf-sect-b{fill:#db787c}.lf-sect-c{fill:#ffd299}\n.lf-fader.purple .lf-sect-a{fill:#af79d7}\n.lf-fader.purple .lf-sect-b{fill:#8454b0}\n.lf-fader.purple .lf-sect-c{fill:#dcaaff}\n/* Full-size: pointer is a true horizontal OVAL, not a pill with square sides. */\n.lf-fader .lf-thumb{width:44px!important;height:15px!important;left:25px!important;border-radius:50% / 50%!important}\n/* Mini channel rail is the SAME path, just scaled; no numbers and no extra caps. */\n.lf-fader.compact .lf-rail-svg{width:100%;height:100%}\n.lf-fader.compact .lf-rail-path{stroke-width:9}\n.lf-fader.compact .lf-thumb{left:41%!important;width:62%!important;max-width:32px!important;height:12px!important;min-width:12px;border-radius:50% / 50%!important}\n.lf-fader .lf-gauge{z-index:1}\n.lf-fader .lf-thumb{z-index:3}\n.lf-instrument>.lf-entry:not(.compact){top:3px;left:57px}\n.lf-fader .lf-rail-svg .lf-rail-path{vector-effect:non-scaling-stroke}\n@container lcars (max-width:710px){\n .lf-instrument>.lf-entry:not(.compact){top:3px;left:60px}\n .lf-fader.compact .lf-rail-svg{width:100%}\n .lf-fader.compact .lf-rail-path{stroke-width:6}\n .lf-fader.compact .lf-thumb{left:42%!important;width:60%!important;height:10px!important}\n}\n";
const LIGHTS = [
  ['KITCHEN 01','light.kitchen_wiz_rgbw_tunable_f36380'],
  ['KITCHEN 02','light.wiz_rgbw_tunable_f21cb7'],
  ['KITCHEN 03','light.kitchen_kitchen_3'],
  ['KITCHEN 04','light.kitchen_kitchen_4'],
  ['KITCHEN 05','light.kitchen_kitchen_5'],
  ['LIVING ROOM','light.wiz_rgbw_tunable_44e214'],
  ['BEDROOM','light.wiz_rgbw_tunable_f2ac9c']
];
const POWER = [
  ['MONITOR LEFT','switch.smart_power_strip_channel_1_socket'],
  ['MONITOR RIGHT','switch.smart_power_strip_channel_2_socket'],
  ['AUDIO GEAR','switch.smart_power_strip_channel_3_socket'],
  ['FAN','switch.living_room_sidefan_socket'],
  ['DJ TABLE','switch.living_room_dj_table_socket'],
  ['FLOOR LAMPS','switch.living_room_backfan_socket'],
  ['USB — KEEP ON','switch.smart_power_strip_usb_1']
];
/* Verified from the user's Home Assistant Developer Tools on 2026-11-24.
   Explicit YAML configuration still takes priority; these ids are a safe,
   narrow fallback for the NCC-1337 read-only MQTT telemetry only. */
const SENSORS = {
  main:['main_sensor','Main level (live)','sensor','sensor.ncc_1337_babyface_pro_main_level_live'],
  b:['speaker_b_sensor','Speaker B level (live)','sensor','sensor.ncc_1337_babyface_pro_speaker_b_level_live'],
  hp:['headphones_sensor','Headphones level (live)','sensor','sensor.ncc_1337_babyface_pro_headphones_level_live'],
  linked:['speaker_b_link_sensor','Speaker B link (live)','binary_sensor','binary_sensor.ncc_1337_babyface_pro_speaker_b_link_live'],
  selected:['speaker_b_selected_sensor','Speaker B selected (live)','binary_sensor','binary_sensor.ncc_1337_babyface_pro_speaker_b_selected_live'],
  last:['last_feedback_sensor','Last validated OSC feedback','sensor','sensor.ncc_1337_babyface_pro_last_validated_osc_feedback']
};
NCC1337_V042_STYLES += '\n/* v0.3.9 ONLY: independent horizontal scrolling for ten hardware-input strips. */\n.lf-bank-outer{min-width:0;overflow:hidden}\n.lf-bank-scroll-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 7px;color:#ead5ff;font-size:10px;font-weight:900;letter-spacing:.07em}\n.lf-bank-scroll-controls{display:flex;gap:4px}\n.lf-bank-scroll-controls button{border:0;background:#7447a8;color:#fff0be;border-radius:0 8px 8px 0;padding:5px 10px;font-size:13px;font-weight:900;min-width:34px;min-height:27px}\n.lf-bank-scroll-controls button:disabled{opacity:.3}\n.lf-bank-scroll{min-width:0;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:3px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:#9563c8 #1a1023;touch-action:pan-x pan-y;padding:0 0 8px}\n.lf-bank-scroll::-webkit-scrollbar{height:5px}\n.lf-bank-scroll::-webkit-scrollbar-thumb{background:#a673d7;border-radius:3px}\n.lf-bank-scroll::-webkit-scrollbar-track{background:#1c1225}\n.lf-bank-grid{display:grid!important;grid-template-columns:repeat(10,minmax(69px,1fr))!important;gap:7px!important;align-items:start;max-width:none!important;min-width:760px!important;width:100%!important;margin:0!important}\n.lf-bank-cell{scroll-snap-align:start;scroll-snap-stop:normal;min-width:0}\n.lf-bank-id{display:block;height:20px;white-space:normal;overflow-wrap:anywhere;font-size:9px;line-height:1.08;letter-spacing:0}\n.lf-bank-type{font-size:8px;font-weight:800;color:#9c87b5;line-height:1.1;min-height:10px}\n.lf-bank-cell:nth-child(4) .lf-bank-type{color:#ffda65}\n.lf-scroll-indicator{height:5px;margin:5px 0 9px;background:#23132d;position:relative;overflow:hidden}\n.lf-scroll-indicator-thumb{position:absolute;top:0;left:0;height:100%;width:100%;background:linear-gradient(90deg,#9965d9 0%,#d5abff 78%,#ffde66 100%);transition:width .16s ease,left .1s ease}\n@container lcars (max-width:710px){\n .lf-bank-scroll-tools{font-size:8px;letter-spacing:0}\n .lf-bank-scroll-controls button{padding:4px 8px;min-width:31px;min-height:25px}\n .lf-bank-scroll{padding-bottom:5px}\n .lf-bank-grid{grid-template-columns:repeat(10,68px)!important;width:max-content!important;min-width:0!important;gap:5px!important}\n .lf-fader.compact{width:100%!important;max-width:64px!important;--lf-height:155px}\n .lf-bank-id{font-size:8px;height:18px}\n .lf-bank-type{font-size:7px}\n}\n@container lcars (max-width:380px){\n .lf-bank-grid{grid-template-columns:repeat(10,65px)!important;gap:5px!important}\n .lf-fader.compact{--lf-height:148px}\n .lf-bank-id{font-size:8px}\n}\n';
NCC1337_V042_STYLES += '\n/* v0.4.0: hidden native scrollbar; mouse grab-to-pan, Android native touch swipe, keyboard support. */\n.lf-bank-scroll{scrollbar-width:none!important;-ms-overflow-style:none!important;cursor:grab!important;user-select:none!important;-webkit-user-select:none!important;touch-action:pan-y!important;scroll-snap-type:x proximity!important;padding-bottom:3px!important}\n.lf-bank-scroll::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}\n.lf-bank-scroll.dragging{cursor:grabbing!important;scroll-snap-type:none!important}\n.lf-bank-scroll *{user-select:none!important;-webkit-user-select:none!important}\n.lf-bank-scroll input{user-select:text!important;-webkit-user-select:text!important;cursor:text}\n.lf-scroll-indicator{display:none!important}\n.lf-bank-scroll-tools{margin:1px 0 8px;min-height:24px}\n.lf-bank-visible{color:#ffe07d;font-weight:900;font-size:10px;letter-spacing:.06em;white-space:nowrap}\n.lf-unmapped-value{height:23px;display:flex;align-items:center;justify-content:center;color:#af91c9;font-size:11px;font-weight:900;letter-spacing:.04em}\n.lf-bank-cell .lf-fader.no-value .lf-thumb{display:none!important}\n.lf-bank-cell .lf-fader.no-value{opacity:.67}\n.lf-bank-cell .lf-bank-type{margin-top:1px}\n.lf-bank-cell .lf-bank-id{margin-top:2px}\n.lf-bank-scroll:focus-visible{outline:2px solid #ffe07d;outline-offset:2px}\n@container lcars (max-width:710px){\n .lf-bank-scroll-tools{gap:7px;align-items:baseline;flex-wrap:wrap}\n .lf-bank-visible{font-size:9px}\n}\n';
NCC1337_V042_STYLES += '\n/* v0.4.1: horizontal input faders; natural vertical page scrolling, no nested horizontal pan. */\n.lf-hbank-frame{background:#100a17;border-left:11px solid #ae7ce1;border-radius:34px 0 0 0;padding:7px 10px 14px 12px;min-width:0}\n.lf-hbank-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 17px;padding:13px 5px 3px;min-width:0}\n.lf-hbank-row{min-width:0;padding:9px 10px 8px;background:#171020;border-left:4px solid #bb8eeb}\n.lf-hbank-rowhead{display:flex;align-items:center;gap:7px;margin-bottom:8px;min-width:0;color:#f4ddff;font-size:10px;letter-spacing:.04em;white-space:nowrap}\n.lf-hbank-rowhead strong{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.lf-hbank-rowhead small{color:#ddc269;font-size:8px}\n.lf-hbank-index{background:#ffdd61;padding:3px 5px;color:#211125;font-weight:1000;border-radius:0 8px 8px 0}\n.lf-hbank-meter{height:34px;position:relative;min-width:0;overflow:visible}\n.lf-hbank-rail{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}\n.lf-hbank-segments{position:absolute;left:5px;right:14px;top:7px;height:13px;display:grid;grid-template-columns:repeat(16,minmax(0,1fr));gap:2px;pointer-events:none}\n.lf-hbank-segments i{background:#624080;min-width:0;box-shadow:inset 0 0 0 1px #a779bd55}\n.lf-hbank-segments i.lit{background:#ffdd62;box-shadow:inset 0 0 0 1px #f9f1c6}\n.lf-hbank-handle{position:absolute;top:4px;width:24px;height:17px;border-radius:50%;background:linear-gradient(#fffef3,#e6e0d4);box-shadow:0 1px 4px #000b,0 0 0 1px #746c64;pointer-events:none}\n.lf-hbank-value{display:block;color:#e7c9ff;font-size:9px;font-weight:900;text-align:right;letter-spacing:.04em;margin-top:-1px}\n.lf-hbank-unmapped .lf-hbank-segments i{background:#4b345f;opacity:.55}\n@container lcars (max-width:810px){.lf-hbank-rows{grid-template-columns:1fr;gap:6px}.lf-hbank-row{padding:8px 9px}.lf-hbank-meter{height:30px}}\n@container lcars (max-width:420px){.lf-hbank-frame{padding-right:6px;padding-left:6px;border-left-width:7px;border-radius:22px 0 0 0}.lf-hbank-rows{padding:9px 1px 2px}.lf-hbank-rowhead{font-size:9px}.lf-hbank-segments{gap:1px}}\n';
NCC1337_V042_STYLES += "\n\n/* v0.4.2 — TEN vertically detailed LCARS faders: this is the SAME\n   lf-fader.compact renderer/rail SVG used by the Master. Never add a top\n   curve: SVG path is M14 2 V207 Q14 231 38 231 H51. */\n.lf-vbank{--bank-yellow:#f8d650;--bank-blue:#5eaff1;--bank-purple:#aa7ce3;background:#08050e}\n.lf-vbank-frame{background:#100a19;border-left:9px solid #a17bd7;border-bottom:5px solid #a17bd7;border-radius:28px 0 0 0;padding:0 9px 10px 9px;min-width:0}\n.lf-vbank-header{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:32px;background:#f8d650;color:#160c1c;font-size:10px;letter-spacing:.08em;font-weight:1000;padding:7px 12px;white-space:normal}\n.lf-vbank-header b{font-size:9px;letter-spacing:0;color:#0c0920;background:#96baf4;padding:4px 7px;border-radius:0 8px 8px 0}\n.lf-vbank-trim{height:6px;display:grid;grid-template-columns:1.6fr .7fr 1fr;gap:5px;margin:5px 0 14px}\n.lf-vbank-trim i:nth-child(1){background:#aa7ce3}.lf-vbank-trim i:nth-child(2){background:#5eaff1}.lf-vbank-trim i:nth-child(3){background:#f8d650;border-radius:0 10px 10px 0}\n.lf-vbank-grid{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));align-items:start;gap:6px;min-width:0}\n.lf-vbank-channel{min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 1px 8px;background:#120b1d;border-top:3px solid #9c76d8;position:relative}\n.lf-vbank-channel.blue-accent{border-top-color:#64b7ed;background:#0e1221}\n.lf-vbank-channel.stereo{border-top-color:#f8d650}\n.lf-vbank-number{font-size:11px;font-weight:1000;letter-spacing:.05em;line-height:1;color:#0e0817;background:#f8d650;padding:5px 8px;border-radius:0 8px 8px 0}\n.lf-vbank-channel.blue-accent .lf-vbank-number{background:#79b9ee}\n.lf-vbank-level{font-size:10px;font-weight:1000;color:#d9bcff;height:15px;white-space:nowrap;font-variant-numeric:tabular-nums}\n.lf-vbank-fader{width:100%;display:flex;justify-content:center;min-height:205px;align-items:flex-start}\n.lf-vbank-fader .lf-fader.compact{--lf-height:204px!important;max-width:65px!important;width:100%!important;min-width:0;margin:0!important}\n.lf-vbank-fader .lf-fader.compact .lf-rail-svg{width:100%!important;height:100%!important}\n.lf-vbank-fader .lf-fader.compact .lf-rail-path{stroke:var(--lf-frame)!important;stroke-width:7!important;vector-effect:non-scaling-stroke;stroke-linecap:butt!important}\n.lf-vbank-fader .lf-fader.bank-triad{--lf-frame:#ac82e9;--lf-tick:#ffdc56;--lf-scale:#accdfd}\n.lf-vbank-channel.blue-accent .lf-fader.bank-triad{--lf-frame:#69a8ed;--lf-tick:#ffe072}\n.lf-vbank .lf-fader.bank-triad .lf-sect-a{fill:#9b65d3!important}\n.lf-vbank .lf-fader.bank-triad .lf-sect-b{fill:#3a73d2!important}\n.lf-vbank .lf-fader.bank-triad .lf-sect-c{fill:#85d4f6!important}\n.lf-vbank .lf-fader.bank-triad .lf-gauge{background:repeating-linear-gradient(to bottom,#ffe06a 0px,#ffe06a 3px,#160b26 3px,#160b26 8px)!important;border-left:1px solid #5d368d!important;border-right:1px solid #5d368d!important;box-shadow:0 0 0 1px #100c1b}\n.lf-vbank .lf-fader.bank-triad .lf-thumb{background:linear-gradient(180deg,#fffef3,#fffbe8 48%,#d4ebfc)!important;border:1px solid #fff0bd!important;box-shadow:0 1px 4px #000,0 0 0 1px #687d9c}\n.lf-vbank .lf-fader.bank-triad.no-value .lf-thumb{display:none!important}\n.lf-vbank .lf-fader.bank-triad.no-value{opacity:.82}\n.lf-vbank-name{color:#e0c9fa;font-size:9px;line-height:1.1;font-weight:900;text-align:center;min-height:22px;width:100%;overflow-wrap:anywhere;letter-spacing:0}\n.lf-vbank-kind{color:#8dbbf2;font-size:8px;font-weight:900;text-align:center;min-height:11px;letter-spacing:.05em}\n.lf-vbank-channel.stereo .lf-vbank-kind{color:#ffdd67}\n.lf-vbank-footer{height:6px;display:grid;grid-template-columns:2fr .7fr .8fr;gap:5px;margin-top:8px}\n.lf-vbank-footer i:nth-child(1){background:#9671d1}.lf-vbank-footer i:nth-child(2){background:#79baf1}.lf-vbank-footer i:nth-child(3){background:#f8d650;border-radius:0 12px 12px 0}\n.lf-vbank-note{background:#130e19;color:#c5abc9;font-size:10px;line-height:1.5;border-left:5px solid #71b2ec;padding:9px 11px;margin-top:8px}\n/* Match the existing project layout: wrap rather than squeeze or use a broken drag region. */\n@container lcars (max-width:1160px){.lf-vbank-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.lf-vbank-fader{min-height:180px}.lf-vbank-fader .lf-fader.compact{--lf-height:180px!important}.lf-vbank-name{font-size:10px;min-height:12px}}\n@container lcars (max-width:710px){.lf-vbank-frame{border-left-width:6px;padding:0 5px 7px;border-radius:18px 0 0 0}.lf-vbank-header{font-size:8px;padding:6px}.lf-vbank-header b{font-size:7px;padding:3px}.lf-vbank-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}.lf-vbank-channel{padding:4px 0 7px}.lf-vbank-number{font-size:9px;padding:4px 6px}.lf-vbank-level{font-size:8px;height:12px}.lf-vbank-fader{min-height:157px}.lf-vbank-fader .lf-fader.compact{--lf-height:157px!important}.lf-vbank-name{font-size:8px;min-height:22px}.lf-vbank-kind{font-size:7px}.lf-vbank-note{font-size:9px}}\n@container lcars (max-width:375px){.lf-vbank-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:3px}.lf-vbank-fader{min-height:154px}.lf-vbank-fader .lf-fader.compact{--lf-height:154px!important}.lf-vbank-name{font-size:8px}}\n\n";
const PANES=[['overview','OVERVIEW','OV','COMMAND 01'],['audio','AUDIO','AU','READ-ONLY'],['studio','STUDIO','ST','POWER BUS'],['lighting','LIGHTING','LT','7 CIRCUITS'],['av','AV / TV','AV','MEDIA CONTROL']];
const SAMPLES = {main:'-35.5',b:'-23.5',hp:'0.0',linked:'on',selected:'on',last:'demo'};
const demoSwitches = {
  'switch.smart_power_strip_channel_1_socket':'on',
  'switch.smart_power_strip_channel_2_socket':'on',
  'switch.smart_power_strip_channel_3_socket':'on',
  'switch.living_room_sidefan_socket':'on',
  'switch.living_room_dj_table_socket':'off',
  'switch.living_room_backfan_socket':'on',
  'switch.smart_power_strip_usb_1':'on',
  'light.kitchen_wiz_rgbw_tunable_f36380':'on',
  'light.wiz_rgbw_tunable_f21cb7':'on',
  'light.kitchen_kitchen_3':'off',
  'light.kitchen_kitchen_4':'on',
  'light.kitchen_kitchen_5':'off',
  'light.wiz_rgbw_tunable_44e214':'on',
  'light.wiz_rgbw_tunable_f2ac9c':'off',
  'media_player.living_room_lgtv':'on'
};
const esc = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MIXER_STYLES = `
  .lf-vbank-fader { position: relative }
  .mixer-pick { position:absolute; inset:0; width:100%; border:0; background:transparent; border-radius:0; box-shadow:inset 0 0 0 1px #ffe06a60 }
  .mixer-pick:hover { box-shadow:inset 0 0 0 1px #ffe06a }
  .mixer-pick[aria-pressed=true] { box-shadow:inset 0 0 0 2px #ffe06a }
  .mixer-command { margin-top:8px; padding:9px 11px; background:#130e19; border-left:5px solid #71b2ec }
  .mixer-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:12px; color:#e0c9fa }
  .mixer-actions input[type=password] { background:#0d0815; color:#f6e7d0; border:1px solid #8566b1; min-width:0; max-width:100%; padding:5px }
  .mixer-actions input[type=range] { accent-color:#ffe06a; max-width:100%; margin:0 }
  .mixer-actions button { border:0; padding:6px 10px; border-radius:0 10px 10px 0; background:#ac82e9; color:#0a070d; font-weight:900 }
  .mixer-actions .mixer-apply { background:#ffe06a }
  .mixer-status { margin:5px 0 0; color:#d9bcff; font-size:11px; line-height:1.4 }
`;

const MIXER_REASONS = {
  unauthorized:'Access token rejected.',
  authorization_expired:'The gateway access window expired. Obtain a current access token before reconnecting.',
  stale_packet_feedback:'OSC receiver feedback is stale. Refresh TotalMix feedback before staging.',
  stale_target_feedback:'DX100 PHONES feedback is stale. Refresh the target before staging.',
  stale_command_basis:'The staged feedback expired. Stage a new adjustment from the latest feedback.',
  bridge_disconnected:'The bridge state is unavailable.',
  invalid_bridge_state:'The bridge snapshot is incomplete or invalid.',
  invalid_output_or_channel_identity:'DX100 or the PHONES output identity does not match.',
  fader_outside_safe_range:'DX100 PHONES is off or outside the writable range.',
  unresolved_write_hold:'Write access is held after an unresolved attempt. Inspect the observed fader and the gateway audit.',
  write_interlock_unavailable:'The write safety marker is unavailable. Command access is held.',
  audit_unavailable:'Command audit unavailable.',
  session_or_mapping_changed:'Receiver session or routing changed. Stage a new adjustment.',
  mapping_unapproved:'Channel routing changed. Command access requires a reviewed mapping.',
  unexpected_fader_drift:'The observed fader moved. Stage a new adjustment.',
  unsafe_encoded_level:'The prepared level would exceed the safe decrease for current feedback.',
  unsafe_target_level:'The requested level is outside the downward-only range.',
  receiver_owner_changed:'The OSC receiver owner changed.',
  receiver_owner_unverified:'The OSC receiver owner could not be verified.',
  acknowledgment_timeout:'No matching TotalMix feedback arrived.',
  unexpected_echo_level:'TotalMix returned a different level.',
  client_disconnected:'The connection closed.',
  busy:'Another command is in progress.',
  rate_limited:'Wait before staging another adjustment.',
  approval_required:'No operator approval is armed. Arm one at the gateway console, then enter its code.',
  approval_invalid:'The approval code did not match. Check the gateway console.',
  approval_revoked:'Too many wrong approval codes. The approval was revoked; arm a new one at the gateway console.',
  approval_expired:'The approval expired. Arm a new one at the gateway console.',
  approval_basis_mismatch:'The approval was used, but the fader, session or step no longer matches what was approved. Arm a new approval.',
  dispatch_budget_spent:'This gateway process has used its dispatch allowance. Command access stays closed until a separately reviewed restart.',
  target_not_settled:'The DX100 PHONES fader was moving. Nothing was sent. Arm a new approval once it is still.',
  confirmation_expired_or_disconnected:'The confirmation window ended before a steady matching level was observed.'
};
const APPROVAL_CODE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{10}$/;

class NccMixerLink {
  constructor(render) {
    this.render = render;
    this.generation = 0;
    this.message = '';
  }

  configure(value, simulation) {
    let endpoint = null;
    if (typeof value === 'string' && value) {
      const url = new URL(value);
      const localDemo = simulation && url.protocol === 'http:' &&
        url.hostname === '127.0.0.1' && url.origin === window.location.origin;
      if (url.origin !== value || (!localDemo && url.protocol !== 'https:')) {
        throw new Error('Configure an exact HTTPS gateway origin.');
      }
      endpoint = url.origin;
    }
    if (endpoint !== this.endpoint || simulation !== this.simulation) this.disconnect(false);
    this.endpoint = endpoint;
    this.simulation = simulation;
    this.mode = simulation ? 'simulation' : 'windows';
  }

  disconnect(render = true) {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    this.token = null;
    this.snapshot = null;
    this.draft = null;
    this.approval = '';
    this.loading = false;
    this.message = this.pending
      ? 'Unconfirmed. The request may have reached the gateway. Inspect observed feedback before another attempt.'
      : '';
    this.pending = false;
    if (render) this.render();
  }

  async request(path, body) {
    const response = await fetch(this.endpoint + path, {
      method:body ? 'POST' : 'GET',
      cache:'no-store', credentials:'omit', redirect:'error', referrerPolicy:'no-referrer',
      signal:AbortSignal.any([this.controller.signal, AbortSignal.timeout(body ? 17000 : 3500)]),
      headers:body
        ? {Authorization:'Bearer '+this.token, 'Content-Type':'application/json'}
        : {Authorization:'Bearer '+this.token},
      body:body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(MIXER_REASONS[payload.reason] || 'Gateway rejected the request.');
      error.rejected = payload.status === 'rejected';
      throw error;
    }
    return payload;
  }

  async connect(token) {
    if (!this.endpoint || this.pending) return;
    this.disconnect(false);
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
      this.message = 'Enter the temporary gateway access token.';
      this.render();
      return;
    }
    this.token = token;
    this.controller = new AbortController();
    await this.refresh();
  }

  reading(snapshot = this.snapshot) {
    const channel = snapshot?.inputs.find(item => item.index === 11);
    if (channel?.name !== 'DX100' || channel.stereo !== false || channel.stereo_partner_index !== null ||
        snapshot.destinations?.PHONES?.index !== 2 || snapshot.destinations.PHONES.name !== 'BFP HP') return null;
    return channel.sends?.PHONES;
  }

  async refresh() {
    if (!this.token || this.loading || this.pending) return;
    const generation = this.generation;
    this.loading = true;
    try {
      const snapshot = await this.request('/v1/state');
      if (generation !== this.generation || this.pending) return;
      if (snapshot.mode !== this.mode || typeof snapshot.session !== 'string' ||
          !/^[0-9a-f]{64}$/.test(snapshot.mapping) || !Array.isArray(snapshot.inputs) ||
          snapshot.inputs.length !== 10 || !snapshot.destinations) throw new Error('Invalid gateway snapshot.');
      const previous = this.snapshot;
      this.snapshot = snapshot;
      this.received = performance.now();
      if (this.draft) {
        const observed = this.reading();
        if (this.sameBasis(this.draft, observed)) return;
        this.draft = null;
        this.approval = '';
        this.message = 'The routing or observed level changed. Stage an adjustment from the new feedback.';
      } else if (!this.message || (previous && previous.command_block !== snapshot.command_block)) {
        this.message = MIXER_REASONS[snapshot.command_block] || '';
      }
      this.render();
    } catch (error) {
      if (generation !== this.generation || this.pending) return;
      this.disconnect(false);
      this.message = error.rejected ? error.message : 'Gateway connection lost. Reconnect to regain command access.';
      this.render();
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  sameBasis(draft, reading = this.reading()) {
    return reading?.writable === true && reading.state === 'OBSERVED' &&
      reading.dB === draft.expected_db && this.snapshot.session === draft.session &&
      this.snapshot.mapping === draft.mapping && performance.now() - draft.created < 15000;
  }

  canStage() {
    const reading = this.reading();
    return !this.pending && reading?.writable === true && reading.state === 'OBSERVED' &&
      Number.isFinite(reading.dB) && reading.dB > -65 && typeof reading.seen === 'string' &&
      performance.now() - this.received < 5000;
  }

  stage() {
    if (!this.canStage()) return;
    const reading = this.reading();
    this.draft = {
      session:this.snapshot.session, mapping:this.snapshot.mapping,
      input:11, mix:'PHONES', expected_db:reading.dB, seen:reading.seen,
      target_db:reading.dB, created:performance.now()
    };
    this.message = '';
    this.render();
  }

  setDrop(drop) {
    if (!this.draft || !Number.isFinite(drop) || drop < 0 || drop > 1) return;
    this.draft.target_db = Math.max(-65, this.draft.expected_db - drop);
  }

  setApproval(value) {
    // Held in memory for one Apply only. Never stored, logged or put in a URL.
    this.approval = String(value ?? '').toUpperCase().replace(/[\s-]/g, '').slice(0, 10);
    return APPROVAL_CODE.test(this.approval);
  }

  canApply() {
    return Boolean(this.draft) && this.draft.target_db < this.draft.expected_db && APPROVAL_CODE.test(this.approval);
  }

  cancel() {
    this.draft = null;
    this.approval = '';
    this.render();
  }

  async apply() {
    if (this.pending || !this.draft || !this.canStage() || !this.sameBasis(this.draft) || !this.canApply()) return;
    const {created, ...selection} = this.draft;
    const command = {...selection, seen:this.reading().seen, id:crypto.randomUUID(), approval:this.approval};
    this.draft = null;
    this.approval = '';
    const generation = this.generation;
    this.pending = true;
    this.message = 'Waiting for target feedback…';
    this.render();
    try {
      const reply = await this.request('/v1/commands', command);
      command.approval = '';
      if (generation !== this.generation) return;
      if (reply.id !== command.id || reply.mode !== this.mode) throw new Error('Unexpected command response.');
      if (reply.status === 'observed_match' && reply.causality === 'not_proven' && Number.isFinite(reply.observed_db) &&
          Number.isFinite(Date.parse(reply.observed_at)) && reply.observed_db < command.expected_db &&
          Math.abs(reply.observed_db - command.target_db) <= 0.02) {
        this.message = (this.simulation ? 'Observed ' : 'TotalMix reported ') + reply.observed_db.toFixed(2) +
          ' dB after the send. This matches the request but does not prove the command caused it.';
      } else {
        this.message = 'Unconfirmed. ' + (MIXER_REASONS[reply.reason] || 'Inspect the observed fader before another attempt.');
      }
    } catch (error) {
      if (generation !== this.generation) return;
      if (error.rejected) {
        this.message = error.message;
      } else {
        this.disconnect(false);
        this.message = 'Unconfirmed. The connection closed before the outcome was known. Inspect feedback before another attempt.';
        this.render();
        return;
      }
    } finally {
      if (generation === this.generation) {
        this.pending = false;
        // Prevent staging from the pre-command snapshot while the outcome refreshes.
        this.snapshot = null;
        this.render();
        await this.refresh();
      }
    }
  }
}

class NCC1337LCARSV063Card extends HTMLElement {
  constructor(){
    super();
    this.attachShadow({mode:'open'});
    this._view='overview';this._submix='main';this._theme='classic';this._config={};this._hass=null;
    this._previewFaderValues={};this._bankScrollLeft=0;this._drag=null;
    this._styles=NCC1337_V042_STYLES+MIXER_STYLES;
    this._mixer=new NccMixerLink(()=>this.render());
    this.shadowRoot.addEventListener('click',e=>this.click(e));
    this.shadowRoot.addEventListener('change',e=>this.changeFader(e));
    this.shadowRoot.addEventListener('input',e=>this.stageDrop(e));
    this.shadowRoot.addEventListener('scroll',e=>{if(e.target.classList?.contains('lf-bank-scroll')){this._bankScrollLeft=e.target.scrollLeft;this.updateBankScrollUI();}},true);
    this.shadowRoot.addEventListener('pointerdown',e=>this.beginBankDrag(e));
    this.shadowRoot.addEventListener('pointermove',e=>this.moveBankDrag(e));
    this.shadowRoot.addEventListener('pointerup',e=>this.endBankDrag(e));
    this.shadowRoot.addEventListener('pointercancel',e=>this.endBankDrag(e));
    this.shadowRoot.addEventListener('keydown',e=>this.bankKeyboard(e));
  }
  setConfig(cfg){
    this._config={...cfg};
    this._mixer.configure(cfg.gateway_url,cfg.offline_gateway_demo===true);
    this.render();
  }
  set hass(h){
    this._hass=h;
    if (!this._drag?.active && !this.shadowRoot.activeElement?.matches('[data-mixer-token], [data-mixer-step], [data-mixer-approval]')) this.render();
  }
  getCardSize(){return 12;}
  static getStubConfig(){return {type:'custom:ncc1337-lcars-v063-card'};}
  connectedCallback(){
    this.render();
    this._interval=setInterval(()=>this._mixer.refresh(),2000);
  }
  disconnectedCallback(){
    clearInterval(this._interval);
    this._mixer.disconnect(false);
  }
  get demo(){return !this._hass;}
  sensor(which){
    if(this.demo)return {state:SAMPLES[which],available:true};
    const [config, friendly, domain, fallbackId]=SENSORS[which];
    const states=this._hass?.states||{};
    const explicit=String(this._config?.[config]||'').trim();
    const good=s=>s&&typeof s.state==='string'&&s.state.trim()!==''&&!['unknown','unavailable','none'].includes(s.state.toLowerCase());
    // 1) Existing user YAML mapping. 2) User-confirmed ID. 3) One unique
    // prefix-tolerant friendly-name match. Never substitute demo sensor values.
    for(const id of [explicit,fallbackId]){
      if(id && good(states[id]))return {state:states[id].state,available:true,entity_id:id};
    }
    const nameMatches=Object.entries(states).filter(([id,s])=>{
      if(!id.startsWith(domain+'.') || !good(s))return false;
      const name=String(s?.attributes?.friendly_name||'').toLowerCase();
      return name===friendly.toLowerCase() || name.endsWith(' '+friendly.toLowerCase());
    });
    if(nameMatches.length===1)return {state:nameMatches[0][1].state,available:true,entity_id:nameMatches[0][0]};
    return {state:'—',available:false,entity_id:explicit||fallbackId};
  }
  item(id){if(this.demo)return demoSwitches[id]||'unavailable';return this._hass?.states?.[id]?.state||'unavailable';}
  status(id){let s=this.item(id);let ok=s==='on'||s==='off';return `<span class="state ${ok?s:'unknown'}">${esc(ok?s.toUpperCase():s==='unavailable'?'UNAVAILABLE':s.toUpperCase())}</span>`;}
  formatDb(s){return s.available?esc(s.state)+' <span class="unit">dB</span>':'— <span class="unit">dB</span>';}
  /* One silhouette shared by FULL and COMPACT faders. Numeric fields are
     interactive ONLY in the standalone, sample-data preview. In HA they are
     disabled readouts of validated sensors; no audio-control commands exist. */
  entry({key,value,compact=false,illustrative=false,label=''}){
    const valid=value!==null && value!==undefined && value!=='' && Number.isFinite(Number(value));
    const shown=valid?(illustrative?String(Math.round(Number(value))):Number(value).toFixed(1)):'';
    const isEditable=this.demo && !this._mixer.endpoint;
    return `<label class="lf-entry ${compact?'compact':''}" aria-label="${esc(label)} numeric ${isEditable?'demo position':'feedback'}">
        
        <input type="number" inputmode="decimal" data-fader-key="${esc(key)}" aria-label="${esc(label)} ${isEditable?'visual demo value only':'read-only live value'}" min="${illustrative?0:-70}" max="${illustrative?100:0}" step="${illustrative?1:0.1}" value="${esc(shown)}" ${isEditable?'':'disabled'} title="${isEditable?'Edit this demonstration pointer only; no TotalMix commands':'Live feedback; hardware writes disabled'}">
        <span class="lf-unit">${illustrative?'%':'dB'}</span></label>`;
  }
  currentPreviewValue(key,source){
    if(!this.demo || !Object.hasOwn(this._previewFaderValues,key)) return source;
    return this._previewFaderValues[key];
  }
  changeFader(e){
    const input=e.target.closest('input[data-fader-key]');
    if(!input || !this.demo || input.disabled) return;
    const key=input.getAttribute('data-fader-key');
    if(!/^(main|hp|submix:(main|headphones|speakerb):(?:[0-9]))$/.test(key)) return;
    if(input.value.trim()==='') {this.render();return;}
    const n=Number(input.value);if(!Number.isFinite(n)) {this.render();return;}
    const illustrative=key.startsWith('submix:');
    const minimum=illustrative?0:-70,maximum=illustrative?100:0;
    const bounded=Math.max(minimum,Math.min(maximum,n));
    this._previewFaderValues[key]=illustrative?Math.round(bounded):Math.round(bounded*10)/10;
    this.render();
  }
  lcarsFader({label, value, variant='orange', compact=false, orientation='vertical', illustrative=false}){
    // TRULY STRAIGHT TOP: SVG rail path starts with a vertical line; only the bottom bends; oval thumb.
    // Marker positions are purely illustrative; no input / OSC binding.
    const numeric=Number(value);
    const valid=value!==null && value!==undefined && value!=='' && Number.isFinite(numeric);
    const normalized=valid ? (illustrative?1-Math.max(0,Math.min(100,numeric))/100:Math.max(0,Math.min(1,-numeric/70))) : 0.5;
    const position=(8+normalized*84).toFixed(2)+'%';
    const aria=valid?(illustrative?`${numeric}% illustration`: `${numeric} dB read-only value`):'Unavailable';
    return `<div class="lf-fader ${esc(variant)} ${compact?'compact':''} ${esc(orientation)} ${valid?'':'no-value'}" data-readonly="true" style="--lf-position:${position}" role="img" aria-label="${esc(label)} — ${esc(aria)}; no audio writes">
      <div class="lf-face">
        ${compact?'':`<div class="lf-numbers" aria-hidden="true">${['000','010','020','030','040','050','060','070'].map(n=>`<span>${n}</span>`).join('')}</div>`}
        <div class="lf-housing" aria-hidden="true">
          <svg class="lf-rail-svg" viewBox="0 0 72 236" preserveAspectRatio="none" focusable="false" aria-hidden="true">
            <path class="lf-rail-path" d="M 14 2 V 207 Q 14 231 38 231 H 51"/>
            <g class="lf-rail-sections">
              <rect x="24" y="22" width="10" height="33" class="lf-sect-a"/>
              <rect x="24" y="58" width="10" height="31" class="lf-sect-b"/>
              <rect x="24" y="92" width="10" height="31" class="lf-sect-c"/>
              <rect x="24" y="126" width="10" height="31" class="lf-sect-b"/>
              <rect x="24" y="160" width="10" height="48" class="lf-sect-a"/>
            </g>
          </svg>
          <div class="lf-gauge"></div><div class="lf-thumb"></div>
        </div>
      </div>
    </div>`;
  }
  monitorRack(){
    const main=this.sensor('main'),hp=this.sensor('hp'),b=this.sensor('b'),link=this.sensor('linked'),sel=this.sensor('selected');
    const mainValue=this.currentPreviewValue('main',main.available?main.state:null);
    const hpValue=this.currentPreviewValue('hp',hp.available?hp.state:null);
    const mainReadout={state:String(mainValue),available:mainValue!==null};
    return `<div class="lf-rack">
      <div class="lf-readout"><div class="kicker">Speaker A / MAIN output</div><div class="big-number">${this.formatDb(mainReadout)}</div><div class="speaker-name">MASTER MONITOR ${this.demo?'· SAMPLE DATA':''}</div>
        <div class="lf-master-note"><b>REMOTE LIMIT −14 dB</b> · PLANNED ONLY, NOT ENFORCED.<br>Numeric edits in this offline demo move only the visual pointer. No OSC sends.</div>
        <div class="lf-output-status"><div><span>SPEAKER B · LINKED TRIM</span><strong>${b.available?esc(b.state)+' dB':'—'}</strong></div><div><span>LINK / SELECT</span><strong>${link.available?esc(link.state.toUpperCase()):'—'} / ${sel.available?esc(sel.state.toUpperCase()):'—'}</strong></div></div>
      </div>
      <div class="lf-monitor"><div class="lf-monitor-head">MASTER / 01</div><div class="lf-instrument">${this.entry({key:'main',value:mainValue,label:'Master Speaker A'})}${this.lcarsFader({label:'Speaker A master',value:mainValue,variant:'orange'})}</div><div class="lf-subcaption">000–070 SCALE · READ ONLY</div></div>
      <div class="lf-monitor"><div class="lf-monitor-head">PHONES / 02</div><div class="lf-instrument">${this.entry({key:'hp',value:hpValue,label:'Headphones'})}${this.lcarsFader({label:'Headphones',value:hpValue,variant:'orange'})}</div><div class="lf-subcaption">NO VOLUME LIMIT</div></div>
    </div>`;
  }
  readGlobalInputBank(){
    if(this.demo) return null;
    const id=String(this._config?.global_osc_input_entity||'sensor.ncc_1337_babyface_pro_global_osc_input_sends_read_only').trim();
    const state=this._hass?.states?.[id];
    const attr=state?.attributes;
    // Fail closed: no examples or cached values for offline/unmapped/stale entities.
    if(!state || String(state.state).toUpperCase()!=='READY' || attr?.read_only!==true || attr?.snapshot_status!=='COMPLETE') return null;
    if(!Array.isArray(attr.inputs)||attr.inputs.length!==10||!attr.submixes) return null;
    const ids=new Set();
    const outNames=['MAIN','PHONES','MON2'];
    for(const key of outNames){const ix=attr.submixes[key];if(!Number.isInteger(ix)||ix<0||ix>255)return null;}
    for(const input of attr.inputs){
      if(!Number.isInteger(input?.index)||input.index<0||ids.has(input.index)||!String(input?.name||'').trim())return null;
      ids.add(input.index);
      if(typeof input.stereo!=='boolean')return null;
      if(input.stereo && input.stereo_partner_index!==input.index+1)return null;
      for(const key of outNames){
        const send=input.sends?.[key];
        if(!send || !['OFF','OBSERVED'].includes(send.state))return null;
        if(typeof send.dB!=='number'||!Number.isFinite(send.dB)||send.dB< -300.01||send.dB>12.01)return null;
      }
    }
    return [...attr.inputs].sort((a,b)=>a.index-b.index);
  }
  mixerPanel(outKey){
    const mixer=this._mixer;
    if (!mixer.endpoint) return '';
    const draft=outKey==='PHONES' ? mixer.draft : null;
    const armed=mixer.snapshot?.approval?.armed===true;
    const status=mixer.message || (draft ? (armed ? 'Enter the approval code shown on the gateway console. The fader stays at its observed level until feedback arrives.' :
      'No approval is armed. Type arm at the gateway console, then enter the code here.') :
      mixer.snapshot ? 'Select the DX100 fader in PHONES to stage a decrease.' : 'Connect to enable command access.');
    return `<section class="mixer-command" aria-label="DX100 command controls">
      <div class="mixer-actions">
        ${mixer.token
          ? '<button type="button" data-mixer-disconnect>Disconnect</button>'
          : '<label>Access token <input type="password" data-mixer-token autocomplete="off" spellcheck="false"></label><button type="button" data-mixer-connect>Connect</button>'}
        ${draft ? `<label>Decrease <input type="range" data-mixer-step min="0" max="1" step="0.05" value="${esc(Math.min(1,draft.expected_db-draft.target_db).toFixed(2))}" aria-label="DX100 PHONES decrease in dB"></label>
          <output data-mixer-proposed>${esc(draft.target_db.toFixed(2))} dB proposed</output>
          <label>Approval code <input type="password" data-mixer-approval autocomplete="off" spellcheck="false" maxlength="12" inputmode="text" placeholder="${mixer.approval?'Code entered':''}" aria-label="Single-use approval code from the gateway console"></label>
          <button type="button" class="mixer-apply" data-mixer-apply ${mixer.canApply()?'':'disabled'}>Apply once</button>
          <button type="button" data-mixer-cancel>Cancel</button>` : ''}
      </div>
      <p class="mixer-status" role="status" aria-live="polite">${mixer.simulation?'Simulation · ':''}${esc(status)}</p>
    </section>`;
  }

  stageDrop(event){
    if (event.target.matches('[data-mixer-approval]')) {
      this._mixer.setApproval(event.target.value);
      const apply=this.shadowRoot.querySelector('[data-mixer-apply]');
      if (apply) apply.disabled=!this._mixer.canApply();
      return;
    }
    if (!event.target.matches('[data-mixer-step]')) return;
    this._mixer.setDrop(event.target.valueAsNumber);
    const draft=this._mixer.draft;
    if (!draft) return;
    this.shadowRoot.querySelector('[data-mixer-proposed]').textContent=draft.target_db.toFixed(2)+' dB proposed';
    this.shadowRoot.querySelector('[data-mixer-apply]').disabled=!this._mixer.canApply();
  }

  bank(){
    const visualDemo=this.demo && !this._mixer.endpoint;
    const demoInputs=[
      ['Mic Chain',false],['Digitech SV',false],['OB TEO5',true],['DMX 1 / DJ',true],
      ['DMX 3',false],['DMX 4',false],['LMDRUM',false],['PRO12ASB',false],
      ['ESQ1',false],['DX100',false]
    ];
    const liveInputs=this._mixer.snapshot?.inputs ?? this.readGlobalInputBank();
    const demos={main:[72,55,31,14,64,46,21,78,48,62],headphones:[65,35,50,22,80,10,55,43,71,27],speakerb:[23,65,42,82,44,71,13,59,38,68]};
    const values=demos[this._submix]||demos.main;
    const outKey={main:'MAIN',headphones:'PHONES',speakerb:'MON2'}[this._submix];
    const tabs=[['main','MAIN'],['headphones','PHONES'],['speakerb','MON 2']];
    const canEdit=outKey==='PHONES' && this._mixer.canStage();
    const shown=visualDemo?'DEMO':liveInputs?(canEdit?'DX100 CONTROL':'10 INPUTS · READ ONLY'):'UNAVAILABLE';
    return `<div class="submix-alt-palette lf-vbank">
      <div class="bank-title"><span>10 / HARDWARE INPUTS <strong>· DETAILED VERTICAL LCARS</strong></span><span>${shown}</span></div>
      <div class="bank-tabs" role="group" aria-label="Destination selection">${tabs.map(([id,label])=>`<button type="button" data-submix="${id}" aria-pressed="${id===this._submix?'true':'false'}" class="${id===this._submix?'active':''}">${label}</button>`).join('')}</div>
      <div class="lf-vbank-frame">
        <div class="lf-vbank-header"><span>LCARS // INPUT SEND MATRIX</span><b>${visualDemo?'10 INPUTS · SAMPLE POSITIONS':liveInputs?'10 VERIFIED INPUTS · SNAPSHOT':'NO VALID INPUT SNAPSHOT'}</b></div>
        <div class="lf-vbank-trim" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="lf-vbank-grid" role="group" aria-label="Ten detailed vertical LCARS input-send readouts">
          ${demoInputs.map(([fallbackName,fallbackStereo],i)=>{
            const input=liveInputs?.[i];
            const name=visualDemo?fallbackName:input?.name||fallbackName;
            const stereo=visualDemo?fallbackStereo:input?.stereo===true;
            const send=input?.sends?.[outKey];
            const raw=visualDemo?values[i]:send?.dB??null;
            const off=!visualDemo && send?.state==='OFF';
            const key='submix:'+this._submix+':'+i;
            const value=visualDemo?this.currentPreviewValue(key,raw):raw;
            const labelText=visualDemo?`${value}% SAMPLE`:!input?'UNAVAILABLE':off?'OFF':typeof value==='number'&&Number.isFinite(value)?`${value>=0?'+':''}${value.toFixed(1)} dB`:'UNMAPPED';
            const idText=visualDemo?String(i+1).padStart(2,'0'):input?String(input.index).padStart(2,'0'):'--';
            const edit=canEdit && input?.index===11 && send?.writable===true;
            return `<div class="lf-vbank-channel ${stereo?'stereo':''} ${[2,5,8].includes(i)?'blue-accent':''}" aria-label="${esc(name)} ${stereo?'stereo':'mono'}; ${esc(labelText)}">
              <div class="lf-vbank-number">${esc(idText)}</div>
              <div class="lf-vbank-level">${esc(labelText)}</div>
              <div class="lf-vbank-fader">
                ${this.lcarsFader({label:name+' '+outKey+' input send',value,variant:'bank-triad',compact:true,illustrative:visualDemo})}
                ${edit?`<button type="button" class="mixer-pick" data-mixer-stage aria-label="Stage a decrease for DX100 PHONES" aria-pressed="${Boolean(this._mixer.draft)}"></button>`:''}
              </div>
              <div class="lf-vbank-name" title="${esc(name)}">${esc(name.toUpperCase())}</div>
              <div class="lf-vbank-kind">${stereo?'STEREO L/R':'INPUT'}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="lf-vbank-footer" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>
      ${this.mixerPanel(outKey)}
      ${this._mixer.endpoint?'':`<div class="lf-vbank-note">${visualDemo?'Demonstration values only.':'Read-only TotalMix feedback. Values update when the bridge receives OSC.'}</div>`}
    </div>`;
  }
  updateBankScrollUI(){
    const area=this.shadowRoot.querySelector('.lf-bank-scroll');
    const label=this.shadowRoot.querySelector('.lf-bank-visible');
    if(!area||!label)return;
    const cells=[...area.querySelectorAll('.lf-bank-cell')];
    if(!cells.length)return;
    const scrollMax=Math.max(0,area.scrollWidth-area.clientWidth);
    if(scrollMax<=1){label.textContent='ALL 10 INPUTS';return;}
    const visibleLeft=area.scrollLeft+1;
    const visibleRight=area.scrollLeft+area.clientWidth-1;
    let first=-1,last=-1;
    cells.forEach((cell,i)=>{
      if(cell.offsetLeft+cell.offsetWidth>visibleLeft && cell.offsetLeft<visibleRight){if(first<0)first=i;last=i;}
    });
    if(first<0){label.textContent='DRAG TO SCROLL';return;}
    label.textContent=`INPUTS ${String(first+1).padStart(2,'0')}–${String(last+1).padStart(2,'0')} / 10`;
  }
  beginBankDrag(e){
    // One pointer-drag model for desktop and Android; pan-y preserves vertical page scrolling.
    if(!['mouse','pen','touch'].includes(e.pointerType))return;
    if(e.pointerType!=='touch' && e.button!==0)return;
    const area=e.target.closest?.('.lf-bank-scroll');
    if(!area||e.target.closest('input,button,select,textarea,a,[contenteditable="true"]'))return;
    if(area.scrollWidth<=area.clientWidth+1)return;
    this._drag={active:true,id:e.pointerId,area,startX:e.clientX,startLeft:area.scrollLeft,moved:false};
    area.classList.add('dragging');
    try{area.setPointerCapture(e.pointerId);}catch(_){ /* ignore unsupported pointer capture */ }
  }
  moveBankDrag(e){
    const d=this._drag;
    if(!d||!d.active||e.pointerId!==d.id)return;
    const delta=e.clientX-d.startX;
    if(Math.abs(delta)>3)d.moved=true;
    d.area.scrollLeft=d.startLeft-delta;
    this._bankScrollLeft=d.area.scrollLeft;
    if(d.moved && e.cancelable)e.preventDefault();
    this.updateBankScrollUI();
  }
  endBankDrag(e){
    const d=this._drag;
    if(!d||e.pointerId!==d.id)return;
    d.area.classList.remove('dragging');
    try{if(d.area.hasPointerCapture(e.pointerId))d.area.releasePointerCapture(e.pointerId);}catch(_){ }
    this._bankScrollLeft=d.area.scrollLeft;
    this._drag=null;
    this.updateBankScrollUI();
    // HA may have changed while dragging; refresh after drag ends.
    if(!this.demo)this.render();
  }
  bankKeyboard(e){
    const area=e.target.closest?.('.lf-bank-scroll');
    if(!area||!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();
    area.scrollBy({left:(e.key==='ArrowRight'?1:-1)*76,behavior:'smooth'});
  }
  feedback(){const s=this.sensor('last');if(this.demo)return {label:'DEMO DATA',age:'ILLUSTRATIVE / NOT LIVE',good:false};if(!s.available)return {label:'NO FEEDBACK',age:'ENTITY UNAVAILABLE',good:false};const ms=Date.parse(s.state);const age=(Date.now()-ms)/1000;if(!Number.isFinite(age)||age< -120)return {label:'CHECK TIMESTAMP',age:'INVALID DATE',good:false};if(age>60)return {label:'STALE',age:`LAST FEEDBACK ${Math.floor(age)}s AGO`,good:false};return {label:'OSC VALIDATED',age:`LAST FEEDBACK ${Math.max(0,Math.floor(age))}s AGO`,good:true};}
  audio(){const fb=this.feedback();return `<section class="module skin"><div class="band peach">RME / BABYFACE PRO <span class="serial">READ ONLY // TMFX-01</span></div><div class="inner">${this.monitorRack()}<div class="rail-group"><span></span><span></span><span></span></div><div class="kicker">${esc(fb.label)} <span style="color:var(--muted)">· ${esc(fb.age)}</span></div><div class="notice"><b>DISPLAY ONLY.</b> Master and Headphones show actual read-only HA levels when available; output and submix controls are not enabled.</div></div></section>`;}
  power(quick=false){const arr=quick?POWER.slice(0,5):POWER;return `<section class="module"><div class="band lav">STUDIO / POWER BUS <span class="serial">SAFETY INTERLOCKS</span></div><div class="matrix">${arr.map(([name,id])=>`<div class="matrix-row"><span>${esc(name)}</span>${this.status(id)}</div>`).join('')}</div></section>`;}
  lights(quick=false){const arr=quick?[LIGHTS[0],LIGHTS[5],LIGHTS[6]]:LIGHTS;const on=LIGHTS.slice(0,5).filter(x=>this.item(x[1])==='on').length;return `<section class="module"><div class="band coral">LIGHTING / ZONES <span class="serial">KITCHEN ${on} / 5 ON</span></div><div class="matrix">${arr.map(([name,id])=>`<div class="matrix-row"><span>${esc(name)}</span>${this.status(id)}</div>`).join('')}</div></section>`;}
  av(){return `<section class="module"><div class="band blue">AV / ENTERTAINMENT <span class="serial">IR / LG / RF</span></div><div class="matrix"><div class="matrix-row"><span>LIVING ROOM LG TV</span>${this.status(this._config.tv_entity||'media_player.living_room_lgtv')}</div><div class="matrix-row"><span>RM MINI 3</span>${this.demo?'<span class="state on">DEMO</span>':this.status(this._config.remote_entity||'remote.living_room_rm_mini_3')}</div><div class="matrix-row"><span>FAN POWER</span>${this.status('switch.living_room_sidefan_socket')}</div><div class="matrix-row"><span>HEADPHONES</span><span class="state">NO LIMIT</span></div></div></section>`;}
  quickStatus(){const kitchen=LIGHTS.slice(0,5).filter(x=>this.item(x[1])==='on').length;return `<section class="module"><div class="band lav">COMMAND / SUBSYSTEMS <span class="serial">NCC-1337</span></div><div class="inner"><div class="links"><div class="linkbit"><label>LIGHTING</label><strong>${kitchen}/5</strong></div><div class="linkbit"><label>STUDIO FAN</label><strong>${this.item('switch.living_room_sidefan_socket')==='on'?'ON':this.item('switch.living_room_sidefan_socket')==='off'?'OFF':'—'}</strong></div><div class="linkbit"><label>TV OUTPUT</label><strong>${this.item('media_player.living_room_lgtv')==='unavailable'?'—':'READY'}</strong></div><div class="linkbit"><label>OSC PATH</label><strong>${this.feedback().good?'VALID':this.demo?'DEMO':'CHECK'}</strong></div></div><div class="rail-group"><span></span><span></span><span></span></div><div class="info-copy">Dedicated <b>read-only monitoring</b> of lighting, power, TV and the Babyface Pro. Touch the side rails to inspect subsystems; service calls are disabled in this build.</div></div></section>`;}
  overview(){return `<div class="main-grid">${this.audio()}${this.quickStatus()}</div><div class="lower-grid"><section class="module"><div class="band orange">01 / POWER</div><div class="small-body">${POWER.slice(0,3).map(([n,id])=>`<div class="small-row"><span>${esc(n)}</span>${this.status(id)}</div>`).join('')}</div></section><section class="module"><div class="band lav">02 / LIGHTING</div><div class="small-body">${[LIGHTS[0],LIGHTS[5],LIGHTS[6]].map(([n,id])=>`<div class="small-row"><span>${esc(n)}</span>${this.status(id)}</div>`).join('')}</div></section><section class="module"><div class="band coral">03 / MEDIA</div><div class="small-body"><div class="small-row"><span>LG TELEVISION</span>${this.status('media_player.living_room_lgtv')}</div><div class="small-row"><span>FAN CIRCUIT</span>${this.status('switch.living_room_sidefan_socket')}</div><div class="info-copy" style="padding-top:8px">Connection geometry only. Existing TV and FAN controls remain unchanged.</div></div></section></div>`;}
  audioFocus(){return `<div class="focus-panel audio-focus-rebuilt">
    <section class="module"><div class="band peach">AUDIO / UNIVERSAL LCARS FADERS <span class="serial">NCC-1337 / 0.6.3 TEST</span></div>
      <div class="focus-stack"><div class="lf-orient-note">MASTER + HEADPHONES · NO TOP CURVE · BOTTOM ELBOW ONLY</div>
      ${this.monitorRack()}
      <div class="band submix-band" style="margin:10px 0 12px">SUBMIX / 10 INPUT FADERS <span class="serial">PURPLE · BLUE · YELLOW</span></div>
      ${this.bank()}
    </div></section>
    <aside class="focus-side"><h3>ROUTING / SAFETY</h3><div class="readonly-tag">DX100 → PHONES ONLY</div>
       <p>Stage up to a 1 dB decrease, enter the single-use code armed at the gateway console and choose <b>Apply once</b>. The fader reflects observed feedback. A matching later level is reported as observed, not as proof the command caused it. MAIN, MON 2, output masters, headphone master and software returns are read-only.</p>
       <p>Speaker A’s proposed <b>−14 dB ceiling is inactive.</b></p>
       <div class="flat-heading">CURRENT TELEMETRY</div><p>${esc(this.feedback().label)}<br>${esc(this.feedback().age)}</p>
    </aside></div>`;}
  matrixFocus(kind){let isLights=kind==='lighting',arr=isLights?LIGHTS:POWER;let title=isLights?'LIGHTING CONTROL / MONITOR':'STUDIO POWER / MONITOR';return `<div class="focus-panel"><section class="module"><div class="band ${isLights?'coral':'lav'}">${title}<span class="serial">MONITOR MODE</span></div><div class="focus-stack"><div class="matrix" style="padding:0">${arr.map(([n,id])=>`<div class="matrix-row"><span>${esc(n)}</span>${this.status(id)}</div>`).join('')}</div><div class="notice">This is a visual-only review. ON/OFF service buttons will be wired to your existing HA logic only after layout approval.</div></div></section><section class="focus-side"><h3>${isLights?'COLOR & ZONE BUS':'POWER INTERLOCKS'}</h3>${isLights?'<p>Five kitchen lights, living room, and bedroom are shown from the existing entity mapping. Your established lighting automations are not changed.</p><div class="flat-heading">PALETTE PREVIEW</div><div class="rail-group"><span></span><span></span><span></span></div>':'<p>Monitor power requires gear-on ordering. Gear must not be switched while monitors are active. USB power must remain protected.</p><p>Existing FAN outlet mapping is preserved.</p>'}<div class="flat-heading">INTERACTIONS</div><p>Navigation and theme selection only. No device commands in v0.3 preview.</p></section></div>`;}
  avFocus(){return `<div class="focus-panel"><div>${this.av()}<div class="rail-group"><span></span><span></span><span></span></div><section class="module"><div class="band orange">REMOTE / FUNCTIONS <span class="serial">LOCKED PREVIEW</span></div><div class="inner"><div class="action-buttons"><button disabled>TV POWER · NO ACTION</button><button disabled>VOLUME · NO ACTION</button><button disabled>INPUT · NO ACTION</button><button disabled>FAN · NO ACTION</button></div></div></section></div><section class="focus-side"><h3>MEDIA SYSTEM</h3><p>The production TV card and IR mappings stay unchanged. This preview only displays selected Home Assistant state information.</p><p>The fan is <b>FAN</b>, not HEAT. It is never automatically switched by this preview.</p></section></div>`;}
  render(){if(!this.isConnected && !this._hass)return;const currentScroll=this.shadowRoot.querySelector('.lf-bank-scroll');if(currentScroll)this._bankScrollLeft=currentScroll.scrollLeft;const fb=this.feedback();const nav=PANES.map(([id,label,mobile,subtitle])=>`<button type="button" data-page="${id}" class="${id===this._view?'active':''}" aria-label="${esc(label)}" aria-current="${id===this._view?'page':'false'}"><span class="name">${esc(label)}</span><span class="mobile">${mobile}</span><small>${esc(subtitle)}</small></button>`).join('');const page=this._view==='overview'?this.overview():this._view==='audio'?this.audioFocus():this._view==='lighting'?this.matrixFocus('lighting'):this._view==='studio'?this.matrixFocus('studio'):this.avFocus();this.shadowRoot.innerHTML=`<style>${this._styles}</style><ha-card><div class="lcars" data-theme="${this._theme}"><header class="head"><div class="head-elbow">NCC-1337</div><div class="head-right"><div class="head-top"><h1 class="head-title">LCARS / COMMAND</h1><div class="head-id">STUDIO<br>OPERATIONS</div></div><div class="head-sub"><span>Starship NCC-1337 · Main systems interface</span><span>DESIGN SYSTEM / 06</span></div><div class="header-bars"><i></i><i></i><i></i><i></i><i></i></div></div></header><div class="structure"><aside class="spine"><nav aria-label="LCARS sections">${nav}</nav><div class="spine-flex"></div><div class="spine-label">SYSTEM ACCESS / 1337</div></aside><main class="work"><div class="utility"><span class="sep"></span><strong>${this.demo?'STATIC VISUAL DEMO':'HOME ASSISTANT / READ ONLY'}</strong><span>· ${esc(fb.label)}</span><span class="time">LCARS / MIXER 0.6.3 TEST</span><button type="button" data-theme-toggle class="theme-switch" aria-label="Switch LCARS color theme">${this._theme==='classic'?'VECTOR BLUE':'CLASSIC LCARS'}</button></div>${page}<div class="footer-bars"><span></span><span></span><span></span><span></span><span></span></div><footer class="footer-note"><span>NCC-1337 / INTERACTIVE MIXER</span><span>GLOBAL OSC / CONTROLLER 2</span></footer></main></div></div></ha-card>`;const nextScroll=this.shadowRoot.querySelector('.lf-bank-scroll');if(nextScroll){nextScroll.scrollLeft=this._bankScrollLeft;this.updateBankScrollUI();}}
  click(e){
    const btn=e.target.closest('button');
    if(!btn)return;
    if(btn.hasAttribute('data-mixer-connect')){
      const input=this.shadowRoot.querySelector('[data-mixer-token]');
      const token=input.value.trim();
      input.value='';
      return this._mixer.connect(token);
    }
    if(btn.hasAttribute('data-mixer-disconnect'))return this._mixer.disconnect();
    if(btn.hasAttribute('data-mixer-cancel'))return this._mixer.cancel();
    if(btn.hasAttribute('data-mixer-stage') && this._submix==='headphones'){
      this._mixer.stage();
      this.shadowRoot.querySelector('[data-mixer-step]')?.focus();
      return;
    }
    if(btn.hasAttribute('data-mixer-apply')){
      const field=this.shadowRoot.querySelector('[data-mixer-approval]');
      if(field?.value){this._mixer.setApproval(field.value);field.value='';}
      if(e.isTrusted && !btn.disabled && this._submix==='headphones')return this._mixer.apply();
      return;
    }
    if(btn.hasAttribute('data-bank-step')){
      const area=this.shadowRoot.querySelector('.lf-bank-scroll');
      if(area){
        const step=Number(btn.getAttribute('data-bank-step'));
        area.scrollBy({left:step*area.clientWidth*.76,behavior:'smooth'});
      }
      return;
    }
    if(btn.hasAttribute('data-submix')){
      const id=btn.getAttribute('data-submix');
      if(['main','headphones','speakerb'].includes(id)){
        if(id!==this._submix)this._mixer.draft=null;
        this._submix=id;
        this.render();
      }
      return;
    }
    if(btn.hasAttribute('data-theme-toggle')){this._theme=this._theme==='classic'?'blue':'classic';this.render();return;}
    const page=btn.getAttribute('data-page');
    if(page&&PANES.some(x=>x[0]===page)){
      if(page!==this._view)this._mixer.draft=null;
      this._view=page;
      this.render();
    }
  }
}
if(!customElements.get('ncc1337-lcars-v063-card'))customElements.define('ncc1337-lcars-v063-card',NCC1337LCARSV063Card);
window.customCards=window.customCards||[];
if(!window.customCards.some(x=>x.type==='ncc1337-lcars-v063-card'))window.customCards.push({
  type:'ncc1337-lcars-v063-card',name:'NCC-1337 LCARS v0.6.3 Mixer (supervised test)',
  description:'Detailed hardware-input bank with optional authenticated DX100 PHONES control.'
});
})();