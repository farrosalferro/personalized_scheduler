import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useTaskContext } from "../context/TaskContext";

interface Message {
    text: string;
    isUser: boolean;
    timestamp: Date;
}

// Get user-specific storage key
const getChatBotStorageKey = (): string => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return 'personalizedScheduler_chatbotHistory_guest';

    try {
        const user = JSON.parse(userStr);
        return `personalizedScheduler_chatbotHistory_${user.id}`;
    } catch (error) {
        console.error('Error parsing user data:', error);
        return 'personalizedScheduler_chatbotHistory_guest';
    }
};

const ChatBot: React.FC = () => {
    const { refreshTasks } = useTaskContext();
    const [userId, setUserId] = useState<number | null>(null);
    const [storageKey, setStorageKey] = useState<string>('personalizedScheduler_chatbotHistory_guest');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initialLoadDone = useRef<boolean>(false);

    // Get current user ID whenever component mounts
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
            ? `personalizedScheduler_chatbotHistory_${currentUserId}`
            : 'personalizedScheduler_chatbotHistory_guest';

        setStorageKey(newStorageKey);

        // Load the appropriate messages from storage
        const savedMessages = localStorage.getItem(newStorageKey);

        if (savedMessages) {
            try {
                setMessages(JSON.parse(savedMessages));
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
                        text: `Hi ${user.username}! What tasks would you like to schedule today?`,
                        isUser: false,
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
            text: "Hi there! I'm your AI scheduling assistant. How can I help you manage your tasks today?\n\nYou can ask me to create tasks for you. For example, try saying:\n\"I have a meeting tomorrow at 2 PM with the marketing team\"",
            isUser: false,
            timestamp: new Date()
        };
        setMessages([defaultMessage]);
    };

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (initialLoadDone.current && storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(messages));
        }
    }, [messages, storageKey]);

    // Auto-scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Get user ID from localStorage
    const getUserId = () => {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;

        try {
            const user = JSON.parse(userStr);
            return user.id || null;
        } catch {
            return null;
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        // Add user message
        const userMessage: Message = {
            text: input,
            isUser: true,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            // Include user_id in the request
            const userId = getUserId();
            const requestData = userId ? { message: input, user_id: userId } : { message: input };

            // Send message to backend
            const response = await axios.post("http://127.0.0.1:8000/chat", requestData);

            // Add AI response
            const aiMessage: Message = {
                text: response.data.response,
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);

            // If the response contains a task creation confirmation (indicated by the checkmark),
            // refresh the task list to show the new task
            if (response.data.response.includes("✅ Task created successfully")) {
                refreshTasks();
            }
        } catch (error) {
            console.error("Error sending message:", error);
            // Add error message
            const errorMessage: Message = {
                text: "Sorry, I encountered an error. Please try again later.",
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Function to format message text with special styling for task creation confirmations
    const formatMessageText = (text: string) => {
        if (text.includes("✅ Task created successfully")) {
            // Split the message into task confirmation and regular response
            const parts = text.split("\n\n");
            const taskConfirmation = parts[0];
            const regularResponse = parts.slice(1).join("\n\n");

            return (
                <>
                    <div style={{
                        backgroundColor: "#e6f7e6",
                        padding: "10px",
                        borderRadius: "5px",
                        marginBottom: "10px",
                        border: "1px solid #c3e6cb"
                    }}>
                        {taskConfirmation.split('\n').map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </div>
                    <div>{regularResponse}</div>
                </>
            );
        }

        // Regular message formatting with line breaks
        return (
            <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
        );
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            height: "500px",
            maxWidth: "800px",
            margin: "0 auto",
            border: "1px solid #ccc",
            borderRadius: "8px",
            overflow: "hidden"
        }}>
            <div style={{
                padding: "10px 15px",
                backgroundColor: "#007BFF",
                color: "white",
                fontWeight: "bold"
            }}>
                AI Scheduling Assistant
            </div>

            {/* Messages container */}
            <div style={{
                flex: 1,
                padding: "15px",
                overflowY: "auto",
                backgroundColor: "#f5f5f5"
            }}>
                {messages.map((message, index) => (
                    <div
                        key={index}
                        style={{
                            display: "flex",
                            justifyContent: message.isUser ? "flex-end" : "flex-start",
                            marginBottom: "10px"
                        }}
                    >
                        <div style={{
                            maxWidth: "70%",
                            padding: "10px 15px",
                            borderRadius: "18px",
                            backgroundColor: message.isUser ? "#007BFF" : "white",
                            color: message.isUser ? "white" : "black",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                        }}>
                            {formatMessageText(message.text)}
                            <div style={{
                                fontSize: "0.7rem",
                                marginTop: "5px",
                                textAlign: "right",
                                opacity: 0.7
                            }}>
                                {formatTime(message.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div style={{
                        display: "flex",
                        justifyContent: "flex-start",
                        marginBottom: "10px"
                    }}>
                        <div style={{
                            padding: "10px 15px",
                            borderRadius: "18px",
                            backgroundColor: "white",
                            color: "black"
                        }}>
                            <div style={{ display: "flex", alignItems: "center" }}>
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{
                display: "flex",
                padding: "10px",
                borderTop: "1px solid #ccc",
                backgroundColor: "white"
            }}>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message here or describe a task to add..."
                    style={{
                        flex: 1,
                        padding: "10px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        resize: "none",
                        height: "60px"
                    }}
                    disabled={isLoading}
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    style={{
                        marginLeft: "10px",
                        padding: "0 15px",
                        backgroundColor: isLoading || !input.trim() ? "#cccccc" : "#007BFF",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isLoading || !input.trim() ? "not-allowed" : "pointer"
                    }}
                >
                    Send
                </button>
            </div>

            {/* CSS for typing indicator */}
            <style>
                {`
                .typing-indicator {
                    display: flex;
                    align-items: center;
                }
                .typing-indicator span {
                    height: 8px;
                    width: 8px;
                    margin: 0 2px;
                    background-color: #bbb;
                    border-radius: 50%;
                    display: inline-block;
                    animation: typing 1.4s infinite ease-in-out both;
                }
                .typing-indicator span:nth-child(1) {
                    animation-delay: 0s;
                }
                .typing-indicator span:nth-child(2) {
                    animation-delay: 0.2s;
                }
                .typing-indicator span:nth-child(3) {
                    animation-delay: 0.4s;
                }
                @keyframes typing {
                    0% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.5);
                    }
                    100% {
                        transform: scale(1);
                    }
                }
                `}
            </style>
        </div>
    );
};

export default ChatBot;