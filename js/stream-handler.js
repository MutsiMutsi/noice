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
        this.initializationBuffer = new Uint8Array();
        this.initializationBufferComplete = false;
    }

    async receive(payload, codec) {
        this.lastUsedCodec = codec;

        await this.semaphoreRead.acquire(); // Acquire semaphore before processing
        try {

            this.debugPanel.addDown(payload.byteLength);

            var arrayBuffer = payload.buffer.slice(payload.byteOffset, payload.byteLength + payload.byteOffset);
            const sequenceNumber = new DataView(arrayBuffer, 0, SEQUENCE_NUMBER_BYTE_LENGTH).getUint32(0);

            // Extract the media chunk data
            const chunkData = new Uint8Array(payload.byteLength - SEQUENCE_NUMBER_BYTE_LENGTH);
            chunkData.set(payload.slice(SEQUENCE_NUMBER_BYTE_LENGTH));


            let startFromCluster = false;

            if (sequenceNumber == 0) {
                this.sourceBuffer = await setupRemoteVideo(codec);
                this.cachedChunks = {};
                this.expectedSequenceNumber = 0;
            } else {
                if (this.expectedSequenceNumber == -1) {

                    //Find cluster.
                    let clusterId = this.findClusterStart(new DataView(chunkData.buffer));
                    console.log('cluster index', clusterId);

                    if (clusterId == -1) {
                        console.log('discarding - waiting for cluster');
                        return;
                    }
                    console.log('cluster found start playback!!!');

                    this.expectedSequenceNumber = sequenceNumber;
                    startFromCluster = true;

                    //const webmHeader = 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua+quvdeBAXPFh66utjP2AduDgQKGhkFfT1BVU2Oik09wdXNIZWFkAQEAAIC7AAAAAADhjbWERzuAAJ+BAWJkgSCuqdeBAnPFh323mHH8e4CDgQFV7oEBhoVWX1ZQOeCMsIICgLqCAeBTwIEB';
                    //const headerChunk = Uint8Array.from(atob(webmHeader), c => c.charCodeAt(0))
                    //await this.handleChunk(headerChunk);
                }
            }


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

            if (startFromCluster) {
                videoRemoteElement.currentTime = 9999999999;
            }

        } finally {
            this.semaphoreRead.release();
        }
    }

    async handleChunk(chunk, shouldStartVideo = true) {
        this.sourceBuffer.appendBuffer(chunk);

        while (true) {
            if (!this.sourceBuffer.updating) break
            await Utility.sleep(5);
        }

        //Check for errors:
        if (shouldStartVideo) {
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

            const chunkWithSequenceNumber = new Uint8Array(SEQUENCE_NUMBER_BYTE_LENGTH + chunkData.byteLength);
            chunkWithSequenceNumber.set(sequenceNumberBytes);
            chunkWithSequenceNumber.set(chunkData, SEQUENCE_NUMBER_BYTE_LENGTH);

            await this.client.send(address, chunkWithSequenceNumber, { noReply: true });

            this.debugPanel.addUp(this.reader.result.byteLength);
        } finally {
            this.semaphoreSend.release(); // Release semaphore after all steps complete
        }
    }

    async publish(topic, blob, sequenceNumber) {
        await this.semaphoreSend.acquire();

        /*if (sequenceNumber == 0) {
            this.webmHeader = await this.getWebMHeaders(blob);
        } else {
            if (this.webmHeader?.byteLength > 0 && sequenceNumber & 10 == 0) {
                debugger;
                blob = new Blob([this.webmHeader, await blob.arrayBuffer()], { type: blob.type });
            }
        }*/

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

            const chunkWithSequenceNumber = new Uint8Array(SEQUENCE_NUMBER_BYTE_LENGTH + chunkData.byteLength);
            chunkWithSequenceNumber.set(sequenceNumberBytes);
            chunkWithSequenceNumber.set(chunkData, SEQUENCE_NUMBER_BYTE_LENGTH);

            //Find cluster
            if (!this.initializationBufferComplete) {
                this.initializationBuffer = Utility.appendUint8Array(this.initializationBuffer, chunkData);
                let clusterId = this.findClusterStart(new DataView(chunkData.buffer));
                console.log('cluster index', clusterId);
                if (clusterId > -1) {
                    this.initializationBufferComplete = true;
                    this.sourceBuffer = await setupRemoteVideo(blob.type);
                    await this.handleChunk(this.initializationBuffer);
                }
            } else {
                await this.handleChunk(chunkData);
            }

            this.client.publish(topic, chunkWithSequenceNumber, { txPool: true });

            this.debugPanel.addUp(this.reader.result.byteLength);
        } finally {
            this.semaphoreSend.release(); // Release semaphore after all steps complete
        }
    }

    async getWebMHeaders(blob) {
        const sampleArrayBuffer = await blob.arrayBuffer();
        const headerView = new Uint8Array(sampleArrayBuffer);

        // Find the end of the header based on specific byte sequence (e.g., 1f 43 b6 75 for EBML)
        let headerEnd = 0;
        for (let i = 0; i < headerView.length; i++) {
            if (headerView[i] === 0x1f && headerView[i + 1] === 0x43 &&
                headerView[i + 2] === 0xb6 && headerView[i + 3] === 0x75) {
                headerEnd = i;
                break;
            }
        }

        // Slice the header data from the sample Blob
        return sampleArrayBuffer.slice(0, headerEnd);
    }

    findClusterStart(dataView) {
        let offset = 0;

        while (offset < dataView.byteLength - 8) {
            const clusterId = dataView.getUint32(offset, false); // Read first 4 bytes as unsigned integer

            if (clusterId === 0x1F43B675) { // Check for cluster identification pattern
                return offset;
            }

            // Skip ahead if not the cluster ID (potentially incomplete data)
            offset += Math.min(4, dataView.byteLength - offset); // Avoid out-of-bounds access
        }

        // Cluster start not found in the provided data
        return -1;
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