"""Offline evidence only: extracted upstream C, and available sequencer helpers.
Does not open MIDI ports or exercise the missing Bank 4 diagnostic.
"""
from pathlib import Path
import ast
import re
import subprocess
import types
import json
import argparse
import tempfile
import hashlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--firmware', type=Path, required=True, help='Pinned DJTT repository checkout')
parser.add_argument('--sequencer', type=Path, required=True, help='Pinned baseline MF_SEQ.py')
parser.add_argument('--results', type=Path, required=True)
args = parser.parse_args()
scratch = tempfile.TemporaryDirectory(prefix='bank4-protocol-')
root = Path(scratch.name)
source = (args.firmware / 'src/encoders.c').read_text()
assert hashlib.sha256((args.firmware / 'src/encoders.c').read_bytes()).hexdigest() == 'bedf778e1d07d1104edca992dc46efdf98481d738fa139c380d86333bb2972cc'
assert hashlib.sha256(args.sequencer.read_bytes()).hexdigest() == '8e4ff43eaa6a0fa30487b069e01cd2780781e0788d49016bd684f7d865d6954d'
source = re.sub(r'/\*.*?\*/|//[^\n]*', '', source, flags=re.S)

def function(name):
    match = re.search(r'^(?:static )?(?:void|bool|uint8_t) ' + name + r'\([^\n]*', source, re.M)
    assert match, name
    start = source.index('{', match.start())
    depth = 1
    pos = start + 1
    while depth:
        depth += (source[pos] == '{') - (source[pos] == '}')
        pos += 1
    return source[match.start():pos]

names = ['process_element_midi', 'process_indicator_update', 'process_sw_rgb_update', 'process_sw_toggle_update']
functions = '\n'.join(function(n) for n in names)
constants = sorted(set(re.findall(r'\b(?:SEND_[A-Z_]+|NOTE_HOLD|NOTE_TOGGLE)\b', functions)))
prelude = '''
#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>
#define BANKED_ENCODERS 64
#define SHIFT_OFFSET 64
#define ENABLE_DUPLICATE_INPUT_MAPPINGS 1
#define GET_ENC_ANIM_CHANNEL(x) 13
#define GET_SW_ANIM_CHANNEL(x) 14
typedef struct { uint8_t encoder_midi_number, encoder_midi_type, encoder_midi_channel,
 encoder_shift_midi_channel, switch_midi_number, switch_midi_channel,
 switch_action_type, has_detent, inactive_color, active_color; } settings;
settings encoder_settings[64];
uint8_t midi_system_channel=15, global_animation_channels=0, active_bank=0;
uint16_t shift_mode_midi_override[4], shift_mode_switch_state[4], switch_color_overide[4];
uint8_t indicator_value_buffer[4][16], switch_color_buffer[4][16], enc_switch_midi_state[4][16];
int16_t raw_encoder_value[128];
bool native_mode_consume_midi_event(uint8_t a,uint8_t b,uint8_t c,uint8_t d){return false;}
uint8_t encoder_is_in_shift_state(uint8_t a,uint8_t b){return 0;}
uint8_t current_encoder_bank(void){return active_bank;}
bool encoder_is_active(uint8_t a){return false;}
bool encoder_midi_type_is_relative(uint8_t a){return true;}
void process_encoder_animation_update(uint8_t a,uint8_t b){}
void process_sw_animation_update(uint8_t a,uint8_t b){}
void process_indicator_update(uint8_t,uint8_t,uint8_t);
void process_sw_rgb_update(uint8_t,uint8_t);
void process_sw_toggle_update(uint8_t,uint8_t);
'''
prelude += '\nenum {' + ','.join(constants) + '};\n'
main = '''
int main(void){
 for(int i=0;i<64;i++){
  encoder_settings[i]=(settings){.encoder_midi_number=i,.encoder_midi_type=SEND_REL_ENC,
   .encoder_midi_channel=11,.encoder_shift_midi_channel=12,.switch_midi_number=i,
   .switch_midi_channel=10,.switch_action_type=99,.inactive_color=5,.active_color=68};
 }
 // Bank 4 addressed while Bank 1 is active: inactive bank buffers still update.
 for(int i=48;i<64;i++){
  process_element_midi(10,SEND_CC,i,68,true);
  process_element_midi(11,SEND_CC,i,99,true);
 }
 for(int i=0;i<16;i++){
  assert(switch_color_buffer[3][i]==68); assert(indicator_value_buffer[3][i]==99);
  for(int b=0;b<3;b++){assert(switch_color_buffer[b][i]==0);assert(indicator_value_buffer[b][i]==0);}
 }
 // Zero restores inactive color, not guaranteed black. 127 restores active.
 process_element_midi(10,SEND_CC,48,0,true); assert(switch_color_buffer[3][0]==5);
 assert(!(switch_color_overide[3]&1));
 process_element_midi(10,SEND_CC,48,127,true); assert(switch_color_buffer[3][0]==68);
 // Detent rejects a zero ring update.
 encoder_settings[48].has_detent=1;
 process_element_midi(11,SEND_CC,48,0,true); assert(indicator_value_buffer[3][0]==99);
 encoder_settings[48].has_detent=0;
 process_element_midi(11,SEND_CC,48,0,true); assert(indicator_value_buffer[3][0]==0);
 // RGB/ring separation, shifted channel and wrong CC remain independent.
 process_element_midi(11,SEND_CC,49,20,true); assert(switch_color_buffer[3][1]==68);
 process_element_midi(12,SEND_CC,49,30,true); assert(indicator_value_buffer[3][1]==20);
 process_element_midi(10,SEND_CC,64,30,true); assert(switch_color_buffer[3][1]==68);
 // Duplicate mappings can affect another bank; system channel suppresses ordinary mapping.
 encoder_settings[0].switch_midi_number=49;
 process_element_midi(10,SEND_CC,49,108,true);
 assert(switch_color_buffer[0][0]==108 && switch_color_buffer[3][1]==108);
 midi_system_channel=10;
 process_element_midi(10,SEND_CC,49,40,true); assert(switch_color_buffer[3][1]==108);
 puts("PASS: 7 extracted firmware protocol groups");
}
'''
cfile = root / 'protocol_harness.c'
cfile.write_text(prelude + functions + main)
subprocess.run(['gcc', '-std=c99', '-fsanitize=address,undefined', '-g', str(cfile), '-o', str(root/'protocol_harness')], check=True)
subprocess.run([str(root/'protocol_harness')], check=True)

