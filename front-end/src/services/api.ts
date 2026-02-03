import axios from "axios";
import { useAuth } from "../state/AuthContext";

export const API_BASE_URL = "/api"; // proxy vers gateway 8080

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

// Helper hook pour axios avec token automatiquement
export function useAuthorizedApi() {
  const { token } = useAuth();

  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000
  });

  instance.interceptors.request.use((config) => {
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`
      };
    }
    return config;
  });

  return instance;
}

