import { MovingByteRate, Utility } from "./util.js";

export default class DebugPanel {

    bytesReadMA = new MovingByteRate(1);
    bytesWrittenMA = new MovingByteRate(1);
    upChunks = 0;
    downChunks = 0;
    bytesRead = 0;
    bytesWritten = 0;

    droppedChunks = 0;
    outOfSequenceChunks = 0;

    rtt = 0;

    constructor() {

    }

    addDown(bytes) {
        this.downChunks++;
        this.bytesRead += bytes;
        this.bytesReadMA.addBytes(bytes);
        this.updateDebugLabel();
    }

    addUp(bytes) {
        this.upChunks++;
        this.bytesWritten += bytes;
        this.bytesWrittenMA.addBytes(bytes);
        this.updateDebugLabel();
    }

    updateDebugLabel() {
        let behindTime = videojs.players.remoteVideo.liveTracker.seekableEnd() - videojs.players.remoteVideo.currentTime();

        let str = `DOWN: [${this.downChunks}] ${Utility.humanFileSize(this.bytesRead, true, 1)} ${(Utility.humanFileSize(this.bytesReadMA.getByteRate(), true, 1))}/s
                UP: [${this.upChunks}] ${Utility.humanFileSize(this.bytesWritten, true, 1)} ${(Utility.humanFileSize(this.bytesWrittenMA.getByteRate(), true, 1))}/s
                DROPPED CHUNKS: ${this.droppedChunks}
                OUT OF SEQUENCE CHUNKS: ${this.outOfSequenceChunks}
                BUFFER TIME: ${(behindTime).toFixed(2)}s
                RTT: ${(this.rtt / 1000.0).toFixed(2)}s`;

        document.getElementById('bandwidthLabel').innerText = str;
    }
}