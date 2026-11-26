import http.client
import json
import socket
import threading
import time
import unittest

from loop_test import INPUTS, OUTPUTS, OSCMonitor, decode_osc, osc_float, make_handler

class FakeSocket:
    def __init__(self): self.sent=[]
    def settimeout(self,_): pass
    def sendto(self,packet,target): self.sent.append((packet,target))
    def close(self): pass

class PacketTests(unittest.TestCase):
    def setUp(self):
        self.fake=FakeSocket()
        self.monitor=OSCMonitor(sock=self.fake)
    def tearDown(self):self.monitor.close()
    def test_10_exact_mapping_no_guesswork(self):
        self.assertEqual([x['index'] for x in INPUTS], [0,1,2,4,6,7,8,9,10,11])
        self.assertEqual(OUTPUTS, {'MAIN':0,'PHONES':2,'MON2':4})
        self.assertEqual([(x['index'],x['partner']) for x in INPUTS if x['stereo']], [(2,3),(4,5)])
    def test_refresh_packets_all_outputs(self):
        for output in OUTPUTS:self.monitor.refresh('manual',output)
        self.assertEqual([list(decode_osc(p))[0] for p,_ in self.fake.sent],
                         [('/sendsubmix/0',[1.0]),('/sendsubmix/2',[1.0]),('/sendsubmix/4',[1.0])])
        self.assertTrue(all(len(p)==24 for p,_ in self.fake.sent))
        self.assertEqual(self.monitor.snapshot()['manual_fader_packets_sent'],0)
    def test_matrix_30_messages_received_no_transmissions(self):
        for i in INPUTS:
            for output in OUTPUTS.values():
                self.monitor.accept_packet(osc_float(f'/mix/in/{i["index"]}/{output}/fader',-300.0 if i['index'] != 11 else -54.05))
        s=self.monitor.snapshot()
        self.assertEqual(len(s['inputs']),10)
        self.assertEqual(s['rx_fader_messages'],30)
        self.assertEqual(s['inputs'][0]['sends']['PHONES']['state'],'OFF')
        self.assertAlmostEqual(s['inputs'][9]['sends']['PHONES']['dB'],-54.05,3)
        self.assertEqual(self.fake.sent,[])
        self.assertEqual(s['automatic_fader_packets_sent'],0)
    def test_stereo_partner_is_telemetry_only(self):
        self.monitor.accept_packet(osc_float('/mix/in/3/2/fader',-13.5))
        self.monitor.accept_packet(osc_float('/mix/in/5/2/fader',-21.0))
        s=self.monitor.snapshot()
        self.assertEqual(s['inputs'][2]['partner_db']['PHONES'],-13.5)
        self.assertEqual(s['inputs'][3]['partner_db']['PHONES'],-21.0)
        self.assertEqual(self.fake.sent,[])
    def test_every_input_all_three_outputs_exactly_one_packet(self):
        for i in INPUTS:
            for name, out in OUTPUTS.items():
                self.monitor.send_fader(-54.05,i['index'],name)
                packet,target=self.fake.sent[-1]
                self.assertEqual(target,('127.0.0.1',7002))
                self.assertEqual(len(packet),28)
                path,args=list(decode_osc(packet))[0]
                self.assertEqual(path,f'/mix/in/{i["index"]}/{out}/fader')
                self.assertAlmostEqual(args[0],-54.05,3)
        s=self.monitor.snapshot()
        self.assertEqual(s['manual_fader_packets_sent'],30)
        self.assertEqual(s['automatic_fader_packets_sent'],0)
        self.assertEqual(len(self.fake.sent),30)
    def test_unmapped_index_output_and_invalid_values_rejected_without_tx(self):
        bad=[(-53,3,'PHONES'),(-53,5,'PHONES'),(-53,12,'PHONES'),(-53,-1,'MAIN'),
             (-53,0,'OTHER'),(-53,0,'phones'),(1e400,0,'MAIN'),(-66,0,'MAIN'),
             (8,0,'MAIN'),('0',0,'MAIN'),(True,0,'PHONES'),(-53,True,'MAIN')]
        for value,idx,out in bad:
            with self.subTest(value=value,index=idx,submix=out):
                with self.assertRaises(ValueError):self.monitor.send_fader(value,idx,out)
        self.assertEqual(self.fake.sent,[])
    def test_readback_matches_only_same_route_and_never_auto_resends(self):
        self.monitor.accept_packet(osc_float('/mix/in/0/0/fader',-20.0))
        self.monitor.send_fader(-20.5,0,'MAIN')
        self.monitor.accept_packet(osc_float('/mix/in/0/2/fader',-20.5))
        self.assertEqual(self.monitor.snapshot()['readback_status'],'AWAITING FEEDBACK')
        self.monitor.accept_packet(osc_float('/mix/in/0/0/fader',-20.5))
        self.assertEqual(self.monitor.snapshot()['readback_status'],'MATCHED')
        self.assertEqual(self.monitor.snapshot()['automatic_fader_packets_sent'],0)
        self.assertEqual(len(self.fake.sent),1)
    def test_loopback_udp_receiver_and_feedback_never_echoes(self):
        sender=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
        sender.bind(('127.0.0.1',0))
        sender.settimeout(1.5)
        monitor=OSCMonitor(listen_port=0,target_port=sender.getsockname()[1],refresh_interval=99)
        port=monitor.sock.getsockname()[1]
        try:
            monitor.start()
            # Initial scheduled refresh is read-only. Other submix queries can follow.
            first,_=sender.recvfrom(256)
            self.assertEqual(list(decode_osc(first))[0][0],'/sendsubmix/2')
            sender.sendto(osc_float('/mix/in/10/4/fader',-24.0),('127.0.0.1',port))
            for _ in range(50):
                if monitor.snapshot()['inputs'][8]['sends']['MON2']['state']=='OBSERVED':break
                time.sleep(.01)
            self.assertAlmostEqual(monitor.snapshot()['inputs'][8]['sends']['MON2']['dB'],-24.0,2)
            self.assertEqual(monitor.snapshot()['manual_fader_packets_sent'],0)
            self.assertEqual(monitor.snapshot()['automatic_fader_packets_sent'],0)
            # No outbound fader command is allowed until the explicit send method is invoked.
            monitor.send_fader(-24.5,10,'MON2')
            packets=[]
            for _ in range(5):
                packet,_=sender.recvfrom(256)
                packets.append(list(decode_osc(packet))[0][0])
                if '/mix/in/10/4/fader' in packets:break
            self.assertEqual(packets.count('/mix/in/10/4/fader'),1)
            sender.sendto(osc_float('/mix/in/10/4/fader',-24.5),('127.0.0.1',port))
            for _ in range(50):
                if monitor.snapshot()['readback_status']=='MATCHED':break
                time.sleep(.01)
            self.assertEqual(monitor.snapshot()['readback_status'],'MATCHED')
            self.assertEqual(monitor.snapshot()['manual_fader_packets_sent'],1)
            self.assertEqual(monitor.snapshot()['automatic_fader_packets_sent'],0)
        finally:
            monitor.close();sender.close()

    def test_unknown_osc_and_remote_packet_dont_update_or_tx(self):
        self.monitor.accept_packet(osc_float('/mix/in/0/0/fader',-21),('192.168.1.50',9002))
        self.monitor.accept_packet(osc_float('/mix/in/99/0/fader',-21))
        self.monitor.accept_packet(osc_float('/mix/in/0/99/fader',-21))
        self.assertTrue(all(x['sends']['MAIN']['state']=='UNAVAILABLE' for x in self.monitor.snapshot()['inputs']))
        self.assertEqual(self.fake.sent,[])

