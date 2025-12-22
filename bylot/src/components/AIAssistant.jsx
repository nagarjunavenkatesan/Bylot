import React, { useState } from 'react';
import '../styles/AIAssistant.css';

const AIAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: "Hi! I'm your Bylot Assistant. How can I help you reduce food waste today?", sender: 'bot' }
    ]);
    const [inputText, setInputText] = useState('');

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        // Add user message
        const userMsg = { id: Date.now(), text: inputText, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.text })
            });

            if (response.ok) {
                const data = await response.json();
                const botMsg = {
                    id: Date.now() + 1,
                    text: data.reply,
                    sender: 'bot'
                };
                setMessages(prev => [...prev, botMsg]);
            } else {
                throw new Error('Failed to get response');
            }
        } catch (error) {
            const errorMsg = {
                id: Date.now() + 1,
                text: "Sorry, I'm having trouble connecting right now.",
                sender: 'bot'
            };
            setMessages(prev => [...prev, errorMsg]);
        }
    };

    return (
        <div className="ai-assistant-container">
            {/* Chat Window */}
            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <div className="header-info">
                            <div className="bot-avatar-sm">🤖</div>
                            <h3>Bylot Assistant</h3>
                        </div>
                        <button onClick={toggleChat} className="close-btn">&times;</button>
                    </div>

                    <div className="chat-messages">
                        {messages.map(msg => (
                            <div key={msg.id} className={`message ${msg.sender}`}>
                                <div className="message-content">
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleSendMessage} className="chat-input-area">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Ask me anything..."
                            className="chat-input"
                        />
                        <button type="submit" className="send-btn">
                            ➤
                        </button>
                    </form>
                </div>
            )}

            {/* Floating Action Button */}
            <button className="ai-fab" onClick={toggleChat} aria-label="Open AI Assistant">
                <span className="fab-icon">🤖</span>
                <span className="fab-text">AI Help</span>
            </button>
        </div>
    );
};

export default AIAssistant;
