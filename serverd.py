#!/usr/bin/env python3
import time
import sys
import json
import argparse
import uuid
from base64 import b64encode

from twisted.internet import reactor
from twisted.internet.task import LoopingCall
from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.twisted.websocket import WebSocketServerFactory

from txzmq import ZmqEndpoint, ZmqEndpointType
from txzmq import ZmqFactory
from txzmq import ZmqSubConnection

from pyln.client import LightningRpc

RPC_FILE = "/home/abc/.lightning/bitcoin/lightning-rpc"

###############################################################################

rpc = LightningRpc(RPC_FILE)

class Daemon(object):
    def __init__(self):
        self.rpc = LightningRpc(RPC_FILE)

    def _gen_new_label(self):
        label_bytes = uuid.uuid4().bytes
        label_str = b64encode(label_bytes).decode("utf8")
        return label_str

    def invoice(self):
        msatoshis = 12000
        description = "fuck you, pay me"
        label = self._gen_new_label()
        i = self.rpc.invoice(msatoshis, label, description)
        return {'label': label, 'bolt11': i['bolt11']}

DAEMON = Daemon()

###############################################################################


class AppClient(WebSocketServerProtocol):
    def __init__(self):
        super().__init__()
        self.uuid = uuid.uuid4()
        self.server.clients[self.uuid] = self

    def notify(self, info):
        msg = json.dumps(info).encode("utf8")
        self.sendMessage(msg)

    def request_new_invoice(self):
        i = DAEMON.invoice()
        i['notification_type'] = "INVOICE"
        self.notify(i)

    def notify_invoice_paid(self, label, msats):
        i = {'notification_type': "INVOICE_PAID",
             'label':             label,
             'msats':             msats}
        self.notify(i)

    ###########################################################################

    def onConnect(self, request):
        print("Client connecting: {0}".format(request.peer))

    def onOpen(self):
        print("WebSocket client connection open.")

    def onMessage(self, payload, isBinary):
        if isBinary:
            print("got binary request")
            return
        payload = json.loads(payload.decode("utf8"))
        request_type = payload['request_type']
        if request_type == "INVOICE":
            self.request_new_invoice()
        else:
            print("unknown request %s" % request_type)

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))
        if self.uuid in self.server.clients:
            del self.server.clients[self.uuid]

###############################################################################

class AppServer(WebSocketServerFactory):
    def __init__(self, port, app):
        ws_url = u"ws://127.0.0.1:%d" % port
        super().__init__()
        self.setProtocolOptions(openHandshakeTimeout=15, autoPingInterval=30,
                                autoPingTimeout=5)
        self.protocol = AppClient
        self.protocol.server = self
        self.clients = {}
        print("listening on websocket %s" % ws_url)
        reactor.listenTCP(port, self)
        self.app = app

    def echo_invoice_payment(self, label, msat):
        for c in self.clients.values():
            c.notify_invoice_paid(label, msat)

###############################################################################

INVOICE_PAYMENT_TAG = "invoice_payment".encode("utf8")

class App(object):
    def __init__(self, endpoint, port):
        self.endpoint = endpoint
        self.port = port

    ###########################################################################


    def setup_websocket(self):
        self.ws_server = AppServer(self.port, self)

    ###########################################################################

    def setup_zmq(self):
        zmq_factory = ZmqFactory()
        print("subscribing on: %s" % self.endpoint)
        sub_endpoint = ZmqEndpoint(ZmqEndpointType.connect, self.endpoint)
        sub_connection = ZmqSubConnection(zmq_factory, sub_endpoint)
        sub_connection.gotMessage = self.zmq_message
        sub_connection.subscribe(INVOICE_PAYMENT_TAG)

    def invoice_payment_message(self, message):
        d = json.loads(message.decode('utf8'))['invoice_payment']
        print("got %s" % json.dumps(d, indent=1))
        self.ws_server.echo_invoice_payment(d['label'], d['msat'])

    def zmq_message(self, message, tag):
        if tag == INVOICE_PAYMENT_TAG:
            self.invoice_payment_message(message)
        else:
            sys.exit("unknown tag: %s" % tag)

    ###########################################################################

    def run(self):
        self.setup_websocket()
        self.setup_zmq()

    def stop(self):
        pass


###############################################################################

DEFAULT_WEBSOCKET_PORT = 9000

DEFAULT_ZMQ_SUBSCRIBE_ENDPOINT = "tcp://127.0.0.1:6666"

parser = argparse.ArgumentParser(prog="serverd.py")
parser.add_argument("-e", "--endpoint", type=str,
                    default=DEFAULT_ZMQ_SUBSCRIBE_ENDPOINT,
                    help="endpoint to subscribe to for zmq notifications from "
                          "c-lightning via cl-zmq.py plugin")
parser.add_argument("-w", "--websocket-port", type=int,
                    default=DEFAULT_WEBSOCKET_PORT,
                    help="port to listen for incoming websocket connections")
settings = parser.parse_args()

a = App(settings.endpoint, settings.websocket_port)
a.run()


reactor.addSystemEventTrigger("before", "shutdown", a.stop)

reactor.run()
