import React, { useState, useRef, useEffect } from 'react';
import { chatWithAI } from '../api';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

// Get user-specific storage key
const getChatStorageKey = (): string => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return 'personalizedScheduler_chatHistory_guest';

  try {
    const user = JSON.parse(userStr);
    return `personalizedScheduler_chatHistory_${user.id}`;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return 'personalizedScheduler_chatHistory_guest';
  }
};

// Convert messages to/from localStorage format
const serializeMessages = (messages: Message[]): string => {
  return JSON.stringify(messages.map(msg => ({
    ...msg,
    timestamp: msg.timestamp.toISOString()
  })));
};

const deserializeMessages = (data: string): Message[] => {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return parsed.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  } catch (error) {
    console.error('Failed to parse messages from localStorage:', error);
    return [];
  }
};

// Format text with enhanced markdown for task operations
const formatChatText = (text: string) => {
  // Format task operation headers (created, updated, deleted)
  let formattedText = text
    .replace(/(✅ Task created successfully:)/g, '<strong class="success-header">$1</strong>')
    .replace(/(✅ Task updated successfully:)/g, '<strong class="success-header">$1</strong>')
    .replace(/(✅ Task deleted successfully:)/g, '<strong class="success-header">$1</strong>');

  // Format task properties with icons
  formattedText = formattedText
    .replace(/📌 Title:/g, '<span class="task-property">📌 <strong>Title:</strong></span>')
    .replace(/📝 Description:/g, '<span class="task-property">📝 <strong>Description:</strong></span>')
    .replace(/🔥 Priority:/g, '<span class="task-property">🔥 <strong>Priority:</strong></span>')
    .replace(/🕒 Time:/g, '<span class="task-property">🕒 <strong>Time:</strong></span>')
    .replace(/⏱️ Duration:/g, '<span class="task-property">⏱️ <strong>Duration:</strong></span>')
    .replace(/Changed properties:/g, '<span class="task-property">🔄 <strong>Changed properties:</strong></span>');

  // Format task list header
  formattedText = formattedText.replace(/(📋 \*\*Your Updated Task List\*\*)/g,
    '<div class="task-list-header">$1</div>');

  // Replace **text** with bold
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Replace _text_ or *text* with italic (but not overlapping with previous bold replacements)
  formattedText = formattedText.replace(/(?<!<strong>)(?:_|\*)([^_\*]+?)(?:_|\*)(?!<\/strong>)/g, '<em>$1</em>');

  // Replace status icons to make them stand out
  formattedText = formattedText
    .replace(/✅/g, '<span class="status-icon success">✅</span>')
    .replace(/⚠️/g, '<span class="status-icon warning">⚠️</span>')
    .replace(/❌/g, '<span class="status-icon error">❌</span>');

  // Replace bullet lists (- item)
  formattedText = formattedText.replace(
    /^- (.+)$/gm,
    '<span class="bullet-item">• $1</span>'
  );

  // Add paragraph spacing for empty lines
  formattedText = formattedText.replace(/\n\n/g, '<br/><br/>');

  // Replace single newlines with <br/>
  formattedText = formattedText.replace(/\n/g, '<br/>');

  return formattedText;
};

const Chat: React.FC = () => {
  // Track current user ID for state changes
  const [userId, setUserId] = useState<number | null>(null);

  // Get user-specific storage key based on current userId
  const [storageKey, setStorageKey] = useState<string>('personalizedScheduler_chatHistory_guest');

  // Initialize with empty messages - will be populated in useEffect
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef<boolean>(false);

  // Get current user ID whenever component mounts or user changes
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    let currentUserId: number | null = null;

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        currentUserId = user.id;
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    // Update userId state
    setUserId(currentUserId);

    // Update storage key based on user
    const newStorageKey = currentUserId
      ? `personalizedScheduler_chatHistory_${currentUserId}`
      : 'personalizedScheduler_chatHistory_guest';

    setStorageKey(newStorageKey);

    // Load the appropriate messages from storage
    const savedMessages = localStorage.getItem(newStorageKey);

    if (savedMessages) {
      try {
        setMessages(deserializeMessages(savedMessages));
      } catch (error) {
        console.error('Failed to parse saved messages:', error);
        resetToDefaultMessages(currentUserId);
      }
    } else {
      resetToDefaultMessages(currentUserId);
    }

    initialLoadDone.current = true;
  }, []);

  // Function to reset to default welcome messages
  const resetToDefaultMessages = (currentUserId: number | null) => {
    if (currentUserId) {
      // If user is logged in, show personalized greeting
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          const personalizedMessage = {
            id: 1,
            text: `Hi ${user.username}! I'm your personal scheduling assistant. How can I help you today?`,
            sender: 'bot' as const,
            timestamp: new Date()
          };
          setMessages([personalizedMessage]);
        } catch (error) {
          console.error('Error parsing user data:', error);
          setDefaultGreeting();
        }
      }
    } else {
      // If no user is logged in, show generic greeting
      setDefaultGreeting();
    }
  };

  // Helper function to set the default greeting for non-logged in users
  const setDefaultGreeting = () => {
    const defaultMessage = {
      id: 1,
      text: "Hi! I'm your scheduling assistant. How can I help you today? You can create, edit, or delete tasks by simply describing what you need.",
      sender: 'bot' as const,
      timestamp: new Date()
    };
    setMessages([defaultMessage]);
  };

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (initialLoadDone.current && storageKey) {
      localStorage.setItem(storageKey, serializeMessages(messages));
    }
  }, [messages, storageKey]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // chatWithAI now handles getting the user ID from localStorage
      const response = await chatWithAI(input);

      const botMessage: Message = {
        id: Date.now() + 1,
        text: response.response,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prevMessages => [...prevMessages, botMessage]);
    } catch (error: any) {
      console.error('Error in chat:', error);

      // Add error message
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again later.",
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      resetToDefaultMessages(userId);
    }
  };

  const getHelpExamples = () => {
    const examples = [
      "Create a task to finish my project report by tomorrow at 5pm, high priority",
      "Schedule a meeting with John on Friday at 2pm for 1 hour",
      "Change my project report deadline to Saturday",
      "Update the meeting with John to 3pm instead of 2pm",
      "Delete the project report task",
      "Remove my meeting with John"
    ];

    setMessages(prevMessages => [
      ...prevMessages,
      {
        id: Date.now(),
        text: "Here are some examples of what you can ask me to do:\n\n" + examples.map(ex => "• " + ex).join("\n"),
        sender: 'bot',
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chat Assistant</h2>
        <div className="chat-actions">
          <button
            onClick={getHelpExamples}
            className="help-btn"
            title="Show examples"
          >
            Examples
          </button>
          <button
            onClick={clearChat}
            className="clear-chat-btn"
            title="Clear chat history"
          >
            Clear Chat
          </button>
        </div>
      </div>

      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div
              className="message-content"
              dangerouslySetInnerHTML={
                message.sender === 'bot'
                  ? { __html: formatChatText(message.text) }
                  : { __html: message.text.split('\n').join('<br/>') }
              }
            />
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="message-content typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;