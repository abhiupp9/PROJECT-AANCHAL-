// Central API configuration
// Development: Vite proxy forwards /api/* → http://localhost:5000
// Production:  Set VITE_API_URL in client/.env.production to your deployed backend URL
//              e.g. VITE_API_URL=https://your-backend.railway.app

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default API_BASE_URL;
