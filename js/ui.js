import { Utility } from "./util.js";

export default class UI {
    constructor(callFunc, broadcastStreamFunc, watchStreamFunc) {
        //video container
        this.videoContainer = document.getElementById('video-container');

        //Panel that obscures app
        this.hidePanel = document.getElementById('hide-panel');

        //Connection indicator
        this.connectionIndicator = document.getElementById('connection-indicator');
        this.connectionLabel = document.getElementById('connection-label');
        this.startButton = document.getElementById('lets-go-button');

        //Incoming call panel
        this.incomingCall = document.getElementById('incoming-call-indicator');
        this.callerId = document.getElementById('caller-id');
        this.incomingCallTitle = document.getElementById('incoming-call-title');
        this.acceptCallButton = document.getElementById('accept-call');
        this.denyCallButton = document.getElementById('deny-call');

        //Video overlay
        this.toggleVideoBtn = document.getElementById('toggle-video');
        this.toggleaudioBtn = document.getElementById('toggle-audio');
        this.toggleScreenshare = document.getElementById('toggle-screenshare');

        //Outgoing call panel
        this.cancelCallButton = document.getElementById('cancel-call');

        //call button
        document.getElementById('callBtnVoice').onclick = () => {
            callFunc(false);
        };

        document.getElementById('callBtnVideo').onclick = () => {
            callFunc(true);
        };

        document.getElementById('broadcastStreamButton').onclick = () => {
            this.videoContainer.style.display = 'block';
            document.getElementById('hide-panel').style.display = 'none';
            document.getElementById('outgoing-call-indicator').style.display = 'none';
            broadcastStreamFunc();
        };

        document.getElementById('watchStreamButton').onclick = () => {
            this.videoContainer.style.display = 'block';
            document.getElementById('hide-panel').style.display = 'none';
            document.getElementById('outgoing-call-indicator').style.display = 'none';
            watchStreamFunc();
        };
    }

    showSuccessfullyConnected(clientAddress) {
        this.connectionLabel.textContent = 'Successfully connected!';
        this.startButton.textContent = 'Let\'s Go!';
        this.startButton.removeAttribute('disabled');
        document.getElementById('yourId').value = clientAddress;

        this.startButton.onclick = () => {
            this.connectionIndicator.style.display = 'none';
            this.hidePanel.style.display = 'none';
        }
    }

    async showIncomingCall(incomingAddress, withVideo) {
        if (incomingAddress.length == 64) {
            let shortAddr = incomingAddress.substring(0, 8) + '...' + incomingAddress.substring(56, 64);
            this.callerId.textContent = shortAddr;
        } else {
            this.callerId.textContent = incomingAddress;
        }

        this.incomingCallTitle.innerText = withVideo ? 'Incoming video call' : 'incoming voice call';
        this.incomingCall.style.display = 'block';
        this.hidePanel.style.display = 'block';

        const acceptPromise = new Promise((resolve) => {
            this.acceptCallButton.onclick = () => {
                resolve('dial_accept');
            };
        });

        const denyPromise = new Promise((resolve) => {
            this.denyCallButton.onclick = () => {
                resolve('dial_deny');
            };
        });

        const timeoutPromise = new Promise(async (resolve) => {
            await Utility.sleep(30000);
            resolve('dial_timeout');
        });

        let result = await Promise.any([acceptPromise, denyPromise, timeoutPromise]);
        this.hideIncomingCall();
        return result;
    }

    hideIncomingCall() {
        this.incomingCall.style.display = 'none';
        document.getElementById('hide-panel').style.display = 'none';
    }

    setupVideoOverlay(usermedia, endCallCallback, toggleScreenshareCallback) {
        const videoOverlay = document.querySelector('.video-overlay');
        let timeoutId = null; // Variable to store the timeout identifier

        // Function to hide the overlay after 3 seconds of no movement
        function hideOverlay() {
            videoOverlay.classList.remove('show');
            timeoutId = null; // Clear the timeout
        }

        // Event listener for mousemove (any mouse movement within the video container)
        document.addEventListener('mousemove', () => {
            videoOverlay.classList.add('show');
            clearTimeout(timeoutId);
            timeoutId = setTimeout(hideOverlay, 2500);
        });

        this.toggleVideoBtn.onclick = () => {
            usermedia.videoTrack.enabled = !usermedia.videoTrack.enabled;
            if (usermedia.videoTrack.enabled) {
                this.toggleVideoBtn.children[0].src = "./svg/video.svg";
            } else {
                this.toggleVideoBtn.children[0].src = "./svg/video-off.svg";
            }
        };

        this.toggleaudioBtn.onclick = () => {
            usermedia.audioTrack.enabled = !usermedia.audioTrack.enabled;
            if (usermedia.audioTrack.enabled) {
                this.toggleaudioBtn.children[0].src = "./svg/mic.svg";
            } else {
                this.toggleaudioBtn.children[0].src = "./svg/mic-off.svg";
            }
        };

        this.toggleScreenshare.onclick = async () => {
            let isScreensharing = await toggleScreenshareCallback();
            if (isScreensharing) {
                document.getElementById("toggle-screenshare").style.backgroundColor = '#47ff47';
            } else {
                document.getElementById("toggle-screenshare").style.backgroundColor = 'white';
            }
        };

        document.getElementById('end-call').onclick = () => {
            endCallCallback();
            this.endCall();
        };
    }

    startCall(withVideo) {
        if (!withVideo) {
            this.toggleVideoBtn.children[0].src = "./svg/video-off.svg";
        }
        this.videoContainer.style.display = 'block';
        document.getElementById('hide-panel').style.display = 'none';
        document.getElementById('outgoing-call-indicator').style.display = 'none';
    }

    endCall() {
        document.getElementById('hide-panel').style.display = 'none';
        document.getElementById('outgoing-call-indicator').style.display = 'none';
        this.videoContainer.style.display = 'none';
    }

    showOutgoingCall(remoteAddr, onCancelCallback) {
        document.getElementById('hide-panel').style.display = 'block';
        document.getElementById('outgoing-call-indicator').style.display = 'block';

        if (remoteAddr.length == 64) {
            let shortAddr = remoteAddr.substring(0, 8) + '...' + remoteAddr.substring(56, 64);
            document.getElementById('dialing-id').textContent = shortAddr;
        } else {
            document.getElementById('dialing-id').textContent = remoteAddr;
        }

        this.cancelCallButton.onclick = () => {
            onCancelCallback();
            document.getElementById('hide-panel').style.display = 'none';
            document.getElementById('outgoing-call-indicator').style.display = 'none';
        };
    }
}