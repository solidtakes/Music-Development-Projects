"""Opt-in diagnostic adapter for DISPOSABLE copies of baseline/prototype only.
Inside the copied MF_SEQ constructor, after scheduling the first tick:
    from .runtime_probe import attach
    attach(self)
Put this file beside MF_SEQ.py in that disposable installation. No new timer,
thread, listener or MIDI message; counters flush via the existing tick to Log.txt.
Measures submitted MIDI calls, not USB delivery. detach(surface) restores methods.
"""
import collections,json,time

def attach(surface,window_seconds=10.):
    if hasattr(surface,'_mf_perf_probe'):return
    state={'methods':{},'counts':collections.Counter(),'last_values':{},'start':time.perf_counter(),
           'last_tick':None,'max_gap_ms':0.,'tick_ms':0.,'max_tick_ms':0.,'led_calls':0,'last_position':None}
    surface._mf_perf_probe=state
    for name in ('_read','_target','_led','_white_ring','_send_midi','_tick'):
        original=getattr(surface,name);state['methods'][name]=original
        def wrap(*args,_name=name,_original=original,**kwargs):
            if _name!='_tick':
                state['counts'][_name]+=1
                if _name=='_led':state['led_calls']+=1
                if _name=='_send_midi':
                    packet=tuple(args[0]);key=packet[:2]
                    if state['last_values'].get(key)==packet[2]:state['counts']['duplicate_submissions']+=1
                    state['last_values'][key]=packet[2]
                return _original(*args,**kwargs)
            now=time.perf_counter()
            if state['last_tick'] is not None:state['max_gap_ms']=max(state['max_gap_ms'],(now-state['last_tick'])*1000.)
            state['last_tick']=now;state['led_calls']=0
            try:return _original(*args,**kwargs)
            finally:
                elapsed=(time.perf_counter()-now)*1000.;state['tick_ms']+=elapsed
                state['max_tick_ms']=max(state['max_tick_ms'],elapsed);state['counts']['ticks']+=1
                state['counts']['full_render_passes']+=int(state['led_calls']>=16)
                position=(surface._page,surface._last_playhead)
                state['counts']['display_position_changes']+=int(position!=state['last_position']);state['last_position']=position
                end=time.perf_counter();duration=end-state['start']
                if duration>=window_seconds:
                    data=dict(state['counts']);data.update(seconds=duration,handler_ms_sum=state['tick_ms'],handler_ms_max=state['max_tick_ms'],tick_gap_ms_max=state['max_gap_ms'])
                    surface.log_message('MF SEQ PERF | '+json.dumps(data,sort_keys=True))
                    state['counts'].clear();state['start']=end;state['tick_ms']=0.;state['max_tick_ms']=0.;state['max_gap_ms']=0.
        setattr(surface,name,wrap)

def detach(surface):
    state=getattr(surface,'_mf_perf_probe',None)
    if state is None:return
    for name,method in state['methods'].items():setattr(surface,name,method)
    del surface._mf_perf_probe
