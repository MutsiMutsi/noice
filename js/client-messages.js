export default class ClientMessages {

    dialCancelled = false;
    onCallAccepted = null;
    onCallDenied = null;

    constructor(client) {
        this.client = client;
    }

    sendChatMessage(addr, msg) {
        let textMsg = { type: 'text', content: msg };
        this.client.send(addr, JSON.stringify(textMsg));
    }

    sendDial(addr, isVideoEnabled, codec) {
        this.dialCancelled = false;
        let msg = { type: 'dial', videoEnabled: isVideoEnabled, codec: codec };
        this.client.send(addr, JSON.stringify(msg), { responseTimeout: 30000 }).then((reply) => {
            if (this.dialCancelled) {
                return;
            }
            let obj = JSON.parse(reply);
            if (obj.type == 'dial_accept') {
                this.onCallAccepted(obj.codec);
            } else {
                this.onCallDenied();
            }
        }).catch((e) => {
            // This will most likely to be timeout
            this.onCallDenied();
        });
    }

    cancelDial() {
        this.dialCancelled = true;
    }
}