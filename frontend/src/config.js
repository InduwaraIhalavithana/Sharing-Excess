// Central API configuration.
// Set VITE_API_BASE_URL and VITE_APP_ROOT_URL in frontend/.env to override for production.

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost/Sharing%20Excess/backend';
export const APP_ROOT = import.meta.env.VITE_APP_ROOT_URL ?? 'http://localhost/Sharing%20Excess';
