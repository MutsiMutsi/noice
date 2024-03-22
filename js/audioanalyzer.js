class AudioAnalyzer {
    constructor(videoElement) {
        window.context = new AudioContext();
        let video = context.createMediaElementSource(videoElement);
        let analyser = context.createAnalyser(); //we create an analyser
        analyser.smoothingTimeConstant = 0.95;
        analyser.fftSize = 128; //the total samples are half the fft size.
        video.connect(analyser);
        analyser.connect(context.destination);

        function getAvg() {
            var array = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(array);

            var average = 0;
            var max = 0;
            for (let i = 0; i < array.length; i++) {
                let a = Math.abs(array[i] - 128);
                average += a;
                max = Math.max(max, a);
            }

            average /= array.length;
        }

        setInterval(() => {
            getAvg();
        }, timeslice);
    }
}