import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = sessionStorage.getItem("user");
        const storedToken = sessionStorage.getItem("token");

        if (storedUser && storedToken) {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
        }

        setLoading(false);
    }, []);

    const login = (userData, jwtToken) => {
        sessionStorage.setItem("user", JSON.stringify(userData));
        sessionStorage.setItem("token", jwtToken);

        setUser(userData);
        setToken(jwtToken);
    };

    const logout = () => {
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("token");

        setUser(null);
        setToken(null);

        window.location.href = "/login";
    };

    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                login,
                logout,
                isAuthenticated,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};

export default AuthContext;