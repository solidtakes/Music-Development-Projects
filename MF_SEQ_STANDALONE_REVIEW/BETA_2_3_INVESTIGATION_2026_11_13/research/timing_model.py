"""Offline timing proposal only. No Live import, MIDI output or clip mutation.
Canonical records supply start_time and explicit grid_step. Never infer a grid
from microtiming or from notes already swung. Caller keeps canonical metadata.
"""
import copy,math

def swing_delay(amount,step_beats=.25):
    if not math.isfinite(amount) or not 0<=amount<=100:raise ValueError('amount must be 0..100 percent of maximum delay')
    return step_beats*.5*amount/100.

def plan(canonical_notes,amount,nudge_ticks=None,content_start=0.,content_end=16.,step_beats=.25):
    nudge_ticks=nudge_ticks or {};delay=swing_delay(amount,step_beats)
    result=copy.deepcopy(canonical_notes);ids=set()
    for n in result:
        ident=n['note_id']
        if ident in ids:raise ValueError('Duplicate note ID')
        ids.add(ident)
        grid=n['grid_step']
        ticks=nudge_ticks.get(ident,0)
        if grid is None and ticks:raise ValueError('Unowned note cannot be nudged')
        if not isinstance(ticks,int) or abs(ticks)>6:raise ValueError('Nudge limited to +/-6 ticks, each 1/96 beat')
        n['start_time']=n['start_time']+ticks/96.+(delay if grid is not None and grid%2 else 0.)
        if not math.isfinite(n['start_time']) or n['duration']<=0:raise ValueError('Invalid note interval')
        if n['start_time']<content_start-1e-9 or n['start_time']+n['duration']>content_end+1e-9:raise ValueError('Outside content bounds; no wrap or trim')
    if set(nudge_ticks)-ids:raise ValueError('Unknown note ID')
    ordered=sorted(result,key=lambda n:n['start_time'])
    for left,right in zip(ordered,ordered[1:]):
        if left['start_time']+left['duration']>right['start_time']+1e-9:raise ValueError('Mono overlap; reject entire plan without trimming')
    return result

def boundaries(amount,steps=16,step_beats=.25):
    delay=swing_delay(amount,step_beats)
    return [i*step_beats+(delay if i%2 else 0.) for i in range(steps)]
