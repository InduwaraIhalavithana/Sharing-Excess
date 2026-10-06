// Central API configuration.
// Set VITE_API_BASE_URL and VITE_APP_ROOT_URL in frontend/.env to override (empty = same origin, behind nginx).

export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8003';
export const APP_ROOT: string = import.meta.env.VITE_APP_ROOT_URL ?? 'http://localhost:5175';
