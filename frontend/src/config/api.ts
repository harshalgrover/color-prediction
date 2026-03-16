// Centralized API configuration
// For APK/mobile: uses the local network IP so the phone can reach the backend
// For localhost dev: also works since 10.7.25.60 resolves to this machine

const API_HOST = '10.7.25.60';
const API_PORT = 5005;

export const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;
export const SOCKET_URL = `http://${API_HOST}:${API_PORT}`;
