#!/usr/bin/env python3
"""NCC-1337 v1.0 optional Android companion (NO changes to verified OSC bridge).

The Windows bridge stays private on 127.0.0.1:8772. This HTTPS-free,
LAN-only mobile page uses one-time QR pairing and a random session cookie.
Audio commands only pass from an authenticated user gesture to the existing
localhost HTTP API; unsolicited OSC feedback never causes commands.
Only run this on a trusted private home network. Do NOT port-forward 8773.
"""
import argparse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent / 'vendor'))
import hmac
import http.client
import html
import ipaddress
import json
import secrets
import socket
import sys
import threading
import urllib.parse
import webbrowser
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LISTEN_PORT = 8773
UPSTREAM_HOST, UPSTREAM_PORT = '127.0.0.1', 8772
COOKIE = 'ncc1337_mobile'
DATA_PATH = Path(__file__).resolve().parent
INPUTS = {0,1,2,4,6,7,8,9,10,11}
OUTPUTS = {'MAIN','PHONES','MON2'}


def private_address():
    """Find the PC's LAN address without transmitting any data."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(('1.1.1.1', 80))
        addr = sock.getsockname()[0]
    except OSError:
        addr = ''
    finally:
        sock.close()
    if addr and ipaddress.ip_address(addr).is_private and not ipaddress.ip_address(addr).is_loopback:
        return addr
    # Reject public/WAN auto-binding. User can specify a private LAN IPv4 explicitly.
    raise ValueError('Unable to detect a private LAN IPv4; pass --ip 192.168.x.x')


def qr_svg(url):
    from qrcode import QRCode
    from qrcode.constants import ERROR_CORRECT_M
    qr = QRCode(error_correction=ERROR_CORRECT_M, box_size=1, border=3)
    qr.add_data(url)
    qr.make(fit=True)
    matrix=qr.get_matrix()
    paths=[]
    for y,row in enumerate(matrix):
        for x,black in enumerate(row):
            if black: paths.append(f'M{x} {y}h1v1h-1z')
    width=len(matrix)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {width}" role="img" aria-label="Android mixer pairing QR">'
            f'<rect width="{width}" height="{width}" fill="white"/>'
            f'<path d="{"".join(paths)}" fill="#09060d"/></svg>')


def qr_page(url):
    return ('''<!DOCTYPE html><html><head><meta charset="utf-8"><title>NCC-1337 Android Pairing</title>
    <style>body{font:17px Arial,sans-serif;background:#08050d;color:#f4d7ff;text-align:center;padding:15px}h1{color:#ffda5d}
    svg{display:block;background:white;width:min(80vw,410px);margin:20px auto;padding:8px;border-radius:5px}
    code{color:#b8dffa;word-break:break-all}small{color:#bdaacf}</style></head><body>
    <h1>NCC-1337 / ANDROID TOUCH MIXER</h1><p>On your Android phone, scan this QR using the camera. Use the same trusted home Wi-Fi.</p>'''+qr_svg(url)+
    '<p>Scan to pair automatically — no token to type.</p><small>Keep the Windows OSC v0.8 backend and this Android proxy running.<br>'+
    'Never forward TCP 8773 to the internet. Only use trusted home Wi-Fi.</small></body></html>')


class ProxyServer(ThreadingHTTPServer):
    allow_reuse_address = False
    def __init__(self, addr, handler, secret, host):
        super().__init__(addr, handler)
        self.secret = secret
        self.lan_host = host


def make_handler():
    page = (DATA_PATH/'android_mixer.html').read_bytes()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args): pass  # Never log a bearer cookie or QR URL
        def host_ok(self):
            return self.headers.get('Host','') in {f'{self.server.lan_host}:{self.server.server_port}',f'127.0.0.1:{self.server.server_port}'}
        def trusted_client(self):
            try:
                ip=ipaddress.ip_address(self.client_address[0]);
                return ip.is_private or ip.is_loopback
            except ValueError: return False
        def paired(self):
            cookie=SimpleCookie()
            try:cookie.load(self.headers.get('Cookie',''))
            except Exception:return False
            value=cookie.get(COOKIE)
            return bool(value and hmac.compare_digest(value.value,self.server.secret))
        def error_json(self, code, reason):
            self.reply_json({'error':reason},code)
        def reply_json(self,data,code=200):
            raw=json.dumps(data).encode('utf-8')
            self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        def same_origin(self):
            origin=self.headers.get('Origin','')
            return origin in {f'http://{self.server.lan_host}:{self.server.server_port}',f'http://127.0.0.1:{self.server.server_port}'}
        def forward(self, method,path,body=None):
            c=http.client.HTTPConnection(UPSTREAM_HOST,UPSTREAM_PORT,timeout=3)
            try:
                headers={'Host':f'{UPSTREAM_HOST}:{UPSTREAM_PORT}','Origin':f'http://127.0.0.1:{UPSTREAM_PORT}'}
                if body is not None:headers['Content-Type']='application/json'
                c.request(method,path,body,headers)
                r=c.getresponse(); data=r.read(128*1024)
                if r.status!=200:raise RuntimeError('Bridge HTTP '+str(r.status))
                return json.loads(data)
            finally:c.close()
        def do_GET(self):
            if not self.host_ok() or not self.trusted_client():self.send_error(403);return
            path=urllib.parse.urlsplit(self.path)
            if path.path=='/' and 'pair' in urllib.parse.parse_qs(path.query):
                token=urllib.parse.parse_qs(path.query)['pair'][0]
                if not hmac.compare_digest(token,self.server.secret):self.send_error(403);return
                self.send_response(303);self.send_header('Location','/')
                self.send_header('Referrer-Policy','no-referrer')
                self.send_header('Set-Cookie',f'{COOKIE}={self.server.secret}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400')
                self.send_header('Cache-Control','no-store');self.send_header('Content-Length','0');self.end_headers();return
            if not self.paired():self.send_error(403,'Pairing required: scan the fresh QR from OPEN_ANDROID_PAIRING.html on the Windows PC; opening the bare IP address cannot pair.');return
            if path.path=='/':
                self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8')
                self.send_header('Cache-Control','no-store');self.send_header('X-Frame-Options','DENY')
                self.send_header('Content-Length',str(len(page)));self.end_headers();self.wfile.write(page);return
            if path.path=='/api/state':
                try:self.reply_json(self.forward('GET','/api/state'))
                except (OSError,ValueError,RuntimeError):self.error_json(503,'Windows OSC v0.8 backend offline')
                return
            self.send_error(404)
        def do_POST(self):
            if not self.host_ok() or not self.trusted_client() or not self.paired() or not self.same_origin():
                self.send_error(403);return
            if self.path!='/api/send':self.send_error(404);return
            if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':self.send_error(415);return
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not (1<=length<=256):raise ValueError('invalid size')
                payload=json.loads(self.rfile.read(length))
                if not isinstance(payload,dict) or set(payload)!={'input_index','submix','target_db'}:raise ValueError('invalid command keys')
                i,o,v=payload['input_index'],payload['submix'],payload['target_db']
                if type(i) is not int or i not in INPUTS or type(o) is not str or o not in OUTPUTS or type(v) not in (int,float) or not -65<=v<=6:
                    raise ValueError('invalid input, submix or level')
                result=self.forward('POST','/api/send',json.dumps(payload))
                self.reply_json(result)
            except (ValueError,TypeError,OverflowError) as exc:self.error_json(400,str(exc))
            except (OSError,RuntimeError):self.error_json(503,'Windows OSC v0.8 backend offline')
    return Handler


def main():
    ap=argparse.ArgumentParser(description='Android companion proxy, with QR pairing and local-only OSC upstream')
    ap.add_argument('--ip',help='Windows private IPv4 address (automatically detected by default)')
    ap.add_argument('--port',type=int,default=LISTEN_PORT)
    ap.add_argument('--no-browser',action='store_true')
    args=ap.parse_args()
    ip=args.ip or private_address()
    addr=ipaddress.ip_address(ip)
    if not isinstance(addr,ipaddress.IPv4Address) or not addr.is_private or addr.is_loopback or addr.is_unspecified or addr.is_link_local or addr.is_multicast:
        ap.error('Android proxy binds to one private LAN IPv4 (e.g. 192.168.1.50), not public/loopback/WAN')
    secret=secrets.token_urlsafe(24)
    url=f'http://{ip}:{args.port}/?pair={secret}'
    qrfile=DATA_PATH/'OPEN_ANDROID_PAIRING.html'
    qrfile.write_text(qr_page(url),encoding='utf-8')
    try:server=ProxyServer((ip,args.port),make_handler(),secret,ip)
    except OSError as exc:
        print(f'Cannot bind Android companion at {ip}:{args.port}: {exc}',file=sys.stderr);return 2
    print('NCC-1337 Android LCARS Touch Mixer — OPTIONAL LAN-ONLY COMPANION\n'
          'Your original v0.8 OSC backend is unchanged at 127.0.0.1:8772.\n'
          f'Android connection: {ip}:{args.port} (requires QR pairing, same trusted home Wi-Fi).\n'
          f'Scan QR displayed at {qrfile}.\n'
          'If Windows Firewall asks, allow PRIVATE networks only. Never forward this port.\n'
          'Ctrl+C stops Android access. No audio command is sent until you drag a fader.\n',flush=True)
    if not args.no_browser:webbrowser.open(qrfile.as_uri())
    try:server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:print('\nAndroid companion stopping.')
    finally:server.server_close()
    return 0

if __name__=='__main__':raise SystemExit(main())
