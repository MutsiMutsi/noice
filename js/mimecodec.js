export default class MimeCodec {

    videoTypes = ["webm", "ogg", "mp4", "x-matroska"];
    audioTypes = ["webm", "ogg", "mp3", "x-matroska"];
    codecs = ["should-not-be-supported", "vp9", "vp9.0", "vp8", "vp8.0", "avc1", "av1", "h265", "h.265", "h264", "h.264", "opus", "pcm", "aac", "mpeg", "mp4a"];

    constructor() {
        this.supportedVideos = this.getSupportedMimeTypes("video", this.videoTypes, this.codecs);
        this.supportedAudios = this.getSupportedMimeTypes("audio", this.audioTypes, this.codecs);
    }

    getVideoCodec() {
        return this.supportedVideos[0] + ',opus';
    }

    getSupportedMimeTypes(media, types, codecs) {
        const isSupported = MediaRecorder.isTypeSupported;
        const supported = [];
        types.forEach((type) => {
            const mimeType = `${media}/${type}`;
            codecs.forEach((codec) => [
                `${mimeType};codecs=${codec}`,
                `${mimeType};codecs=${codec.toUpperCase()}`,
                // /!\ false positive /!\
                // `${mimeType};codecs:${codec}`,
                // `${mimeType};codecs:${codec.toUpperCase()}` 
            ].forEach(variation => {
                if (isSupported(variation))
                    supported.push(variation);
            }));
            if (isSupported(mimeType))
                supported.push(mimeType);
        });
        return supported;
    };
}