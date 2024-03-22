import ClientFactory from "./js/client-factory.js";
import MimeCodec from "./js/mimecodec.js";
import MediaRecorderStream from "./js/media-recorder-stream.js";
import TextChat from "./js/text-chat.js";
import ClientMessages from "./js/client-messages.js";
import DebugPanel from "./js/debug-panel.js";

(async () => {

    const videoElement = document.getElementById('myVideo');
    const videoContainer = document.getElementById('video-container');
    const indicator = document.getElementById('connection-indicator');
    const incomingCall = document.getElementById('incoming-call-indicator')
    const acceptCallButton = document.getElementById('accept-call');
    const denyCallButton = document.getElementById('deny-call');
    const cancelCallButton = document.getElementById('cancel-call');
    const toggleVideoBtn = document.getElementById('toggle-video');
    const toggleaudioBtn = document.getElementById('toggle-audio');

    let mediaRecorder = new MediaRecorderStream();
    let localCodec = new MimeCodec().getVideoCodec();
    let remoteCodec = '';

    const semaphore = new Semaphore(1);
    const semaphoreRead = new Semaphore(1);
    const reader = new FileReader(); // Create a single FileReader instance

    let remoteAddr = '';

    let currentSequenceNumber = 0;
    const sequenceNumberBytes = 4; // Number of bytes used for sequence number
    let cachedChunks = {};
    let expectedSequenceNumber = 0;

    const numSubClients = 4;

    let videoTrack;
    let audioTrack;
    let videoEnabled = false;
    let isInCall = false;

    const clientFactory = new ClientFactory(numSubClients);
    clientFactory.onConnectionsUpdated = (success, failed) => {
        let baseText = `${success}/${numSubClients} nodes`;
        let warningText = '\ntrying to find more nodes...'

        document.getElementById('subclients-connected').innerText = baseText + (success < numSubClients ? warningText : '');
    }
    const client = await clientFactory.setup();
    onClientConnect();

    let clientMessages = new ClientMessages(client);
    clientMessages.onCallAccepted = onDialAccepted;
    clientMessages.onCallDenied = onDialDenied;

    const debugPanel = new DebugPanel();

    let timeslice = 50;
    let rtt = 0;

    const ringtoneAudio = new Audio('./audio/ringtone.mp3');
    const connectedAudio = new Audio('./audio/connected.mp3');
    const disconnectedAudio = new Audio('./audio/disconnected.mp3');

    const textChat = new TextChat();
    textChat.onMessageSent = (msg) => {
        clientMessages.sendChatMessage(remoteAddr, msg);
    };

    document.getElementById('callBtnVoice').onclick = () => {
        videoEnabled = false;
        Call();
    };

    document.getElementById('callBtnVideo').onclick = () => {
        videoEnabled = true;
        Call();
    };

    function Call() {
        remoteAddr = document.getElementById('remoteId').value.trim();

        document.getElementById('hide-panel').style.display = 'block';
        document.getElementById('outgoing-call-indicator').style.display = 'block';

        if (remoteAddr.length == 64) {
            let shortAddr = remoteAddr.substring(0, 8) + '...' + remoteAddr.substring(56, 64);
            document.getElementById('dialing-id').textContent = shortAddr;
        } else {
            document.getElementById('dialing-id').textContent = remoteAddr;
        }

        cancelCallButton.onclick = () => {
            clientMessages.cancelDial();
            document.getElementById('hide-panel').style.display = 'none';
            document.getElementById('outgoing-call-indicator').style.display = 'none';
        };

        clientMessages.sendDial(remoteAddr, videoEnabled, localCodec);
    }

    function onDialAccepted(codec) {
        remoteCodec = codec;
        startCall();

        document.getElementById('hide-panel').style.display = 'none';
        document.getElementById('outgoing-call-indicator').style.display = 'none';
    }

    function onDialDenied() {
        document.getElementById('hide-panel').style.display = 'none';
        document.getElementById('outgoing-call-indicator').style.display = 'none';
    }

    function startCall() {
        if (!videoEnabled) {
            toggleVideoBtn.children[0].src = "./svg/video-off.svg";
        }

        isInCall = true;
        connectedAudio.play();

        videoContainer.style.display = 'block';
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            //navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            .then(function (stream) {
                videoElement.srcObject = stream;
                mediaRecorder.setup(stream, 100000, localCodec);
                mediaRecorder.start(timeslice, async (event) => {
                    const recordedBlob = event.data; // This is the binary data chunk

                    // Send the recordedBlob to your server using XHR or Fetch API (explained later)
                    await sendToServer(recordedBlob);
                });

                currentSequenceNumber = 0;
                videoTrack = stream.getTracks().find(track => track.kind === 'video');
                audioTrack = stream.getTracks().find(track => track.kind === 'audio');

                videoTrack.enabled = videoEnabled;
            })
            .catch(function (error) {
                console.error("Error accessing media devices:", error);
                alert(`Error accessing media devices: ${error}`);
            });
    }

    let speedChangeCount = 0;

    function onClientConnect() {
        document.getElementById('connection-label').textContent = 'Successfully connected!';
        document.getElementById('lets-go-button').textContent = 'Let\'s Go!';
        document.getElementById('lets-go-button').removeAttribute('disabled');
        document.getElementById('yourId').value = client.addr;

        document.getElementById('lets-go-button').onclick = () => {
            indicator.style.display = 'none';
            document.getElementById('hide-panel').style.display = 'none';
        }

        setInterval(() => {
            if (isInCall) {
                let sendTime = Date.now();

                if (remoteAddr != '') {
                    client.send(remoteAddr, 'rtt').then((reply) => {
                        if (reply == 'rtt-reply') {
                            rtt = Date.now() - sendTime;
                            debugPanel.rtt = rtt;
                        } else {
                            endCall();
                        }
                    }).catch((e) => {
                        endCall();
                    });

                    let behindTime = videojs.players.remoteVideo.liveTracker.seekableEnd() - videojs.players.remoteVideo.currentTime();
                    let rttSeconds = rtt / 1000.0;
                    if (rttSeconds < timeslice / 250.0) {
                        rttSeconds = timeslice / 250.0;
                    }

                    if (behindTime < rttSeconds) {
                        videojs.players.remoteVideo.playbackRate(0.9);
                        speedChangeCount++;
                    }
                    else if (behindTime >= rttSeconds && behindTime < rttSeconds * 2.0) {
                        videojs.players.remoteVideo.playbackRate(1.0);

                        if (speedChangeCount >= 5) {
                            remoteElement.currentTime = remoteElement.currentTime;
                            speedChangeCount = 0;
                        }
                    }
                    else if (behindTime >= rttSeconds * 2 && behindTime < rttSeconds * 3) {
                        videojs.players.remoteVideo.playbackRate(1.1);
                        speedChangeCount++;
                    }
                    else {
                        videojs('remoteVideo').currentTime(videojs('remoteVideo').liveTracker.seekableEnd() - (timeslice / 1000))
                        console.warn('skip');
                    }
                }
            }
        }, 1000);
    }

    //listen for messages
    client.onMessage(async ({ src, payload }) => {
        if (payload instanceof Uint8Array) {
            await semaphoreRead.acquire(); // Acquire semaphore before processing
            try {
                if (remoteAddr != src) {
                    return;
                }

                debugPanel.addDown(payload.byteLength);

                var arrayBuffer = payload.buffer.slice(payload.byteOffset, payload.byteLength + payload.byteOffset);
                const sequenceNumber = new DataView(arrayBuffer, 0, sequenceNumberBytes).getUint32(0);

                if (sequenceNumber == 0) {
                    sourceBuffer = undefined;
                    cachedChunks = {};
                    expectedSequenceNumber = 0;

                    setupRemoteVideo(remoteCodec);
                }

                let tryCount = 0;
                while (sourceBuffer == undefined) {
                    await sleep(10);
                    tryCount++;
                    if (tryCount == 100) {
                        setupRemoteVideo(remoteCodec);
                        tryCount = 0;
                        console.warn('retrying to create remote video buffer');
                    }
                }

                // Extract the media chunk data
                const chunkData = new Uint8Array(payload.byteLength - sequenceNumberBytes);
                chunkData.set(payload.slice(sequenceNumberBytes));

                if (sequenceNumber - expectedSequenceNumber > 10) {
                    expectedSequenceNumber++;
                    // Process any cached chunks in sequence
                    while (cachedChunks[expectedSequenceNumber]) {
                        await handleChunk(cachedChunks[expectedSequenceNumber]);
                        delete cachedChunks[expectedSequenceNumber];
                        expectedSequenceNumber++;
                    }
                    remoteElement.currentTime = 9999999;
                    debugPanel.droppedChunks++;
                    updateDebugLabel();
                }

                if (sequenceNumber === expectedSequenceNumber) {
                    await handleChunk(chunkData);
                    expectedSequenceNumber++;

                    // Process any cached chunks in sequence
                    while (cachedChunks[expectedSequenceNumber]) {
                        await handleChunk(cachedChunks[expectedSequenceNumber]);
                        delete cachedChunks[expectedSequenceNumber];
                        expectedSequenceNumber++;
                    }
                } else {
                    debugPanel.outOfSequenceChunks++;
                    cachedChunks[sequenceNumber] = chunkData;
                }
            } finally {
                semaphoreRead.release();
            }
        } else {

            if (payload == 'rtt') {
                if (remoteAddr == src) {
                    return 'rtt-reply';
                } else {
                    return 'end-call';
                }
            }

            //Handle string messages...
            let obj = JSON.parse(payload);
            if (obj.type == 'dial') {

                if (src.length == 64) {
                    let shortAddr = src.substring(0, 8) + '...' + src.substring(56, 64);
                    document.getElementById('caller-id').textContent = shortAddr;
                } else {
                    document.getElementById('caller-id').textContent = src;
                }

                document.getElementById('incoming-call-title').innerText = obj.videoEnabled ? 'Incoming video call' : 'incoming voice call';

                incomingCall.style.display = 'block';
                document.getElementById('hide-panel').style.display = 'block';

                let interval = setInterval(async () => {
                    ringtoneAudio.play();
                }, 2000);
                ringtoneAudio.play();

                const acceptPromise = new Promise((resolve) => {
                    acceptCallButton.onclick = () => {
                        remoteAddr = src;
                        remoteCodec = obj.codec;
                        videoEnabled = obj.videoEnabled;
                        console.log('my codec:', localCodec, 'remote codec:', remoteCodec);
                        resolve('dial_accept');
                        startCall();
                    };
                });

                const denyPromise = new Promise((resolve) => {
                    denyCallButton.onclick = () => {
                        resolve('dial_deny');
                    };
                });

                const timeoutPromise = new Promise(async (resolve) => {
                    await sleep(30000);
                    resolve('dial_timeout');
                });

                let result = await Promise.any([acceptPromise, denyPromise, timeoutPromise]);

                incomingCall.style.display = 'none';
                document.getElementById('hide-panel').style.display = 'none';

                clearInterval(interval);

                console.log(result);
                return JSON.stringify({ type: result, codec: localCodec });
            } else if (obj.type == 'text') {
                textChat.addMessage(obj.content, false);
            }
        }
    });

    remoteElement.addEventListener('error',
        function (e) {
            console.error(e.currentTarget.error);
        });


    async function sendToServer(blob) {
        await semaphore.acquire();
        try {
            reader.readAsArrayBuffer(blob);

            await new Promise((resolve, reject) => {
                reader.onload = function (e) {
                    resolve(e.target.result);
                };
                reader.onerror = function (error) {
                    reject(error);
                };
            });

            const chunkData = new Uint8Array(reader.result);
            const sequenceNumberBytes = new Uint8Array(4); // Adjust byte size for sequence number range
            new DataView(sequenceNumberBytes.buffer).setUint32(0, currentSequenceNumber);

            const chunkWithSequenceNumber = new Uint8Array(sequenceNumberBytes.byteLength + chunkData.byteLength);
            chunkWithSequenceNumber.set(sequenceNumberBytes);
            chunkWithSequenceNumber.set(chunkData, sequenceNumberBytes.byteLength);

            await client.send(remoteAddr, chunkWithSequenceNumber, { noReply: true });
            currentSequenceNumber++;

            debugPanel.addUp(reader.result.byteLength);
        } finally {
            semaphore.release(); // Release semaphore after all steps complete
        }
    }


    async function handleChunk(chunk) {
        var copyBuffer = new ArrayBuffer(chunk.byteLength);
        new Uint8Array(copyBuffer).set(new Uint8Array(chunk));
        sourceBuffer.appendBuffer(copyBuffer);

        while (true) {
            if (!sourceBuffer.updating) break
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        var isPlaying = remoteElement.currentTime > 0 && !remoteElement.paused && !remoteElement.ended
            && remoteElement.readyState > remoteElement.HAVE_CURRENT_DATA;

        if (!isPlaying) {
            remoteElement.play();
        }
    }

    const videoOverlay = document.querySelector('.video-overlay');
    let timeoutId = null; // Variable to store the timeout identifier

    // Function to hide the overlay after 3 seconds of no movement
    function hideOverlay() {
        videoOverlay.classList.remove('show');

        timeoutId = null; // Clear the timeout
    }

    // Event listener for mousemove (any mouse movement within the video container)
    document.addEventListener('mousemove', () => {
        //videoOverlay.style.display = 'block'; // Show the overlay immediately
        videoOverlay.classList.add('show');
        clearTimeout(timeoutId); // Clear any previous timeout
        timeoutId = setTimeout(hideOverlay, 2500); // Set a new timeout to hide after 3 seconds
    });

    toggleVideoBtn.onclick = () => {
        videoTrack.enabled = !videoTrack.enabled;
        if (videoTrack.enabled) {
            toggleVideoBtn.children[0].src = "./svg/video.svg";
        } else {
            toggleVideoBtn.children[0].src = "./svg/video-off.svg";
        }
    };

    toggleaudioBtn.onclick = () => {
        audioTrack.enabled = !audioTrack.enabled;
        if (audioTrack.enabled) {
            toggleaudioBtn.children[0].src = "./svg/mic.svg";
        } else {
            toggleaudioBtn.children[0].src = "./svg/mic-off.svg";
        }
    };

    document.getElementById('end-call').onclick = () => {
        endCall();
    };

    function endCall() {
        isInCall = false;
        mediaRecorder.stop();

        videoTrack.stop();
        audioTrack.stop();
        videoElement.pause();
        videoElement.src = "";

        if (remoteAddr != '') {
            disconnectedAudio.play();
        }

        videoContainer.style.display = 'none';
        remoteAddr = '';
    }
})();

