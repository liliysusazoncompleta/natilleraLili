import axios from "axios";
import { resolveApiConfig } from "./api-config.mjs";

export const apiConfig = resolveApiConfig(import.meta.env.VITE_API_URL, import.meta.env.PROD);

export const api = axios.create({
  baseURL: apiConfig.url
});

api.interceptors.request.use((config) => {
  if (apiConfig.error) throw new Error(apiConfig.error);
  const token = localStorage.getItem("natillera_access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
