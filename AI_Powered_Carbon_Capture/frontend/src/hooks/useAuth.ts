import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { useRouter } from 'next/router';
import jwtDecode from 'jwt-decode';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'operator';
  isActive: boolean;
  isVerified: boolean;
  carbonCredits: {
    totalCredits: number;
    availableCredits: number;
    retiredCredits: number;
    totalValue: number;
    transactions: any[];
  };
  preferences: {
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    dashboard: {
      defaultView: string;
      theme: string;
    };
  };
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (userData: RegisterData) => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'carbon_capture_token';
const USER_KEY = 'carbon_capture_user';
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const router = useRouter();

  // Check if token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  };

  // Check if token needs refresh
  const shouldRefreshToken = (token: string): boolean => {
    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      const timeUntilExpiry = decoded.exp - currentTime;
      return timeUntilExpiry < TOKEN_REFRESH_THRESHOLD;
    } catch (error) {
      return false;
    }
  };

  // Get stored auth data
  const getStoredAuth = () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const userStr = localStorage.getItem(USER_KEY);

      if (token && userStr) {
        const user = JSON.parse(userStr);

        // Check if token is still valid
        if (!isTokenExpired(token)) {
          return { token, user };
        } else {
          // Token expired, clear storage
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      }
    } catch (error) {
      console.error('Error reading stored auth data:', error);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    return { token: null, user: null };
  };

  // Store auth data
  const storeAuth = (token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  };

  // Clear stored auth data
  const clearStoredAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  // Update state
  const updateState = (updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const { token, user } = data;

      // Store auth data
      storeAuth(token, user);

      // Update state
      updateState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Redirect to dashboard
      router.push('/dashboard');

    } catch (error: any) {
      updateState({
        isLoading: false,
        error: error.message || 'Login failed',
      });
      throw error;
    }
  };

  // Register function
  const register = async (userData: RegisterData) => {
    try {
      updateState({ isLoading: true, error: null });

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Automatically login after successful registration
      await login(userData.email, userData.password);

    } catch (error: any) {
      updateState({
        isLoading: false,
        error: error.message || 'Registration failed',
      });
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    clearStoredAuth();
    updateState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    router.push('/login');
  };

  // Update profile function
  const updateProfile = async (userData: Partial<User>) => {
    try {
      if (!state.token) {
        throw new Error('Not authenticated');
      }

      updateState({ isLoading: true, error: null });

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Profile update failed');
      }

      const updatedUser = { ...state.user, ...data.user };

      // Update stored user data
      if (state.token) {
        storeAuth(state.token, updatedUser);
      }

      updateState({
        user: updatedUser,
        isLoading: false,
        error: null,
      });

    } catch (error: any) {
      updateState({
        isLoading: false,
        error: error.message || 'Profile update failed',
      });
      throw error;
    }
  };

  // Refresh token function
  const refreshToken = async () => {
    try {
      if (!state.token) {
        throw new Error('No token to refresh');
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Token refresh failed');
      }

      const { token } = data;

      // Update stored token
      if (state.user) {
        storeAuth(token, state.user);
      }

      updateState({ token });

    } catch (error: any) {
      console.error('Token refresh failed:', error);
      // If refresh fails, logout user
      logout();
      throw error;
    }
  };

  // Clear error function
  const clearError = () => {
    updateState({ error: null });
  };

  // Initialize auth state on mount
  useEffect(() => {
    const { token, user } = getStoredAuth();

    if (token && user) {
      // Check if token needs refresh
      if (shouldRefreshToken(token)) {
        refreshToken().catch(() => {
          // If refresh fails, continue with current token
          updateState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        });
      } else {
        updateState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      }
    } else {
      updateState({ isLoading: false });
    }
  }, []);

  // Set up token refresh timer
  useEffect(() => {
    if (!state.token) return;

    const checkTokenExpiry = () => {
      if (isTokenExpired(state.token!)) {
        logout();
      } else if (shouldRefreshToken(state.token!)) {
        refreshToken().catch(console.error);
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60 * 1000);

    return () => clearInterval(interval);
  }, [state.token]);

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    register,
    updateProfile,
    refreshToken,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push('/login');
      }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading) {
      return <div>Loading...</div>; // You can replace with a proper loading component
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}

// Hook for checking permissions
export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (permission: string) => {
    if (!user) return false;

    // Admin has all permissions
    if (user.role === 'admin') return true;

    // Define role-based permissions
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      operator: [
        'read:units',
        'update:units',
        'read:sensors',
        'update:sensors',
        'read:reports',
        'create:maintenance',
        'read:carbon-credits'
      ],
      user: [
        'read:own-units',
        'read:own-sensors',
        'read:own-reports',
        'read:own-carbon-credits',
        'update:own-profile'
      ],
    };

    const permissions = rolePermissions[user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
  };

  const hasRole = (role: string) => {
    return user?.role === role;
  };

  return {
    hasPermission,
    hasRole,
    user,
    isAdmin: user?.role === 'admin',
    isOperator: user?.role === 'operator',
    isUser: user?.role === 'user',
  };
}
