#!/usr/bin/env python3
"""NCC-1337 Direct OSC v0.8: ten named hardware-input sends, three submixes.

RX and polling never transmit fader writes. POST /api/send, invoked by a UI
SEND ONCE click, is the only fader write path. All traffic is loopback-only.
Indices originate in the 2026-11-25 NCC-1337 Global OSC capture.
"""
import argparse
import json
import math
import re
import socket
import struct
import sys
import threading
import time
import webbrowser
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = '127.0.0.1'
OUTPUTS = {'MAIN': 0, 'PHONES': 2, 'MON2': 4}
INPUTS = (
    {'index': 0, 'name': 'Mic Chain', 'stereo': False, 'partner': None},
    {'index': 1, 'name': 'Digitech SV', 'stereo': False, 'partner': None},
    {'index': 2, 'name': 'OB TEO5', 'stereo': True, 'partner': 3},
    {'index': 4, 'name': 'DMX 1 / DJ', 'stereo': True, 'partner': 5},
    {'index': 6, 'name': 'DMX 3', 'stereo': False, 'partner': None},
    {'index': 7, 'name': 'DMX 4', 'stereo': False, 'partner': None},
    {'index': 8, 'name': 'LMDRUM', 'stereo': False, 'partner': None},
    {'index': 9, 'name': 'PRO12ASB', 'stereo': False, 'partner': None},
    {'index': 10, 'name': 'ESQ1', 'stereo': False, 'partner': None},
    {'index': 11, 'name': 'DX100', 'stereo': False, 'partner': None},
)
VALID_INPUTS = {x['index']: x for x in INPUTS}
RX_ADDR = re.compile(r'^/mix/in/(\d+)/(0|2|4)/fader$')
ALLOWED_HA_ORIGINS = {
    'http://homeassistant.local', 'http://homeassistant.local:8123',
    'https://homeassistant.local', 'https://homeassistant.local:8123',
}


def osc_pad(data):
    return data + b'\0' * ((-len(data)) % 4)


def osc_string(value):
    return osc_pad(value.encode('utf-8') + b'\0')


def osc_float(path, value):
    if not math.isfinite(value):
        raise ValueError('non-finite OSC value')
    return osc_string(path) + osc_string(',f') + struct.pack('>f', value)


def read_string(data, pos):
    end = data.find(b'\0', pos)
    if end < 0:
        raise ValueError('OSC string not terminated')
    value = data[pos:end].decode('utf-8', 'replace')
    pos = (end + 4) & ~3
    if pos > len(data):
        raise ValueError('truncated OSC string')
    return value, pos


def decode_osc(data, depth=0):
    if depth > 5 or not data or len(data) > 65536:
        return
    if data.startswith(b'#bundle\0'):
        if len(data) < 16:
            return
        pos = 16
        while pos + 4 <= len(data):
            size = struct.unpack_from('>I', data, pos)[0]
            pos += 4
            if not size or size > 65536 or pos + size > len(data):
                return
            yield from decode_osc(data[pos:pos + size], depth + 1)
            pos += size
        return
    try:
        path, pos = read_string(data, 0)
        tags, pos = read_string(data, pos)
        if not path.startswith('/') or not tags.startswith(','):
            return
        args = []
        for tag in tags[1:]:
            if tag == 'f':
                args.append(struct.unpack_from('>f', data, pos)[0]); pos += 4
            elif tag == 'i':
                args.append(struct.unpack_from('>i', data, pos)[0]); pos += 4
            elif tag == 's':
                value, pos = read_string(data, pos); args.append(value)
            elif tag == 'T':
                args.append(True)
            elif tag == 'F':
                args.append(False)
            elif tag == 'N':
                args.append(None)
            else:
                return
        yield path, args
    except (ValueError, IndexError, struct.error):
        return


