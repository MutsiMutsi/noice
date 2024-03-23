import { Utility } from "./util.js";

export default class ClientFactory {
    constructor(numClients) {
        this.numSubClients = numClients;
        this.targetClients = numClients;
        this.onConnectionsUpdated;
        this.seed = '';
    }

    async setup() {
        let client = new nkn.MultiClient({
            numSubClients: this.targetClients,
            originalClient: false,
            seed: this.seed,
            //tls: true,
        });

        this.seed = client.key.seed;

        let connectedNodes = 0;
        let failedNodes = 0;

        for (const [key, value] of Object.entries(client.clients)) {
            value.eventListeners.connect.push(() => {
                connectedNodes++;
                if (this.onConnectionsUpdated != null) {
                    this.onConnectionsUpdated(connectedNodes, failedNodes);
                }
            });

            value.eventListeners.connectFailed.push(() => {
                console.warn(key, 'failed');
                failedNodes++;
                if (this.onConnectionsUpdated != null) {
                    this.onConnectionsUpdated(connectedNodes, failedNodes);
                }
            });
        }

        while (connectedNodes + failedNodes < this.targetClients) {
            await Utility.sleep(50);
        }


        if (connectedNodes >= this.numSubClients) {
            return client;
        } else {
            await Utility.sleep(1000);
            this.targetClients += failedNodes;
            console.log('try again:', this.targetClients);
            return this.setup(this.targetClients);
        }
    }
}