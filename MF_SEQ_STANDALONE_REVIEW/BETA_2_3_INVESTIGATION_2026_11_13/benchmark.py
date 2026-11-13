"""Deterministic 60s synthetic playback matrix; poll rate is an input assumption.
Usage: python benchmark.py output.json name:path [name:path...]
"""
import hashlib,json,math,platform,statistics,sys,time
from pathlib import Path
from harness import C,load,setup

def case(mod,bpm,bars,hz=10,seconds=60,origin=0.):
    s,clip,_=setup(mod,bars,origin);C.clear()
    previous={};duplicates=0;render_passes=0;led_attempts=0;ring_attempts=0
    real_led=s._led;real_ring=s._white_ring
    frame=[0,0]
    def led(*args):frame[0]+=1;return real_led(*args)
    def ring(*args):frame[1]+=1;return real_ring(*args)
    s._led=led;s._white_ring=ring
    observed=set();latencies=[];costs=[];windows=[];prev_counts={};prev_scans=0;last_midi=0
    last_key=None;page_changes=0;last_page=s._page
    for i in range(int(seconds*hz)):
        t=i/hz;beat=t*bpm/60.;clip.playing_position=origin+beat%(bars*4)
        frame[:]=[0,0];before=len(s.midi)
        start=time.perf_counter_ns();s.tick();costs.append((time.perf_counter_ns()-start)/1000.)
        render_passes+=int(frame[0]>=16);led_attempts+=frame[0];ring_attempts+=frame[1]
        page_changes+=int(s._page!=last_page);last_page=s._page
        for packet in s.midi[before:]:
            key=packet[:2];duplicates+=int(previous.get(key)==packet[2]);previous[key]=packet[2]
        key=math.floor(beat*4+1e-8)
        # Count model boundary observations, not unique physical LEDs across wraps.
        if s._last_playhead>=0 and s._page*16+s._last_playhead==key%(bars*16):
            if key not in observed:latencies.append((beat-key*.25)*60./bpm*1000.)
            observed.add(key)
        if (i+1)%int(10*hz)==0:
            now={k:C[k] for k in ('note_vectors','property_reads','midi','scheduled')}
            windows.append({k:now[k]-prev_counts.get(k,0) for k in now});prev_counts=now
    expected=math.floor(((int(seconds*hz)-1)/hz)*bpm/60*4+1e-8)+1
    return dict(bpm=bpm,bars=bars,poll_hz=hz,seconds=seconds,origin=origin,ticks=int(seconds*hz),
        property_reads=C['property_reads'],note_vector_reads=C['note_vectors'],
        midi_sends=len(s.midi),duplicate_sends=duplicates,full_render_passes=render_passes,
        led_call_attempts=led_attempts,ring_call_attempts=ring_attempts,page_changes=page_changes,
        expected_step_positions=expected,observed_step_positions=len(observed),missed_step_positions=expected-len(observed),
        observation_latency_ms_p50=statistics.median(latencies),observation_latency_ms_max=max(latencies),
        mock_tick_us_p50=statistics.median(costs),mock_tick_us_p95=sorted(costs)[int(len(costs)*.95)],
        max_pending_callbacks=C['max_pending'],windows_10s=windows)

if __name__=='__main__':
    report={'scope':'Mock LOM, synthetic musical clock and assumed polling only; not Live CPU, scheduler timing, MIDI driver or hardware latency.', 'python':platform.python_version(),'builds':[]}
    for entry in sys.argv[2:]:
        label,path=entry.split(':',1);m=load(path,label)
        cases=[case(m,bpm,bars) for bpm in (90,120,160,200) for bars in (1,2,4)]
        cases+=[case(m,200,4,origin=8.),case(m,200,4,hz=20)]
        report['builds'].append({'name':label,'sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'cases':cases})
        print(label,[(x['bpm'],x['bars'],x['note_vector_reads'],x['full_render_passes'],x['missed_step_positions']) for x in cases[:12]])
    Path(sys.argv[1]).write_text(json.dumps(report,indent=2)+'\n')