class OSCMonitor:
    def __init__(self, listen_port=9002, target_port=7002, refresh_interval=5.0, sock=None):
        self.listen_port = listen_port
        self.target_port = target_port
        self.refresh_interval = refresh_interval
        self.sock = sock or socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        if sock is None:
            if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
                self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            self.sock.bind((HOST, listen_port))
        self.sock.settimeout(0.4)
        self.lock = threading.RLock()
        self.stop = threading.Event()
        self.started = time.monotonic()
        self.observations = {}  # (physical_input_index, destination_index): (value, monotonic_time)
        self.rx_total = 0
        self.rx_fader = 0
        self.refresh_tx = 0
        self.manual_fader_tx = 0
        self.auto_fader_tx = 0  # never incremented; no RX-to-write path
        self.events = deque(maxlen=40)
        self.last_recv_at = None
        self.last_peer = None
        self.last_send = None
        self.last_send_basis = None
        self.last_feedback = None
        self.postsend_count = 0
        self.threads = []

    def record(self, message):
        with self.lock:
            self.events.appendleft(f'{time.strftime("%H:%M:%S")} {message}')

    def start(self):
        self.threads = [threading.Thread(target=self.receiver, daemon=True, name='osc-rx'),
                        threading.Thread(target=self.refresher, daemon=True, name='osc-refresh')]
        for thread in self.threads:
            thread.start()

    def accept_packet(self, packet, peer=(HOST, 9002)):
        """One-way feedback consumer. No OSC send call is reachable from here."""
        if peer[0] != HOST:
            return
        now = time.monotonic()
        with self.lock:
            self.last_recv_at = now
            self.last_peer = f'{peer[0]}:{peer[1]}'
        for address, args in decode_osc(packet):
            with self.lock:
                self.rx_total += 1
            match = RX_ADDR.fullmatch(address)
            if not match or len(args) != 1 or type(args[0]) is not float or not math.isfinite(args[0]):
                continue
            index, output = int(match[1]), int(match[2])
            if index not in VALID_INPUTS and index not in (3, 5):
                continue
            value = args[0]
            with self.lock:
                self.rx_fader += 1
                route = (index, output)
                old = self.observations.get(route)
                self.observations[route] = (value, now)
                if self.last_send and self.last_send['route'] == route and now > self.last_send['at']:
                    self.postsend_count += 1
                    self.last_feedback = (value, now)
                if old is None or abs(old[0] - value) > 0.005:
                    label = VALID_INPUTS.get(index, {'name': f'partner {index}'})['name']
                    self.events.appendleft(f'{time.strftime("%H:%M:%S")} RX {label} output {output}: {value:+.2f} dB (NO TX)')

    def receiver(self):
        while not self.stop.is_set():
            try:
                packet, peer = self.sock.recvfrom(65535)
            except socket.timeout:
                continue
            except OSError:
                return
            self.accept_packet(packet, peer)

    def refresh(self, reason='periodic', submix='PHONES'):
        if submix not in OUTPUTS:
            raise ValueError('unknown submix')
        output = OUTPUTS[submix]
        packet = osc_float(f'/sendsubmix/{output}', 1.0)
        if len(packet) != 24:
            raise AssertionError('Unexpected RME refresh packet length')
        self.sock.sendto(packet, (HOST, self.target_port))
        with self.lock:
            self.refresh_tx += 1
        if reason != 'periodic':
            self.record(f'TX REFRESH {submix} (read-only request)')

    def refresher(self):
        while not self.stop.is_set():
            start = time.monotonic()
            for name in ('PHONES', 'MAIN', 'MON2'):
                if self.stop.is_set():
                    break
                try:
                    self.refresh('periodic', name)
                except OSError as exc:
                    self.record(f'REFRESH {name} FAILED: {exc}')
                self.stop.wait(0.04)
            self.stop.wait(max(0, self.refresh_interval - (time.monotonic() - start)))

    def send_fader(self, value, input_index=11, submix='PHONES'):
        """Only HTTP POST /api/send, initiated by user click, calls here."""
        if type(input_index) is not int or input_index not in VALID_INPUTS:
            raise ValueError('input_index must identify one of the ten mapped strips')
        if type(submix) is not str or submix not in OUTPUTS:
            raise ValueError('submix must be MAIN, PHONES, or MON2')
        if type(value) not in (int, float) or not math.isfinite(value) or not -65 <= value <= 6:
            raise ValueError('target must be a number between -65 and +6 dB')
        out = OUTPUTS[submix]
        path = f'/mix/in/{input_index}/{out}/fader'
        packet = osc_float(path, float(value))
        if len(packet) != 28:
            raise AssertionError('Unexpected RME command packet length')
        with self.lock:
            now = time.monotonic()
            observed = self.observations.get((input_index, out))
            self.sock.sendto(packet, (HOST, self.target_port))
            encoded = struct.unpack('>f', packet[-4:])[0]
            self.last_send = {'route': (input_index, out), 'input_index': input_index,
                              'submix': submix, 'db': encoded, 'at': now, 'path': path}
            self.last_send_basis = observed[0] if observed else None
            self.last_feedback = None
            self.postsend_count = 0
            self.manual_fader_tx += 1
        self.record(f'TX ONCE {VALID_INPUTS[input_index]["name"]} -> {submix} {encoded:+.2f} dB')
        def readback():
            if not self.stop.wait(0.35):
                try:
                    self.refresh('readback', submix)
                except OSError:
                    pass
        threading.Thread(target=readback, daemon=True).start()

    def snapshot(self):
        with self.lock:
            now = time.monotonic()
            inputs = []
            for definition in INPUTS:
                idx = definition['index']
                sends = {}
                for name, out in OUTPUTS.items():
                    obs = self.observations.get((idx, out))
                    sends[name] = ({'state': 'OFF' if obs[0] <= -299 else 'OBSERVED',
                                     'dB': obs[0], 'age_s': round(now - obs[1], 1)} if obs
                                    else {'state': 'UNAVAILABLE', 'dB': None, 'age_s': None})
                partner = definition['partner']
                paired = {}
                if partner is not None:
                    for name, out in OUTPUTS.items():
                        obs = self.observations.get((partner, out))
                        paired[name] = obs[0] if obs else None
                inputs.append({'index': idx, 'name': definition['name'],
                               'stereo': definition['stereo'], 'stereo_partner_index': partner,
                               'partner_db': paired, 'sends': sends})
            sent = self.last_send
            if not sent:
                status = 'NO COMMAND'
            elif not self.last_feedback:
                status = 'AWAITING FEEDBACK'
            elif now - self.last_feedback[1] > 20:
                status = 'FEEDBACK STALE'
            elif abs(self.last_feedback[0] - sent['db']) <= 0.02:
                status = 'MATCHED'
            else:
                status = 'MISMATCH'
            dx = self.observations.get((11, 2))
            return {
                'version': '0.8', 'inputs': inputs, 'submixes': OUTPUTS,
                'level_db': dx[0] if dx else None,
                'feedback_age_s': round(now - dx[1], 1) if dx else None,
                'last_requested_db': sent['db'] if sent else None,
                'last_readback_db': self.last_feedback[0] if self.last_feedback else None,
                'readback_status': status, 'readback_match': status == 'MATCHED' if sent else None,
                'last_send': {'input_index': sent['input_index'], 'submix': sent['submix'],
                              'requested_db': sent['db'], 'before_db': self.last_send_basis,
                              'readback_db': self.last_feedback[0] if self.last_feedback else None,
                              'status': status, 'postsend_packets': self.postsend_count} if sent else None,
                'manual_fader_packets_sent': self.manual_fader_tx,
                'automatic_fader_packets_sent': self.auto_fader_tx,
                'refresh_requests_sent': self.refresh_tx,
                'rx_messages': self.rx_total, 'rx_fader_messages': self.rx_fader,
                'last_feedback_peer': self.last_peer,
                'events': list(self.events),
                'uptime_s': round(now-self.started, 1),
            }

    def close(self):
        self.stop.set()
        self.sock.close()


