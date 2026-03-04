import axios from 'axios'

// In Electron, API is on localhost:8000; in dev, Vite proxy handles /api
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// User ID — in production this comes from Electron auth or env
const USER_ID = import.meta.env.VITE_USER_ID || 'dev-user-001'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': USER_ID,
  },
})

// Allow overriding user at runtime (for multi-user dev)
export function setUserId(uid: string) {
  apiClient.defaults.headers['X-User-ID'] = uid
}
