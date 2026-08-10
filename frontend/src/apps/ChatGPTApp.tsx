import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import './ChatGPTApp.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  "Tell me about yourself",
  "Projects you made",
  "Why should I hire you?",
  "Show your backend skills",
  "What's your tech stack?"
];

export const ChatGPTApp: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE || '/api'}/chat`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the backend. Is the FastAPI server running?' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chatgpt-container mac-dark">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="greeting">
              <span className="wave">👋</span> Ask me anything!
            </div>
            <div className="suggestions-list">
              {SUGGESTIONS.map((suggestion, idx) => (
                <button 
                  key={idx} 
                  className="suggestion-pill"
                  onClick={() => handleSend(suggestion)}
                >
                  <span className="dot">•</span> {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.role}`}>
              <div className="message-content">
                <p className="message-text">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="message-wrapper assistant">
            <div className="message-content">
              <span className="typing-indicator">...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-area">
        <div className="input-wrapper mac-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Type a message..."
          />
          <button onClick={() => handleSend(input)} disabled={isLoading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
