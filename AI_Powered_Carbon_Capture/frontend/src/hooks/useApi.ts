import { useState, useEffect, useCallback, useRef } from 'react';
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { useAuth } from './useAuth';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: number | null;
}

export interface ApiOptions extends AxiosRequestConfig {
  skip?: boolean;
  deps?: any[];
  onSuccess?: (data: any) => void;
  onError?: (error: AxiosError) => void;
  retryCount?: number;
  retryDelay?: number;
}

export interface ApiReturn<T> extends ApiState<T> {
  refetch: () => Promise<void>;
  mutate: (data: T) => void;
  reset: () => void;
}

/**
 * Custom hook for API calls with loading, error, and caching support
 * @param url - API endpoint URL
 * @param options - API options
 * @returns API state and control functions
 */
export function useApi<T = any>(
  url: string,
  options: ApiOptions = {}
): ApiReturn<T> {
  const {
    skip = false,
    deps = [],
    onSuccess,
    onError,
    retryCount = 0,
    retryDelay = 1000,
    ...axiosOptions
  } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    status: null,
  });

  const { token } = useAuth();
  const abortControllerRef = useRef<AbortController>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Create axios instance with auth headers
  const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  // Add request interceptor for auth
  apiClient.interceptors.request.use((config) => {
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Add response interceptor for error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Handle unauthorized - redirect to login
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  const executeRequest = useCallback(async (isRetry = false) => {
    if (skip) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response: AxiosResponse<T> = await apiClient.request({
        url,
        signal: abortControllerRef.current.signal,
        ...axiosOptions,
      });

      const newState = {
        data: response.data,
        loading: false,
        error: null,
        status: response.status,
      };

      setState(newState);

      if (onSuccess && !isRetry) {
        onSuccess(response.data);
      }

    } catch (error) {
      const axiosError = error as AxiosError;

      // Don't handle aborted requests
      if (axios.isCancel(axiosError)) {
        return;
      }

      let errorMessage = 'An unexpected error occurred';
      let statusCode = null;

      if (axiosError.response) {
        statusCode = axiosError.response.status;
        const errorData = axiosError.response.data as any;

        if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else {
          errorMessage = `Request failed with status ${statusCode}`;
        }
      } else if (axiosError.request) {
        errorMessage = 'Network error - please check your connection';
      }

      // Retry logic
      if (!isRetry && retryCount > 0 && statusCode !== 401 && statusCode !== 403) {
        retryTimeoutRef.current = setTimeout(() => {
          executeRequest(true);
        }, retryDelay);

        setState(prev => ({
          ...prev,
          loading: false,
          error: `${errorMessage} - Retrying in ${retryDelay}ms...`,
          status: statusCode,
        }));

        return;
      }

      const newState = {
        data: null,
        loading: false,
        error: errorMessage,
        status: statusCode,
      };

      setState(newState);

      if (onError && !isRetry) {
        onError(axiosError);
      }
    }
  }, [url, axiosOptions, skip, onSuccess, onError, retryCount, retryDelay, token]);

  const refetch = useCallback(async () => {
    await executeRequest();
  }, [executeRequest]);

  const mutate = useCallback((data: T) => {
    setState(prev => ({
      ...prev,
      data,
      error: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      status: null,
    });
  }, []);

  // Execute request on mount and when dependencies change
  useEffect(() => {
    executeRequest();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, deps);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    refetch,
    mutate,
    reset,
  };
}

/**
 * Hook for GET requests
 */
export function useGet<T = any>(url: string, options: ApiOptions = {}) {
  return useApi<T>(url, { ...options, method: 'GET' });
}

/**
 * Hook for POST requests
 */
export function usePost<T = any>(url: string, options: ApiOptions = {}) {
  return useApi<T>(url, { ...options, method: 'POST' });
}

/**
 * Hook for PUT requests
 */
export function usePut<T = any>(url: string, options: ApiOptions = {}) {
  return useApi<T>(url, { ...options, method: 'PUT' });
}

/**
 * Hook for DELETE requests
 */
export function useDelete<T = any>(url: string, options: ApiOptions = {}) {
  return useApi<T>(url, { ...options, method: 'DELETE' });
}

/**
 * Hook for PATCH requests
 */
export function usePatch<T = any>(url: string, options: ApiOptions = {}) {
  return useApi<T>(url, { ...options, method: 'PATCH' });
}
