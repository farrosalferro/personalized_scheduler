import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTaskContext } from "../context/TaskContext";
import EditTaskForm from "./EditTaskForm";

interface Task {
    id: number;
    title: string;
    description: string;
    priority: string;
    deadline: string;
    duration: number;
    is_due_date: boolean;
}

// Custom confirm function to avoid ESLint warning
const customConfirm = (message: string): boolean => {
    // eslint-disable-next-line no-restricted-globals
    return window.confirm(message);
};

// Helper function to format date and time
const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

// Helper function to calculate end time from start time and duration
const calculateEndTime = (startTimeString: string, durationMinutes: number) => {
    const startTime = new Date(startTimeString);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    return endTime.toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

// Helper function to get priority icon
const getPriorityIcon = (priority: string) => {
    switch (priority) {
        case "High":
            return "🔴";
        case "Normal":
            return "🟡";
        case "Low":
            return "🟢";
        default:
            return "⚪";
    }
};

// Helper function to format date for display in headers
const formatDateHeader = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

// Helper function to format time
const formatTime = (dateTimeStr: string): string => {
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const TaskList: React.FC = () => {
    const { tasks, loading, error, refreshTasks, deleteTask: contextDeleteTask, isRefreshing } = useTaskContext();
    const [editingTask, setEditingTask] = useState<number | null>(null);
    const initialLoadDone = useRef(false);

    // Initial load of tasks - only once
    useEffect(() => {
        if (!initialLoadDone.current && !isRefreshing) {
            refreshTasks();
            initialLoadDone.current = true;
        }

        // Listen for the tasksUpdated event
        const handleTasksUpdated = (event: Event) => {
            // Check the source to prevent loops
            const customEvent = event as CustomEvent;
            const source = customEvent.detail?.source;

            console.log('Tasks updated event received from source:', source);

            // Only refresh if the update came from the chatbot
            if (source === 'chatbot') {
                refreshTasks();
            }
        };

        window.addEventListener('tasksUpdated', handleTasksUpdated);
        return () => {
            window.removeEventListener('tasksUpdated', handleTasksUpdated);
        };
    }, [refreshTasks, isRefreshing]);

    const handleDelete = async (taskId: number) => {
        const confirmed = window.confirm("Are you sure you want to delete this task?");
        if (!confirmed) return;

        try {
            await contextDeleteTask(taskId);
            // No need to call refresh here as the context will handle it
        } catch (err) {
            console.error('Error deleting task:', err);
            alert('Failed to delete task. Please try again.');
        }
    };

    const startEditing = (taskId: number) => {
        setEditingTask(taskId);
    };

    const cancelEditing = () => {
        setEditingTask(null);
    };

    const handleEditComplete = () => {
        setEditingTask(null);
        // No need to call refresh here as the edit operation will trigger it
    };

    if (loading && tasks.length === 0) return <div>Loading tasks...</div>;
    if (error) return <div className="error-message">{error}</div>;

    // Sort tasks by deadline
    const sortedTasks = [...tasks].sort((a, b) =>
        new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    );

    return (
        <div className="task-list">
            <h2>Your Tasks</h2>
            {sortedTasks.length === 0 ? (
                <p>No tasks scheduled. Add a task to get started!</p>
            ) : (
                <ul className="task-items">
                    {sortedTasks.map(task => (
                        <li key={task.id} className={`task-item priority-${task.priority.toLowerCase()}`}>
                            {editingTask === task.id ? (
                                <EditTaskForm
                                    task={task}
                                    onCancel={cancelEditing}
                                    onComplete={handleEditComplete}
                                />
                            ) : (
                                <>
                                    <div className="task-header">
                                        <span className="task-title">{task.title}</span>
                                        <span className="task-priority">{getPriorityIcon(task.priority)}</span>
                                        <span className="task-duration">{task.duration}min</span>
                                    </div>

                                    <div className="task-details">
                                        <div className="task-description">
                                            {task.description || "No description provided."}
                                        </div>

                                        <div className="task-time-details">
                                            {task.is_due_date ? (
                                                <span>📅 Due: {formatDateTime(task.deadline)}</span>
                                            ) : (
                                                <span>🕒 {formatDateTime(task.deadline)} - {calculateEndTime(task.deadline, task.duration)}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="task-actions">
                                        <button
                                            onClick={() => startEditing(task.id)}
                                            className="edit-button"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(task.id)}
                                            className="delete-button"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TaskList;
