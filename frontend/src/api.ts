import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

// Create an axios instance with default configuration
const api = axios.create({
    baseURL: API_URL,
    timeout: 10000, // 10 seconds timeout
    headers: {
        'Content-Type': 'application/json',
    },
    // Add withCredentials: false to avoid CORS issues with credentials
    withCredentials: false
});

// Define interfaces for request parameters
interface RegisterUserParams {
    username: string;
    password: string;
    name?: string;
    email?: string;
}

interface LoginUserParams {
    username: string;
    password: string;
}

export const getTasks = async (userId?: number | null) => {
    try {
        const url = userId ? `/tasks?user_id=${userId}` : '/tasks';
        const response = await api.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return [];
    }
};

export const addTask = async (task: any) => {
    try {
        console.log('Sending task to backend:', JSON.stringify(task));

        // Try with fetch API as an alternative to axios
        const response = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(task)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Response from backend:', data);
        return data;
    } catch (error: any) {
        console.error('Error adding task:', error);
        throw error;
    }
};

export const deleteTask = async (taskId: number) => {
    try {
        await api.delete(`/tasks/${taskId}`);
    } catch (error) {
        console.error(`Error deleting task ${taskId}:`, error);
        throw error;
    }
};

export const editTask = async (taskId: number, task: any) => {
    try {
        console.log('Sending updated task to backend:', JSON.stringify(task));

        // Use fetch API for consistency with addTask
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(task)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Response from backend:', data);
        return data;
    } catch (error: any) {
        console.error('Error editing task:', error);
        throw error;
    }
};

export const chatWithAI = async (message: string) => {
    try {
        console.log('Sending message to chatbot:', message);

        // Get user ID from localStorage if available
        const userStr = localStorage.getItem('user');
        let userId = null;
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                userId = user.id;
            } catch (error) {
                console.error('Error parsing user data:', error);
            }
        }

        // Include user_id in request if available
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                user_id: userId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Response from chatbot:', data);

        // If the response contains a task update notification, trigger a task refresh event
        if (data.response) {
            // Check for various task operations
            const taskCreated = data.response.includes("✅ Task created successfully:");
            const taskUpdated = data.response.includes("✅ Task updated successfully:");
            const taskDeleted = data.response.includes("✅ Task deleted successfully:");

            if (taskCreated || taskUpdated || taskDeleted) {
                console.log('Detected task change, dispatching refresh event');
                // Dispatch a custom event that components can listen for
                const refreshEvent = new CustomEvent('tasksUpdated', {
                    detail: { source: 'chatbot', timestamp: Date.now() }
                });
                window.dispatchEvent(refreshEvent);
            }
        }

        return data;
    } catch (error: any) {
        console.error('Error communicating with chatbot:', error);
        throw error;
    }
};

export const registerUser = async (params: RegisterUserParams) => {
    try {
        const response = await api.post('/users/register', {
            username: params.username,
            password: params.password,
            name: params.name || params.username, // Fallback to username if no name is provided
            email: params.email // No longer set to null, use the provided email
        });
        return response.data;
    } catch (error) {
        console.error('Error registering user:', error);
        throw error;
    }
};

export const loginUser = async (params: LoginUserParams) => {
    try {
        const response = await api.post('/users/login', {
            username: params.username,
            password: params.password
        });
        return response.data;
    } catch (error) {
        console.error('Error logging in:', error);
        throw error;
    }
};
