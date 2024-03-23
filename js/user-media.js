import MediaRecorderStream from "./media-recorder-stream.js";

export default class UserMedia {

    videoTrack;
    audioTrack;
    recorder;
    sequenceNumber = -1;
    timeslice = 50;

    constructor(videoElement, codec) {
        this.videoElement = videoElement;
        this.codec = codec;
        this.recorder = new MediaRecorderStream();
    }

    async startWebcam(videoEnabled, onData) {
        this.sequenceNumber = -1;
        
        try {
            let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.videoElement.srcObject = stream;
            this.recorder.setup(stream, 100000, this.codec);
            this.recorder.start(this.timeslice, async (event) => {
                const recordedBlob = event.data; // This is the binary data chunk

                // Send the recordedBlob to your server using XHR or Fetch API (explained later)
                this.sequenceNumber++;
                await onData(recordedBlob, this.sequenceNumber);
            });

            this.videoTrack = stream.getTracks().find(track => track.kind === 'video');
            this.audioTrack = stream.getTracks().find(track => track.kind === 'audio');

            this.videoTrack.enabled = videoEnabled;
        } catch (error) {
            console.error("Error accessing media devices:", error);
            alert(`Error accessing media devices: ${error}`);
        }

    }

    async stop() {
        await this.recorder.stop();
        this.videoTrack.stop();
        this.audioTrack.stop();
        this.videoElement.pause();
        this.videoElement.src = "";
    }
}