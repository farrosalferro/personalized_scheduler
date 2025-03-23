import React, { useState } from 'react';
import { loginUser } from '../api';

interface LoginProps {
    onLoginSuccess?: () => void;
    onSwitchToRegister?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const userData = await loginUser({
                username,
                password
            });

            // Store user info in localStorage
            if (userData && userData.id) {
                localStorage.setItem('user', JSON.stringify(userData));

                // Call the success callback
                if (onLoginSuccess) {
                    onLoginSuccess();
                }
            } else {
                setError('Invalid response from server');
            }
        } catch (error: any) {
            if (error.response && error.response.data) {
                setError(error.response.data.detail || 'Login failed');
            } else {
                setError('Login failed. Please try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <h2>Login to Your Account</h2>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        placeholder="Your username"
                        disabled={isLoading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Your password"
                        disabled={isLoading}
                    />
                </div>

                <button
                    type="submit"
                    className="login-button"
                    disabled={isLoading}
                >
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
            </form>

            <div className="register-prompt">
                <p>Don't have an account?</p>
                <button
                    className="switch-to-register-button"
                    onClick={onSwitchToRegister}
                >
                    Create Account
                </button>
            </div>
        </div>
    );
};

export default Login;