class HttpTests(unittest.TestCase):
    def setUp(self):
        self.fake=FakeSocket();self.monitor=OSCMonitor(sock=self.fake)
        self.server=__import__('http.server',fromlist=['ThreadingHTTPServer']).ThreadingHTTPServer(('127.0.0.1',0),make_handler(self.monitor))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.monitor.close()
    def req(self,method,path,body=None,origin='http://homeassistant.local'):
        c=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=2)
        headers={'Origin':origin}
        if method=='POST':headers['Content-Type']='application/json'
        c.request(method,path,json.dumps(body) if isinstance(body,dict) else body,headers)
        r=c.getresponse();data=r.read();status=r.status;c.close()
        try:
            payload=json.loads(data) if data else None
        except json.JSONDecodeError:
            payload=data.decode('utf-8',errors='replace')
        return status,payload
    def test_get_state_no_commands(self):
        status,body=self.req('GET','/api/state')
        self.assertEqual(status,200)
        self.assertEqual(len(body['inputs']),10)
        self.assertEqual(self.fake.sent,[])
    def test_one_manual_post_one_packet(self):
        status,_=self.req('POST','/api/send',{'target_db':-20.5,'input_index':2,'submix':'MON2'})
        self.assertEqual(status,200)
        self.assertEqual(len(self.fake.sent),1)
        self.assertEqual(list(decode_osc(self.fake.sent[0][0]))[0][0],'/mix/in/2/4/fader')
    def test_unmapped_route_rejected(self):
        status,_=self.req('POST','/api/send',{'target_db':-20.5,'input_index':3,'submix':'MON2'})
        self.assertEqual(status,400)
        self.assertEqual(self.fake.sent,[])
    def test_cross_origin_post_rejected(self):
        status,_=self.req('POST','/api/send',{'target_db':-20.5,'input_index':0,'submix':'MAIN'},origin='https://untrusted.example')
        self.assertEqual(status,403)
        self.assertEqual(self.fake.sent,[])
    def test_refresh_not_audio_command(self):
        status,_=self.req('POST','/api/refresh',{'submix':'MAIN'})
        self.assertEqual(status,200)
        self.assertEqual(list(decode_osc(self.fake.sent[0][0]))[0],('/sendsubmix/0',[1.0]))
        self.assertEqual(self.monitor.snapshot()['manual_fader_packets_sent'],0)

if __name__=='__main__':unittest.main(verbosity=2)