seq = args.sequencer.read_text()
tree = ast.parse(seq)
compile(seq, 'seq_reference.py', 'exec')
cls = next(n for n in tree.body if isinstance(n,ast.ClassDef))
methods = [n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name in ('_led','_white_ring')]
module = ast.Module(body=methods,type_ignores=[])
namespace={'PUSH_CHANNEL':10,'ROT_CHANNEL':11,'FIRST_CC':48}
exec(compile(module,'extracted_seq_helpers','exec'), namespace)
fake=types.SimpleNamespace(_last_leds=[None]*16,_last_white_rings=[None]*16)
messages=[]
fake._send_midi=messages.append
for i in range(16):
    namespace['_led'](fake,i,68)
    namespace['_white_ring'](fake,i,99)
assert messages == [m for i in range(16) for m in [(0xBA,48+i,68),(0xBB,48+i,99)]]
for i in range(16):
    namespace['_led'](fake,i,68)
    namespace['_white_ring'](fake,i,99)
assert len(messages)==32
fake._last_leds=[None]*16
namespace['_led'](fake,0,68)
assert len(messages)==33
assert all(len(m)==3 and m[0] in (0xBA,0xBB) and 48<=m[1]<=63 and 0<=m[2]<=127 for m in messages)
print('PASS: reference Python syntax + MIDI sequence/cache/invalidation (4 groups)')
print('NOT RUN: missing Bank 4 syntax, lifecycle, regression; Live/hardware; firmware target build')
args.results.write_text(json.dumps({'firmware_groups':7,'reference_python_groups':4,'bank4_tests':'NOT RUN: source unavailable','hardware':'NOT RUN'},indent=2)+'\n')

scratch.cleanup()
