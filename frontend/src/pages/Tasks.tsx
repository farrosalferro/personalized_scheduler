import React, { useState } from "react";
import TaskList from "../components/TaskList";
import TaskForm from "../components/TaskForm";
import "../styles/Notification.css"; // We'll create this file for notification styling

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

const Tasks: React.FC = () => {
    const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const showNotification = (message: string, type: "success" | "error") => {
        setNotification({ message, type });
    };

    const closeNotification = () => {
        setNotification(null);
    };

    return (
        <div>
            <h1>Manage Your Tasks</h1>

            {/* Task Form */}
            <TaskForm showNotification={showNotification} />

            {/* Task List */}
            <TaskList />

            {/* Notification Popup */}
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={closeNotification}
                />
            )}
        </div>
    );
};

export default Tasks;
