console.log("zaaaap");
const WEBSOCKET = "ws://localhost:9000";

const QRious = require('qrious');

var AppSocket;

function DeleteChildren(id) {
    const n = document.getElementById(id);
    n.innerHTML = "";
}

function Click() {
    console.log("clicked");
    const req = {"request_type": "INVOICE"};
    AppSocket.send(JSON.stringify(req));
}

function DisplayQr(bolt11) {
    DeleteChildren("qr-canvas");
    DeleteChildren("qr-text");

    var c = document.getElementById("qr-canvas");
    var b11 = bolt11.toUpperCase();
    var qr = new QRious({
        element: c,
        level: "M",
        padding: null,
        size: 350,
        value: b11,
    });

    var t = document.getElementById("qr-text");
    var pre = document.createElement("pre");
    pre.setAttribute("id", "bolt11-text");
    pre.setAttribute("style", "height: 12em; width: 60em; white-space: pre-wrap; color:black; background-color: white; word-wrap: break-word")
    pre.innerHTML = bolt11;
    t.appendChild(pre);
}

function DisplayPaid(msats) {
    var p = document.getElementById("paid-invoices");
    var t = document.createTextNode("OM NOM: " + msats);
    p.appendChild(t);
}


function CreateButtons() {
    var buttons = document.getElementById("buttons");

    var b = document.createElement("button");
    var t = document.createTextNode("Can I Pay You?");
    b.appendChild(t);
    b.onclick = function() {
        console.log("click");
        Click();
    };
    buttons.appendChild(b);
}

function WsMessageReceived(event) {
    console.log("received: " + event.data);
    const data = JSON.parse(event.data);
    if (data.notification_type == "INVOICE") {
        DisplayQr(data.bolt11);
    } else if (data.notification_type == "INVOICE_PAID") {
        DisplayPaid(data.msats);
    } else {
        console.log("unknown notification: " + data.notification_type);
    }
}

function ConnectUponLoad() {
    console.log("connecting");
    AppSocket = new WebSocket(WEBSOCKET);
    AppSocket.onmessage = WsMessageReceived;
    console.log("connected");
}

window.addEventListener("load", ConnectUponLoad());


window.onload = function() {
    console.log("onload");
    CreateButtons();
};
