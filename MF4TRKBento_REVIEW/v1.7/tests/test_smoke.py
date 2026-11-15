"""Run directly with Python. Adapted from the v1.4 archive's smoke test."""
from pathlib import Path
import mock_live as mock
from mock_live import Song, Clip

module = mock.load(Path(__file__).resolve().parents[1] / 'MF4TRKBento' / 'MF4TRKBento.py')
clock = 0.0
module.time = type('Clock', (), {'monotonic': staticmethod(lambda: clock)})
SONG = mock.SONG = Song()
u = module.create_instance(None)

def hold(cc):u._push(cc,127)
def release(cc):u._push(cc,0)
def tap(cc):hold(cc);release(cc)
def right(cc,n=1):
    for _ in range(n):u._rotary(cc,65)
def left(cc,n=1):
    for _ in range(n):u._rotary(cc,63)
def choose(row,mod):
    for _ in range(12):
        if u._row_modules[row]==mod:return
        u._cycle_module(row,1)
    raise AssertionError('unreachable module '+mod)

def reset():
    global SONG,u
    u.disconnect()
    SONG=mock.SONG=Song()
    u=module.create_instance(None)

# 1) Scene palette, dynamic occupancy and a real playing clip ring.
assert u.MODULES == ('RClip','Arm','Solo','Pan','Mute','Sends','Stop')
assert 'Blank' not in u.MODULES
assert len(u.ROWS)==4
assert u._row_modules==['RClip','Pan','Mute','Sends']
assert u._scene_state(0,SONG.tracks)[:2] == (0,0)
clip=Clip()
slot=SONG.tracks[6].clip_slots[0]
slot.has_clip=True;slot.clip=clip
assert u._scene_state(0,SONG.tracks)[:2] == (108,0) # stopped yellow
clip.is_playing=True
assert u._scene_state(0,SONG.tracks)[:2] == (76,2)  # playing green
assert u._scene_state(0,SONG.tracks)[2] is clip
slot.is_triggered=True
assert u._scene_state(0,SONG.tracks)[:2] == (52,8)  # queued pink
clip.is_recording=True
assert u._scene_state(0,SONG.tracks)[:2] == (72,8) # recording red
clip.is_recording=False
slot.is_triggered=False
clip.is_triggered=False
# 2) Physical row layout/scrolling/alternate scene output preserved.
SONG.view.selected_track=SONG.tracks[7]
u._refresh_all();assert u._track_offset==0
hold(0);right(15,3);assert u._track_offset==0
right(15);release(0);assert u._track_offset==1
hold(0);right(11,4);release(0);assert u._scene_offset==1
hold(15);hold(0);release(0);release(15);assert u._alt_mode
assert u._frame[3][3] is True
choose(2,'RClip');choose(3,'RClip')
assert u._active_rows()==[0,2,3]
assert u._session_size==(3,3)
assert u._scene_index(2)==u._scene_offset+1
# 3) Solo and Arm LED: solid while idle, flashing when active.
reset()
choose(1,'Arm');choose(2,'Solo')
assert u._row_modules.count('Arm')==u._row_modules.count('Solo')==1
choose(3,'Pan');u._cycle_module(3,-1)
assert u._row_modules[3] != 'Solo' # skips taken module
assert u._frame[4][:2] == (72,0)
assert u._frame[8][:2] == (68,0)
tap(4)
assert SONG.tracks[0].arm
assert u._frame[4][:2]==(72,4)
tap(8)
assert SONG.tracks[0].solo
assert u._frame[8][:2]==(68,4)
# Exclusive Arm single click; holding two Arm buttons adds both.
tap(5)
assert SONG.tracks[1].arm and not SONG.tracks[0].arm
hold(4);hold(5);release(5);release(4)
assert SONG.tracks[0].arm and SONG.tracks[1].arm
# Alt mode hides 4th Arm/Solo, making their pushes inert.
hold(15);hold(0);release(0);release(15)
assert u._alt_mode
assert 7 not in u._frame and 11 not in u._frame
before=[t.arm for t in SONG.tracks]
tap(7);assert before==[t.arm for t in SONG.tracks]
# 4) Mute row: monitor color independent of mute, push toggles mute.
reset()
assert u._row_modules[2]=='Mute'
track=SONG.tracks[0]
assert u._frame[8][:2] == (108,0)
track.current_monitoring_state=1
u._refresh_all();assert u._frame[8][0]==68
tap(8);assert track.mute
assert u._frame[8][1] == 4 and u._frame[8][2] == 95
track.current_monitoring_state=3
u._refresh_all();assert u._frame[8][0]==108
# 5) Sends: row order A then B, 4th off in alt; inert press.
reset()
choose(1,'Sends')
assert u._send_index(1)==0 and u._send_index(3)==1
assert u._send_parameter(1,0) is SONG.tracks[0].mixer_device.sends[0]
assert u._send_parameter(3,0) is SONG.tracks[0].mixer_device.sends[1]
right(4,3);assert SONG.tracks[0].mixer_device.sends[0].value>0
right(12,3);assert SONG.tracks[0].mixer_device.sends[1].value>0
prior = SONG.tracks[0].mixer_device.sends[0].value
tap(4);assert SONG.tracks[0].mixer_device.sends[0].value == prior
hold(15);hold(0);release(0);release(15)
assert u._alt_mode
assert u._send_parameter(1,3) is None and u._send_parameter(3,3) is None
assert 7 not in u._frame and 15 not in u._frame
# A top-row Arm has no above partner. Ordinary press still Arms.
reset()
choose(0,'Arm')
tap(0)
assert SONG.tracks[0].arm
# Stable refresh still emits zero sends after cache has converged.
u._refresh_all();u.sent.clear()
for i in range(20):u._refresh_all()
assert not u.sent, u.sent[:10]
# All listeners cleaned up on disconnect.
u.disconnect();assert not u._elements
print('PASS: seven modules/no Blank; scene 5-state colors; four rows, scrolling, alt; Arm/Solo colors & exclusive/multi arm; monitoring Mute; Sends A/B, alt disable; stable LED cache; cleanup')
# Flash timing and scene white-ring output are tested separately from state selection.
SONG=mock.SONG=Song();u=module.create_instance(None)
clip=Clip()
s=SONG.tracks[0].clip_slots[0]
s.has_clip=True;s.clip=clip;clip.is_playing=True
hold(15);hold(0);release(0);release(15)
assert u._alt_mode
SONG.current_song_time=0.0
u._refresh_all()
assert u._frame[3][:2]==(76,2)
assert u._rgb_cache[3]==76
assert u._ring_cache[3]>0
SONG.current_song_time=0.6
u._render_frame(update_rings=False)
assert u._rgb_cache[3]==0
SONG.current_song_time=1.0
u._render_frame(update_rings=False)
assert u._rgb_cache[3]==76
s.is_triggered=True;SONG.current_song_time=0.0
u._refresh_all();assert u._frame[3][:2]==(52,8) and u._rgb_cache[3]==52
SONG.current_song_time=0.125
u._render_frame(update_rings=False)
assert u._rgb_cache[3]==0
clip.is_recording=True;SONG.current_song_time=0.0
u._refresh_all()
assert u._frame[3][:2]==(72,8) and u._rgb_cache[3]==72
clip.is_recording=False;s.is_triggered=False;clip.is_playing=False
u._refresh_all()
assert u._frame[3][:2]==(108,0) and u._rgb_cache[3]==108
s.has_clip=False;s.clip=None
u._refresh_all();assert u._frame[3][:2]==(0,0) and u._ring_cache[3]==0
# No return to solid green for stopped or empty scenes.
u.disconnect()
print('PASS: scene green/pink/red flashing transitions, stopped yellow, empty off, active scene ring')
