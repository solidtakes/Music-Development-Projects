"""Explicit four-breakpoint experiment. NEVER imported by production sequencer.
Owner review + disposable SESSION clip and explicitly bound CC Control Mod Wheel
DeviceParameter required. This is device automation, not direct MIDI Ctrl CC1.
Nothing runs on import. Persistence and MIDI routing require real Live tests.
"""
def _belongs_to(obj,track):
    for _ in range(8):
        if obj is track or obj==track:return True
        obj=getattr(obj,'canonical_parent',None)
        if obj is None:return False
    return False

def run(clip,parameter,track,confirm_disposable=False):
    if not confirm_disposable:raise RuntimeError('Explicit disposable-clip confirmation required')
    if not getattr(clip,'is_session_clip',False):raise RuntimeError('Session clip required')
    if not _belongs_to(clip,track) or not _belongs_to(parameter,track):raise RuntimeError('Clip/parameter ownership mismatch')
    if not getattr(parameter,'is_enabled',True):raise RuntimeError('Parameter disabled')
    getter=getattr(clip,'automation_envelope',None);creator=getattr(clip,'create_automation_envelope',None)
    if not callable(getter) or not callable(creator):raise RuntimeError('Required clip envelope API unavailable')
    if getter(parameter) is not None:raise RuntimeError('Use an empty disposable automation lane; existing lane left untouched')
    minimum,maximum=float(parameter.min),float(parameter.max)
    if maximum<=minimum:raise RuntimeError('Invalid parameter range')
    start=float(clip.loop_start)
    if float(clip.loop_end)-start<1.:raise RuntimeError('One beat of loop space required')
    envelope=creator(parameter)
    if not callable(getattr(envelope,'insert_step',None)) or not callable(getattr(envelope,'value_at_time',None)):raise RuntimeError('Envelope methods unavailable; creation may already have changed clip')
    values=(0,42,85,127)
    for i,value in enumerate(values):envelope.insert_step(start+i*.25,.25,minimum+(maximum-minimum)*value/127.)
    fresh=getter(parameter)
    actual=[int(round(127.*(fresh.value_at_time(start+i*.25+.125)-minimum)/(maximum-minimum))) for i in range(4)]
    if actual!=list(values):raise RuntimeError('Readback mismatch after write; inspect disposable clip or Undo')
    return {'values_read_back':actual,'save_reload_verified':False,'cc1_output_verified':False}
