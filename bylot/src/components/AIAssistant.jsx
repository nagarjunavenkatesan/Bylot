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

        const userMsg = { id: Date.now(), text: inputText, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        const query = inputText.toLowerCase();
        setInputText('');

        // Local rule-based responses — no backend needed
        const reply = (() => {
            if (query.includes('discount') || query.includes('offer') || query.includes('deal'))
                return "Check the Browse page for all discounted products near you!";
            if (query.includes('sell') || query.includes('list'))
                return "Go to the Sell page to list your products. You'll need to create an account first.";
            if (query.includes('expir') || query.includes('near expiry'))
                return "We show near-expiry products at discounted prices. Browse to find them sorted by distance!";
            if (query.includes('location') || query.includes('nearby') || query.includes('gps'))
                return "Enable GPS on the Browse page to see products closest to you.";
            if (query.includes('login') || query.includes('sign in') || query.includes('account'))
                return "Use the Login page to sign in with Google, or Register to create a new account.";
            if (query.includes('contact') || query.includes('seller'))
                return "Click on any product and tap 'Contact Seller' to view the seller's details.";
            if (query.includes('price') || query.includes('cost'))
                return "All prices are set by sellers. Look for the discount percentage shown on each product card.";
            if (query.includes('hi') || query.includes('hello') || query.includes('hey'))
                return "Hello! How can I help you save money and reduce food waste today?";
            return "I'm here to help with Bylot! Try asking about deals, selling products, or finding nearby discounts.";
        })();

        setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now() + 1, text: reply, sender: 'bot' }]);
        }, 400);
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
