import React, { useState, useEffect } from "react";
import TaskList from "./components/TaskList";
import TaskForm from "./components/TaskForm";
import Calendar from "./components/Calendar";
import Chat from "./components/Chat";
import AuthPage from "./components/AuthPage";
import { TaskProvider } from "./context/TaskContext";
import './App.css';
import "./styles/Notification.css";

// Import the Notification component or define it here
interface NotificationProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  React.useEffect(() => {
    // Auto-close notification after 5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification ${type}`}>
      <div className="notification-content">
        <span className="notification-message">{message}</span>
        <button className="notification-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar' | 'chat'>('tasks');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Notification handler functions
  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
  };

  const closeNotification = () => {
    setNotification(null);
  };

  // Check if user is already logged in
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      setIsAuthenticated(true);
    }
  }, []);

  // Navigation tab rendering
  const renderTabs = () => {
    if (!isAuthenticated) return null;

    return (
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar
        </button>
        <button
          className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat Assistant
        </button>
      </div>
    );
  };

  // Content rendering based on active tab
  const renderContent = () => {
    if (!isAuthenticated) {
      return (
        <div className="auth-container">
          <AuthPage onAuthSuccess={() => setIsAuthenticated(true)} />
        </div>
      );
    }

    switch (activeTab) {
      case 'tasks':
        return (
          <>
            <TaskForm showNotification={showNotification} />
            <TaskList />
          </>
        );
      case 'calendar':
        return <Calendar />;
      case 'chat':
        return <Chat />;
      default:
        return <TaskList />;
    }
  };

  // Log out handler with chat history cleanup
  const handleLogout = () => {
    // Get current user before logout
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const userId = user.id;

        // Clear only the current user's chat history
        localStorage.removeItem(`personalizedScheduler_chatHistory_${userId}`);
        localStorage.removeItem(`personalizedScheduler_chatbotHistory_${userId}`);
        console.log(`Cleared chat history for user ID: ${userId}`);
      } catch (error) {
        console.error('Error parsing user data during logout:', error);
      }
    }

    // Remove user from localStorage
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  return (
    <TaskProvider>
      <div className="App">
        <header className="App-header">
          <h1>Personalized Scheduler</h1>
          {isAuthenticated && (
            <button className="logout-button" onClick={handleLogout}>
              Log Out
            </button>
          )}
        </header>
        {renderTabs()}
        <main className="App-content">
          {renderContent()}
        </main>

        {/* Notification component */}
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={closeNotification}
          />
        )}
      </div>
    </TaskProvider>
  );
};

export default App;
