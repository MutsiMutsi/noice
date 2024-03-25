import "./lib/nkn.js";
import "./lib/video.min.js";

import ClientFactory from "./js/client-factory.js";
import MimeCodec from "./js/mimecodec.js";
import TextChat from "./js/text-chat.js";
import ClientMessages from "./js/client-messages.js";
import DebugPanel from "./js/debug-panel.js";
import UserMedia from "./js/user-media.js";
import StreamHandler from "./js/stream-handler.js";
import UI from "./js/ui.js";

(async () => {

    const videoLocalElement = document.getElementById('myVideo');
    const debugPanel = new DebugPanel();
    const userinterface = new UI(Call);
    const numSubClients = 4;

    let localCodec = new MimeCodec().getVideoCodec();
    let remoteCodec = '';
    let remoteAddr = '';

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

    let usermedia = new UserMedia(videoLocalElement, localCodec);
    let streamHandler = new StreamHandler(client, debugPanel);

    let clientMessages = new ClientMessages(client);
    clientMessages.onCallAccepted = onDialAccepted;
    clientMessages.onCallDenied = onDialDenied;


    let rtt = 0;

    const ringtoneAudio = new Audio('./audio/ringtone.mp3');
    const connectedAudio = new Audio('./audio/connected.mp3');
    const disconnectedAudio = new Audio('./audio/disconnected.mp3');

    const textChat = new TextChat();
    textChat.onMessageSent = (msg) => {
        clientMessages.sendChatMessage(remoteAddr, msg);
    };

    function Call(isVideoEnabled) {
        videoEnabled = isVideoEnabled;
        remoteAddr = document.getElementById('remoteId').value.trim();
        userinterface.showOutgoingCall(remoteAddr, () => {
            clientMessages.cancelDial();
            remoteAddr = '';
        });
        clientMessages.sendDial(remoteAddr, videoEnabled, localCodec);
    }

    function onDialAccepted(codec) {
        remoteCodec = codec;
        startCall();
    }

    function onDialDenied() {
        userinterface.endCall();
    }

    function startCall() {
        userinterface.startCall(videoEnabled);
        isInCall = true;
        connectedAudio.play();

        usermedia.startWebcam(videoEnabled, (blob, sequenceNumber) => {
            streamHandler.send(remoteAddr, blob, sequenceNumber);
        });
    }

    let speedChangeCount = 0;

    function onClientConnect() {

        userinterface.showSuccessfullyConnected(client.addr);

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
                    if (rttSeconds < usermedia.timeslice / 250.0) {
                        rttSeconds = usermedia.timeslice / 250.0;
                    }

                    if (behindTime < rttSeconds) {
                        videojs.players.remoteVideo.playbackRate(0.9);
                        speedChangeCount++;
                    }
                    else if (behindTime >= rttSeconds && behindTime < rttSeconds * 2.0) {
                        videojs.players.remoteVideo.playbackRate(1.0);

                        if (speedChangeCount >= 5) {
                            videoRemoteElement.currentTime = videoRemoteElement.currentTime;
                            speedChangeCount = 0;
                        }
                    }
                    else if (behindTime >= rttSeconds * 2 && behindTime < rttSeconds * 3) {
                        videojs.players.remoteVideo.playbackRate(1.1);
                        speedChangeCount++;
                    }
                    else {
                        videojs('remoteVideo').currentTime(videojs('remoteVideo').liveTracker.seekableEnd() - (usermedia.timeslice / 1000))
                        console.warn('skip');
                    }
                }
            }
        }, 1000);
    }

    //listen for messages
    client.onMessage(async ({ src, payload }) => {
        if (payload instanceof Uint8Array) {

            if (remoteAddr != src) {
                return;
            }

            streamHandler.receive(payload, remoteCodec);
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

                let ringtoneInterval = setInterval(async () => {
                    ringtoneAudio.play();
                }, 2000);
                ringtoneAudio.play();
                let callResult = await userinterface.showIncomingCall(src, obj.videoEnabled);

                if (callResult == 'dial_accept') {
                    remoteAddr = src;
                    remoteCodec = obj.codec;
                    videoEnabled = obj.videoEnabled;
                    console.log('my codec:', localCodec, 'remote codec:', remoteCodec);
                    startCall();
                }

                clearInterval(ringtoneInterval);

                console.log(callResult);
                return JSON.stringify({ type: callResult, codec: localCodec });
            } else if (obj.type == 'text') {
                textChat.addMessage(obj.content, false);
            }
        }
    });

    videoRemoteElement.addEventListener('error',
        function (e) {
            console.error(e.currentTarget.error);
        });

    userinterface.setupVideoOverlay(usermedia, endCall, async () => {
        if (!usermedia.isScreensharing) {
            return await usermedia.startScreenshare();
        } else {
            usermedia.stopScreenshare();
            return false;
        }
    });

    async function endCall() {
        isInCall = false;

        userinterface.endCall();
        await usermedia.stop();
        await streamHandler.stop();

        if (remoteAddr != '') {
            disconnectedAudio.play();
        }

        remoteAddr = '';
    }
})();