def make_handler(monitor):
    page = (Path(__file__).parent / 'panel.html').read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def host_ok(self):
            return self.headers.get('Host') in (
                f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}')

        def origin_ok(self):
            origin = self.headers.get('Origin', '')
            return origin in ALLOWED_HA_ORIGINS or origin in (
                f'http://127.0.0.1:{self.server.server_port}',
                f'http://localhost:{self.server.server_port}')

        def cors(self):
            origin = self.headers.get('Origin', '')
            if self.origin_ok():
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.send_header('Access-Control-Allow-Private-Network', 'true')

        def json_reply(self, data, code=200):
            body = json.dumps(data).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.cors()
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            if not self.host_ok() or not self.origin_ok():
                self.send_error(403); return
            self.send_response(204)
            self.cors()
            self.send_header('Content-Length', '0')
            self.end_headers()

        def do_GET(self):
            if not self.host_ok() or (self.headers.get('Origin') and not self.origin_ok()):
                self.send_error(403); return
            if self.path == '/api/state':
                self.json_reply(monitor.snapshot()); return
            if self.path == '/':
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(page)))
                self.end_headers(); self.wfile.write(page); return
            self.send_error(404)

        def do_POST(self):
            if not self.host_ok() or not self.origin_ok():
                self.send_error(403); return
            if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                self.send_error(415); return
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if size < 1 or size > 512:
                    raise ValueError('invalid request size')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict):
                    raise ValueError('JSON object required')
                if self.path == '/api/refresh':
                    monitor.refresh('manual', body.get('submix', 'PHONES'))
                    self.json_reply({'refreshed': True}); return
                if self.path == '/api/send':
                    monitor.send_fader(body['target_db'], body.get('input_index', 11),
                                       body.get('submix', 'PHONES'))
                    self.json_reply({'sent': True}); return
                self.send_error(404)
            except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
                self.json_reply({'error': str(exc)}, 400)

    return Handler


def main():
    p = argparse.ArgumentParser(description='NCC-1337 ten-input local Direct OSC v0.8')
    p.add_argument('--listen', type=int, default=9002)
    p.add_argument('--totalmix', type=int, default=7002)
    p.add_argument('--web', type=int, default=8772)
    p.add_argument('--no-browser', action='store_true')
    args = p.parse_args()
    try:
        monitor = OSCMonitor(listen_port=args.listen, target_port=args.totalmix)
    except OSError as exc:
        print(f'Cannot listen on UDP {args.listen}: {exc}\nStop only the old 9002 bridge/test receiver first.', file=sys.stderr)
        return 2
    try:
        server = ThreadingHTTPServer((HOST, args.web), make_handler(monitor))
    except OSError as exc:
        monitor.close()
        print(f'Cannot listen on local HTTP port {args.web}: {exc}', file=sys.stderr)
        return 2
    monitor.start()
    url = f'http://{HOST}:{args.web}/'
    print(f'NCC-1337 LCARS DIRECT OSC v0.8 at {url}\n'
          f'Receiving TotalMix on {HOST}:{args.listen}; sending to {HOST}:{args.totalmix}.\n'
          '10 mapped inputs x MAIN/PHONES/MON 2. NO TOKENS. No RX-initiated fader writes.\n'
          'Ctrl+C stops the bridge.\n', flush=True)
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print('\nStopping...')
    finally:
        server.server_close()
        monitor.close()
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
