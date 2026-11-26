import http.client
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import android_proxy as proxy


class Upstream(BaseHTTPRequestHandler):
    received=[]
    def log_message(self,*args):pass
    def do_GET(self):
        self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers()
        self.wfile.write(json.dumps({'version':'0.8','inputs':[{}]*10,'manual_fader_packets_sent':0}).encode())
    def do_POST(self):
        payload=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
        self.received.append(payload)
        self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers()
        self.wfile.write(b'{"sent":true}')

class ProxyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.up=ThreadingHTTPServer(('127.0.0.1',0),Upstream)
        proxy.UPSTREAM_PORT=cls.up.server_port
        cls.ut=threading.Thread(target=cls.up.serve_forever,daemon=True);cls.ut.start()
        cls.server=proxy.ProxyServer(('127.0.0.1',0),proxy.make_handler(),'randomSecretExample123','127.0.0.1')
        cls.st=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.st.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.up.shutdown();cls.up.server_close()
    def req(self,method,path='/',cookie='',origin=None,body=None,host=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        headers={'Host':host or f'127.0.0.1:{self.server.server_port}'}
        if cookie:headers['Cookie']=cookie
        if origin is not None:headers['Origin']=origin
        if body is not None:headers['Content-Type']='application/json';body=json.dumps(body)
        conn.request(method,path,body,headers);r=conn.getresponse();data=r.read();status=r.status
        cookie=r.getheader('Set-Cookie');loc=r.getheader('Location');conn.close()
        return status,data,cookie,loc
    def paired_cookie(self):
        code,_data,cookie,loc=self.req('GET','/?pair=randomSecretExample123')
        self.assertEqual(code,303);self.assertEqual(loc,'/');self.assertIn('SameSite=Lax',cookie)
        return cookie.split(';')[0]
    def test_unpaired_and_malicious_rejected(self):
        self.assertEqual(self.req('GET')[0],403)
        self.assertIn(b'Pairing required',self.req('GET')[1])
        self.assertEqual(self.req('GET','/?pair=wrong')[0],403)
        self.assertEqual(self.req('POST','/api/send',body={'input_index':0,'submix':'MAIN','target_db':-20})[0],403)
        self.assertEqual(self.req('GET',host='evil.invalid:8773')[0],403)
    def test_paired_mobile_html_and_poll_no_audio_commands(self):
        cookie=self.paired_cookie()
        status,data,*_=self.req('GET','/',cookie)
        self.assertEqual(status,200);self.assertIn(b'ANDROID MULTI-TOUCH',data)
        self.assertIn(b'pointerdown',data);self.assertIn(b'pointermove',data)
        before=len(Upstream.received)
        status,data,*_=self.req('GET','/api/state',cookie)
        self.assertEqual(status,200);self.assertEqual(json.loads(data)['version'],'0.8')
        self.assertEqual(len(Upstream.received),before)
    def test_explicit_send_allowlisted_and_strict_origin(self):
        cookie=self.paired_cookie()
        o=f'http://127.0.0.1:{self.server.server_port}'
        payload={'input_index':2,'submix':'MON2','target_db':-35.25}
        before=len(Upstream.received)
        self.assertEqual(self.req('POST','/api/send',cookie,origin='http://evil.invalid',body=payload)[0],403)
        self.assertEqual(self.req('POST','/api/send',cookie,origin=o,body={**payload,'input_index':3})[0],400)
        self.assertEqual(self.req('POST','/api/send',cookie,origin=o,body={**payload,'submix':'FOO'})[0],400)
        self.assertEqual(self.req('POST','/api/send',cookie,origin=o,body=payload)[0],200)
        self.assertEqual(len(Upstream.received),before+1)
        self.assertEqual(Upstream.received[-1],payload)
    def test_qr_svg_is_local_self_contained(self):
        svg=proxy.qr_svg('http://192.168.1.16:8773/?pair=secret')
        self.assertIn('<svg',svg);self.assertIn('path d=',svg)
        self.assertNotIn('<image',svg)

if __name__=='__main__':unittest.main(verbosity=2)
