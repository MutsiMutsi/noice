export default class TextChat {

    onMessageSent = null;

    constructor() {
        this.messagesElement = document.getElementById('messages');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');

        this.sendButton.addEventListener('click', () => {
            const messageText = this.messageInput.value.trim();
            if (messageText) {
                if (this.onMessageSent != null) {
                    this.onMessageSent(messageText);
                }
                this.addMessage(messageText, 'Sent');
                this.messageInput.value = ''; // Clear input field after sending
            }
        });

        this.messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                this.sendButton.click(); // Simulate a click on the send button
            }
        });
    }

    addMessage(text, isSent = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', isSent ? 'sent' : 'received');
        messageElement.textContent = text;

        this.messagesElement.appendChild(messageElement);

        // Animate message entry (optional)
        messageElement.style.transform = 'translateY(20px)';
        messageElement.style.transition = 'transform 0.2s ease-in-out';
        setTimeout(() => {
            messageElement.style.transform = 'translateY(0)';
        }, 0);
    }
}