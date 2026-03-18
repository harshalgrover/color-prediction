// Centralized API configuration — production only
const API_URL = import.meta.env.VITE_API_URL || 'https://color-prediction-production.up.railway.app';

export const API_BASE_URL = API_URL;
export const SOCKET_URL = API_URL;
