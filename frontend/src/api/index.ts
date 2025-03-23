import axios from 'axios';

// Base URL for API calls
const API_BASE_URL = '/api';

// Define interfaces for request parameters
interface RegisterUserParams {
    username: string;
    password: string;
    name?: string;
}

interface LoginUserParams {
    username: string;
    password: string;
}

// Authentication APIs
export const registerUser = async (params: RegisterUserParams) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/users/register`, {
            username: params.username,
            password: params.password,
            name: params.name || params.username, // Fallback to username if no name is provided
            email: null // Set email to null as we're not using it for now
        });
        return response.data;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
};

export const loginUser = async (params: LoginUserParams) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/users/login`, {
            username: params.username,
            password: params.password
        });
        return response.data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

// Additional API calls can be added here
