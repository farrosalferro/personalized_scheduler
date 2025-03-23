import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { getTasks, addTask as apiAddTask, deleteTask as apiDeleteTask, editTask as apiEditTask } from '../api';

// Define the shape of a task
interface Task {
    id: number;
    title: string;
    description: string;
    priority: string;
    deadline: string;
    duration: number;
    is_due_date: boolean;
    user_id?: number;
}

// Define the context shape
interface TaskContextType {
    tasks: Task[];
    loading: boolean;
    error: string | null;
    refreshTasks: () => Promise<void>;
    addTask: (taskData: any) => Promise<void>;
    deleteTask: (taskId: number) => Promise<void>;
    editTask: (taskId: number, taskData: any) => Promise<void>;
    isRefreshing: boolean;
}

// Create the context with default values
const TaskContext = createContext<TaskContextType>({
    tasks: [],
    loading: false,
    error: null,
    refreshTasks: async () => { },
    addTask: async () => { },
    deleteTask: async () => { },
    editTask: async () => { },
    isRefreshing: false
});

// Create a provider component
export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<number>(0);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Get user ID from local storage if available
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

    // Function to fetch tasks
    const refreshTasks = useCallback(async () => {
        // Prevent multiple refreshes within a short time window
        const now = Date.now();
        if (now - lastRefresh < 1000 || isRefreshing) {
            return;
        }

        setIsRefreshing(true);
        setLoading(true);
        setError(null);
        try {
            const userId = getUserId();
            // Pass the user ID to get only this user's tasks
            const data = await getTasks(userId);
            setTasks(data);
            setLastRefresh(now);
        } catch (err: any) {
            setError(`Failed to fetch tasks: ${err.message}`);
            console.error('Error fetching tasks:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [lastRefresh, isRefreshing]);

    // Function to add a task
    const addTask = async (taskData: any) => {
        setLoading(true);
        setError(null);
        try {
            // Add user ID to the task
            const userId = getUserId();
            if (userId) {
                taskData.user_id = userId;
            }
            await apiAddTask(taskData);
            await refreshTasks();
        } catch (err: any) {
            setError(`Failed to add task: ${err.message}`);
            console.error('Error adding task:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Function to delete a task
    const deleteTask = async (taskId: number) => {
        setLoading(true);
        setError(null);
        try {
            await apiDeleteTask(taskId);
            // Filter the task locally to avoid unnecessary refresh
            setTasks(current => current.filter(task => task.id !== taskId));
        } catch (err: any) {
            setError(`Failed to delete task: ${err.message}`);
            console.error('Error deleting task:', err);
        } finally {
            setLoading(false);
        }
    };

    // Function to edit a task
    const editTask = async (taskId: number, taskData: any) => {
        setLoading(true);
        setError(null);
        try {
            const updatedTask = await apiEditTask(taskId, taskData);
            // Update task locally instead of full refresh
            setTasks(current =>
                current.map(task => task.id === taskId ? updatedTask : task)
            );
        } catch (err: any) {
            setError(`Failed to edit task: ${err.message}`);
            console.error('Error editing task:', err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Load tasks when the component mounts or user changes
    useEffect(() => {
        const userId = getUserId();
        if (userId) {
            refreshTasks();
        } else {
            // Clear tasks if no user is logged in
            setTasks([]);
        }
    }, []);

    return (
        <TaskContext.Provider value={{
            tasks,
            loading,
            error,
            refreshTasks,
            addTask,
            deleteTask,
            editTask,
            isRefreshing
        }}>
            {children}
        </TaskContext.Provider>
    );
};

// Custom hook to use the task context
export const useTaskContext = () => useContext(TaskContext);