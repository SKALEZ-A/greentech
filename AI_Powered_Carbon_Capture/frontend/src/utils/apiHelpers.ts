import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('carbon_capture_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('carbon_capture_token');
      localStorage.removeItem('carbon_capture_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Generic API functions
export const apiRequest = async <T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  const axiosConfig: AxiosRequestConfig = {
    method,
    url,
    ...config,
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    axiosConfig.data = data;
  }

  return apiClient.request<T>(axiosConfig);
};

// Specific HTTP method helpers
export const get = <T = any>(url: string, config?: AxiosRequestConfig) =>
  apiRequest<T>('GET', url, undefined, config);

export const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
  apiRequest<T>('POST', url, data, config);

export const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
  apiRequest<T>('PUT', url, data, config);

export const patch = <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
  apiRequest<T>('PATCH', url, data, config);

export const del = <T = any>(url: string, config?: AxiosRequestConfig) =>
  apiRequest<T>('DELETE', url, undefined, config);

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
    CHANGE_PASSWORD: '/auth/change-password',
  },

  // Units
  UNITS: {
    LIST: '/units',
    CREATE: '/units',
    GET: (id: string) => `/units/${id}`,
    UPDATE: (id: string) => `/units/${id}`,
    DELETE: (id: string) => `/units/${id}`,
    SENSORS: (id: string) => `/units/${id}/sensors`,
  },

  // Sensors
  SENSORS: {
    LIST: '/sensors',
    CREATE: '/sensors',
    GET: (id: string) => `/sensors/${id}`,
    UPDATE: (id: string) => `/sensors/${id}`,
    DELETE: (id: string) => `/sensors/${id}`,
    READINGS: (id: string) => `/sensors/${id}/readings`,
    ALERTS: (id: string) => `/sensors/${id}/alerts`,
    CALIBRATE: (id: string) => `/sensors/${id}/calibrate`,
    STATS: '/sensors/stats',
  },

  // AI
  AI: {
    OPTIMIZE_EFFICIENCY: '/ai/optimize/efficiency',
    PREDICT_MAINTENANCE: '/ai/predict/maintenance',
    OPTIMIZE_ENERGY: '/ai/optimize/energy',
    MODEL_HEALTH: '/ai/model-health',
    TRAIN_EFFICIENCY: '/ai/train/efficiency',
    TRAIN_MAINTENANCE: '/ai/train/maintenance',
    SAVE_MODELS: '/ai/models/save',
    LOAD_MODELS: '/ai/models/load',
  },

  // Carbon Credits
  CREDITS: {
    LIST: '/credits',
    CREATE: '/credits',
    GET: (id: string) => `/credits/${id}`,
    UPDATE: (id: string) => `/credits/${id}`,
    DELETE: (id: string) => `/credits/${id}`,
    TRANSFER: (id: string) => `/credits/${id}/transfer`,
    RETIRE: (id: string) => `/credits/${id}/retire`,
    MARKETPLACE: '/credits/marketplace',
    BALANCE: '/credits/balance',
  },

  // Reports
  REPORTS: {
    LIST: '/reports',
    CREATE: '/reports',
    GET: (id: string) => `/reports/${id}`,
    UPDATE: (id: string) => `/reports/${id}`,
    DELETE: (id: string) => `/reports/${id}`,
    GENERATE: '/reports/generate',
    EXPORT: (id: string) => `/reports/${id}/export`,
  },
};

// Error handling utilities
export const handleApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
};

// Success response handler
export const isSuccessResponse = (response: AxiosResponse): boolean => {
  return response.status >= 200 && response.status < 300;
};

// Pagination helpers
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const buildPaginationQuery = (params: PaginationParams): string => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.order) queryParams.set('order', params.order);

  return queryParams.toString();
};

// Filter helpers
export interface FilterParams {
  [key: string]: any;
}

export const buildFilterQuery = (filters: FilterParams): string => {
  const queryParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v.toString()));
      } else {
        queryParams.set(key, value.toString());
      }
    }
  });

  return queryParams.toString();
};

// Combine query parameters
export const buildQueryString = (
  pagination?: PaginationParams,
  filters?: FilterParams,
  additional?: Record<string, any>
): string => {
  const params = new URLSearchParams();

  // Add pagination
  if (pagination) {
    const paginationQuery = buildPaginationQuery(pagination);
    new URLSearchParams(paginationQuery).forEach((value, key) => {
      params.set(key, value);
    });
  }

  // Add filters
  if (filters) {
    const filterQuery = buildFilterQuery(filters);
    new URLSearchParams(filterQuery).forEach((value, key) => {
      params.set(key, value);
    });
  }

  // Add additional parameters
  if (additional) {
    Object.entries(additional).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value.toString());
      }
    });
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

// Data transformation utilities
export const transformApiResponse = <T>(response: AxiosResponse): T => {
  return response.data;
};

export const transformPaginatedResponse = <T>(response: AxiosResponse) => {
  return {
    data: response.data.data || response.data,
    pagination: response.data.pagination || {
      currentPage: 1,
      totalPages: 1,
      totalItems: response.data.data?.length || 0,
      hasNext: false,
      hasPrev: false,
    },
  };
};

// Cache utilities
class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

export const apiCache = new ApiCache();

// Cached API request
export const cachedApiRequest = async <T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any,
  config?: AxiosRequestConfig & { cache?: boolean; cacheTTL?: number }
): Promise<AxiosResponse<T>> => {
  const { cache = false, cacheTTL = 300000, ...axiosConfig } = config || {};

  if (cache && method === 'GET') {
    const cacheKey = `${method}:${url}:${JSON.stringify(data)}`;
    const cachedData = apiCache.get(cacheKey);

    if (cachedData) {
      return {
        data: cachedData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: axiosConfig as any,
      } as AxiosResponse<T>;
    }
  }

  const response = await apiRequest<T>(method, url, data, axiosConfig);

  if (cache && method === 'GET' && isSuccessResponse(response)) {
    const cacheKey = `${method}:${url}:${JSON.stringify(data)}`;
    apiCache.set(cacheKey, response.data, cacheTTL);
  }

  return response;
};
