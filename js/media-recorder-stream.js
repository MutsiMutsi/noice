export default class MediaRecorderStream {
    constructor() {
        this.mediaRecorder = null;
    }

    setup(stream, bitrate, codec) {
        this.stop();

        // Create a MediaRecorder instance
        const options = {
            audioBitsPerSecond: 16000 * 8,
            videoBitsPerSecond: bitrate,
            mimeType: codec,
        };
        this.mediaRecorder = new MediaRecorder(stream, options);


        // Optionally, handle recording stop/error events
        this.mediaRecorder.onstop = this.handleRecordingStop;
        this.mediaRecorder.onerror = this.handleRecordingError;
    }

    start(timeslice, ondata) {
        // Define an event listener to capture recorded chunks
        this.mediaRecorder.ondataavailable = ondata;

        // Start recording (adjust recording type and options as needed)
        this.mediaRecorder.start(timeslice); // Record in ms chunks
    }

    stop() {
        if (this.mediaRecorder != null) {
            this.mediaRecorder.stop();
            this.mediaRecorder.ondataavailable = undefined;
            this.mediaRecorder.onstop = undefined;
            this.mediaRecorder = undefined;
        }
    }

    handleRecordingStop() {
        console.log("Recording stopped.");
    }

    handleRecordingError(error) {
        console.error("Recording error:", error);
    }
}