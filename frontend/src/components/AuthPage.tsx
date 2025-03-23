import React, { useState } from 'react';
import * as api from '../api';

interface AuthPageProps {
    onAuthSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            let userData;

            if (isLogin) {
                console.log('Attempting login with:', { username, password });
                userData = await api.loginUser({ username, password });
            } else {
                console.log('Attempting registration with:', { username, password, email });
                userData = await api.registerUser({
                    username,
                    password,
                    email
                });
            }

            console.log('Response data:', userData);
            localStorage.setItem('user', JSON.stringify(userData));
            onAuthSuccess();
        } catch (err: any) {
            console.error('Authentication error:', err);

            if (err.response) {
                setError(err.response.data.detail || 'Authentication failed');
                console.error('Error response:', err.response.data);
            } else if (err.request) {
                setError('Server not responding. Please try again later.');
                console.error('No response received:', err.request);
            } else {
                setError('An unexpected error occurred. Please try again.');
                console.error('Error setting up request:', err.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-form">
            <h2>{isLogin ? 'Login' : 'Register'}</h2>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                {!isLogin && (
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                        <small className="form-help-text">This will be used for account recovery</small>
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading
                        ? (isLogin ? 'Logging in...' : 'Registering...')
                        : (isLogin ? 'Login' : 'Register')}
                </button>
            </form>

            <div className="auth-toggle">
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    disabled={isLoading}
                >
                    {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
                </button>
            </div>
        </div>
    );
};

export default AuthPage;
