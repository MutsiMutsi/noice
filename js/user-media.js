import MediaRecorderStream from "./media-recorder-stream.js";
import { Utility } from "./util.js";

export default class UserMedia {

    videoTrack;
    audioTrack;
    recorder;
    sequenceNumber = -1;
    timeslice = 50;

    webcamStream;
    screenshareStream;

    isScreensharing;

    constructor(videoElement, codec) {
        this.videoElement = videoElement;
        this.codec = codec;
        this.recorder = new MediaRecorderStream();
    }

    async startWebcam(videoEnabled, onData, quality = 100000) {
        this.sequenceNumber = -1;

        try {
            this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.videoElement.srcObject = this.webcamStream;
            this.recorder.setup(this.webcamStream, quality, this.codec);
            this.recorder.start(this.timeslice, async (event) => {
                const recordedBlob = event.data; // This is the binary data chunk

                // Send the recordedBlob to your server using XHR or Fetch API (explained later)
                this.sequenceNumber++;
                await onData(recordedBlob, this.sequenceNumber);
            });

            this.videoTrack = this.webcamStream.getTracks().find(track => track.kind === 'video');
            this.audioTrack = this.webcamStream.getTracks().find(track => track.kind === 'audio');
            this.videoTrack.enabled = videoEnabled;
        } catch (error) {
            console.error("Error accessing media devices:", error);
            alert(`Error accessing media devices: ${error}`);
        }
    }

    async startScreenshare() {
        try {
            this.screenshareStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            this.videoElement.srcObject = this.screenshareStream;
            this.screenShareTrack = this.screenshareStream.getTracks().find(track => track.kind === 'video');
            this.screenShareAudioTrack = this.screenshareStream.getTracks().find(track => track.kind === 'audio');

            this.recorder.mediaRecorder.stop();
            await Utility.sleep(1000);

            this.sequenceNumber = -1;
            this.recorder.mediaRecorder.stream.removeTrack(this.videoTrack);
            this.recorder.mediaRecorder.stream.addTrack(this.screenShareTrack);


            if (this.screenShareAudioTrack != null) {
                const mixedAudio = this.mixAudio();
                const mixAudioStream = mixedAudio.stream;
                this.mixAudioTrack = mixAudioStream.getAudioTracks()[0];
                this.recorder.mediaRecorder.stream.removeTrack(this.audioTrack);
                this.recorder.mediaRecorder.stream.addTrack(this.mixAudioTrack);
            }

            this.recorder.mediaRecorder.start(this.timeslice);
            this.isScreensharing = true;

        } catch (error) {
            console.error("Error accessing media devices:", error);
            alert(`Error accessing media devices: ${error}`);
            this.isScreensharing = false;
        }
        finally {
            return this.isScreensharing;
        }
    }

    mixAudio() {
        const audioContext = new AudioContext();
        const webcamAudioNode = audioContext.createMediaStreamSource(this.webcamStream);
        const screenAudioNode = audioContext.createMediaStreamSource(this.screenshareStream);


        const webcamGain = audioContext.createGain();
        webcamAudioNode.connect(webcamGain);
        const screenGain = audioContext.createGain();
        screenAudioNode.connect(screenGain);

        const mixAudio = audioContext.createMediaStreamDestination();
        audioContext.createGain().connect(mixAudio);

        webcamGain.connect(mixAudio);
        screenGain.connect(mixAudio);

        return mixAudio;
    }

    async stopScreenshare() {
        this.isScreensharing = false;
        this.recorder.mediaRecorder.stop();
        await Utility.sleep(1000);

        this.sequenceNumber = -1;
        this.recorder.mediaRecorder.stream.removeTrack(this.screenShareTrack);
        this.recorder.mediaRecorder.stream.addTrack(this.videoTrack);

        if (this.mixAudioTrack != null) {
            this.recorder.mediaRecorder.stream.removeTrack(this.mixAudioTrack);
            this.recorder.mediaRecorder.stream.addTrack(this.audioTrack);
        }

        this.videoElement.srcObject = this.webcamStream;
        this.recorder.mediaRecorder.start(50);
    }

    async stop() {
        await this.recorder.stop();
        this.videoTrack.stop();
        this.audioTrack.stop();
        this.videoElement.pause();
        this.videoElement.src = "";
    }
}