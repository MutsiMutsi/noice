import { Semaphore, Utility } from "./util.js";

const SEQUENCE_NUMBER_BYTE_LENGTH = 4; // Number of bytes used for sequence number

export default class StreamHandler {

    constructor(client, debugPanel) {
        this.client = client;
        this.debugPanel = debugPanel;

        this.semaphoreSend = new Semaphore(1);
        this.semaphoreRead = new Semaphore(1);
        this.reader = new FileReader(); // Create a single FileReader instance
        this.cachedChunks = {};
        this.expectedSequenceNumber = 0;
        this.sourceBuffer = null;
    }

    async receive(payload, codec) {
        this.lastUsedCodec = codec;

        await this.semaphoreRead.acquire(); // Acquire semaphore before processing
        try {

            this.debugPanel.addDown(payload.byteLength);

            var arrayBuffer = payload.buffer.slice(payload.byteOffset, payload.byteLength + payload.byteOffset);
            const sequenceNumber = new DataView(arrayBuffer, 0, SEQUENCE_NUMBER_BYTE_LENGTH).getUint32(0);

            if (sequenceNumber == 0) {
                this.sourceBuffer = await setupRemoteVideo(codec);
                this.cachedChunks = {};
                this.expectedSequenceNumber = 0;

                this.chunkZero = payload;
            }

            // Extract the media chunk data
            const chunkData = new Uint8Array(payload.byteLength - SEQUENCE_NUMBER_BYTE_LENGTH);
            chunkData.set(payload.slice(SEQUENCE_NUMBER_BYTE_LENGTH));

            if (sequenceNumber - this.expectedSequenceNumber > 10) {
                this.expectedSequenceNumber++;
                // Process any cached chunks in sequence
                while (this.cachedChunks[this.expectedSequenceNumber]) {
                    await this.handleChunk(this.cachedChunks[this.expectedSequenceNumber]);
                    delete this.cachedChunks[this.expectedSequenceNumber];
                    this.expectedSequenceNumber++;
                }
                videoRemoteElement.currentTime = 9999999;
                this.debugPanel.droppedChunks++;
                this.debugPanel.updateDebugLabel();
            }

            if (sequenceNumber === this.expectedSequenceNumber) {
                await this.handleChunk(chunkData);
                this.expectedSequenceNumber++;

                // Process any cached chunks in sequence
                while (this.cachedChunks[this.expectedSequenceNumber]) {
                    await this.handleChunk(this.cachedChunks[this.expectedSequenceNumber]);
                    delete this.cachedChunks[this.expectedSequenceNumber];
                    this.expectedSequenceNumber++;
                }
            } else {
                this.debugPanel.outOfSequenceChunks++;
                this.cachedChunks[sequenceNumber] = chunkData;
            }
        } finally {
            this.semaphoreRead.release();
        }
    }

    async handleChunk(chunk) {

        this.sourceBuffer.appendBuffer(chunk);

        while (true) {
            if (!this.sourceBuffer.updating) break
            await Utility.sleep(5);
        }

        //Check for errors:
        if (videoRemoteElement.error != null) {
            //TODO: research better more consisten ways to recover from dropped chunks
            //or joining streams midway-through.
            const lastTime = videoRemoteElement.currentTime;
            this.sourceBuffer = await setupRemoteVideo(this.lastUsedCodec);
            videoRemoteElement.currentTime = lastTime;
        }
        else {
            var isPlaying = videoRemoteElement.currentTime > 0 && !videoRemoteElement.paused && !videoRemoteElement.ended
                && videoRemoteElement.readyState > videoRemoteElement.HAVE_CURRENT_DATA;

            if (!isPlaying) {
                videoRemoteElement.play();
            }
        }
    }

    async send(address, blob, sequenceNumber) {
        await this.semaphoreSend.acquire();
        try {
            this.reader.readAsArrayBuffer(blob);

            await new Promise((resolve, reject) => {
                this.reader.onload = function (e) {
                    resolve(e.target.result);
                };
                this.reader.onerror = function (error) {
                    reject(error);
                };
            });

            let chunkData = new Uint8Array(this.reader.result);
            const sequenceNumberBytes = new Uint8Array(SEQUENCE_NUMBER_BYTE_LENGTH); // Adjust byte size for sequence number range
            new DataView(sequenceNumberBytes.buffer).setUint32(0, sequenceNumber);

            //FORCE DROP RANDOM CHUNKS FOR RESILIENCY TESTING
            /*if (sequenceNumber == 10 || Math.random() < 0.01) {
                console.warn("DROPPING THIS CHUNK");
                return;
            }*/

            const chunkWithSequenceNumber = new Uint8Array(SEQUENCE_NUMBER_BYTE_LENGTH + chunkData.byteLength);
            chunkWithSequenceNumber.set(sequenceNumberBytes);
            chunkWithSequenceNumber.set(chunkData, SEQUENCE_NUMBER_BYTE_LENGTH);

            await this.client.send(address, chunkWithSequenceNumber, { noReply: true });
            this.debugPanel.addUp(this.reader.result.byteLength);
        } finally {
            this.semaphoreSend.release(); // Release semaphore after all steps complete
        }
    }

    async stop() {
        await this.semaphoreSend.acquire();
        await this.semaphoreRead.acquire();

        this.cachedChunks = {};
        this.expectedSequenceNumber = 0;
        this.sourceBuffer = null;

        this.semaphoreSend.release();
        this.semaphoreRead.release();
    }
}