// Central API configuration
// In development: Vite proxy forwards /api/* to http://localhost:5000
// In production: change API_BASE_URL to your deployed backend URL

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default API_BASE_URL;
