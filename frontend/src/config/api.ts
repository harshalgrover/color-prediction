// Centralized API configuration
// Use environment variables or fallback to local IP for development
const API_URL = import.meta.env.VITE_API_URL || '';
const API_HOST = import.meta.env.VITE_API_HOST || '10.7.25.60';
const API_PORT = import.meta.env.VITE_API_PORT || '5005';

export const API_BASE_URL = API_URL || `http://${API_HOST}:${API_PORT}`;
export const SOCKET_URL = API_URL || `http://${API_HOST}:${API_PORT}`;
