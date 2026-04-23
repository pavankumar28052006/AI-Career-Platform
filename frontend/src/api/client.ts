import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "Incorrect email or password.",
  FILE_TOO_LARGE:           "Your file exceeds 5MB. Please compress and retry.",
  INVALID_FILE_TYPE:        "Only PDF and TXT files are accepted.",
  RESUME_INVALID_TYPE:      "Only PDF and TXT files are supported.",
  RESUME_TOO_LARGE:         "Resume must be smaller than 5MB.",
  RESUME_EMPTY:             "Uploaded file is empty.",
  RESUME_PARSE_ERROR:       "Could not read the uploaded file contents.",
  JOB_STILL_PROCESSING:     "Your resume is still being processed.",
  JOB_NOT_FOUND:            "We couldn't find your analysis. Please upload again.",
  INTERNAL_SERVER_ERROR:    "Something went wrong on our end. Please try again.",
};

const client = axios.create({
  baseURL: API_BASE_URL,
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = "An unexpected error occurred.";
    if (error.response?.data?.detail) {
      const { code } = error.response.data.detail;
      message = ERROR_MESSAGES[code] || error.response.data.detail.message || message;
    } else if (error.message) {
      message = error.message;
    }
    
    return Promise.reject({
      message,
      original: error,
    });
  }
);

export default client;
