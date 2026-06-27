import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/auth";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token automatically
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

const authService = {
  // Register Student
  register: async (userData) => {
    const response = await api.post("/register", userData);

    return response.data;
  },

  // Login Student
  login: async (credentials) => {
    const response = await api.post("/login", credentials);

    const data = response.data;

    if (data?.token) {
      sessionStorage.setItem("token", data.token);

      if (data.user) {
        sessionStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );
      }
    }

    return data;
  },

  // Logout
  logout: () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    window.location.href = "/login";
  },

  // Current User
  getCurrentUser: () => {
    const user = sessionStorage.getItem("user");

    return user ? JSON.parse(user) : null;
  },

  // Token
  getToken: () => {
    return sessionStorage.getItem("token");
  },

  // Logged In?
  isAuthenticated: () => {
    return !!sessionStorage.getItem("token");
  },

  // Profile
  getProfile: async () => {
    const response = await api.get("/profile");

    return response.data;
  },

  // Update Profile
  updateProfile: async (profileData) => {
    const response = await api.put(
      "/profile",
      profileData
    );

    return response.data;
  },
};

export default authService;