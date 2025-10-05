// API Service for Carbon Capture Network
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  // Authentication
  async login(credentials: { email: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: any) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Units
  async getUnits(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/units${queryString}`);
  }

  async getUnit(id: string) {
    return this.request(`/units/${id}`);
  }

  async createUnit(unitData: any) {
    return this.request('/units', {
      method: 'POST',
      body: JSON.stringify(unitData),
    });
  }

  async updateUnit(id: string, unitData: any) {
    return this.request(`/units/${id}`, {
      method: 'PUT',
      body: JSON.stringify(unitData),
    });
  }

  async deleteUnit(id: string) {
    return this.request(`/units/${id}`, {
      method: 'DELETE',
    });
  }

  async optimizeUnit(unitId: string, operationalData?: any) {
    return this.request(`/ai/optimize/${unitId}`, {
      method: 'POST',
      body: JSON.stringify({ operationalData }),
    });
  }

  // Sensors
  async getSensors(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/sensors${queryString}`);
  }

  async getSensor(id: string) {
    return this.request(`/sensors/${id}`);
  }

  async createSensor(sensorData: any) {
    return this.request('/sensors', {
      method: 'POST',
      body: JSON.stringify(sensorData),
    });
  }

  async updateSensor(id: string, sensorData: any) {
    return this.request(`/sensors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sensorData),
    });
  }

  async addSensorReading(sensorId: string, reading: any) {
    return this.request(`/sensors/${sensorId}/reading`, {
      method: 'POST',
      body: JSON.stringify(reading),
    });
  }

  // AI Analytics
  async getAIModelHealth() {
    return this.request('/ai/health');
  }

  async getUnitAnalytics(unitId: string, timeframe?: string) {
    const queryString = timeframe ? `?timeframe=${timeframe}` : '';
    return this.request(`/ai/analytics/${unitId}${queryString}`);
  }

  async getNetworkInsights() {
    return this.request('/ai/insights');
  }

  // Carbon Credits
  async getCredits(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/credits${queryString}`);
  }

  async getCredit(id: string) {
    return this.request(`/credits/${id}`);
  }

  async mintCredits(creditData: any) {
    return this.request('/credits/mint', {
      method: 'POST',
      body: JSON.stringify(creditData),
    });
  }

  async transferCredits(creditId: string, transferData: any) {
    return this.request(`/credits/${creditId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(transferData),
    });
  }

  async retireCredits(creditId: string, retirementData: any) {
    return this.request(`/credits/${creditId}/retire`, {
      method: 'POST',
      body: JSON.stringify(retirementData),
    });
  }

  async getCreditMarket() {
    return this.request('/credits/market');
  }

  // Reports
  async getUnitPerformanceReport(unitId: string, params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/reports/units/${unitId}/performance${queryString}`);
  }

  async getNetworkPerformanceReport(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/reports/network/performance${queryString}`);
  }

  async getCarbonCreditReport(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/reports/credits${queryString}`);
  }

  async getEnvironmentalImpactReport(params?: any) {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request(`/reports/environmental${queryString}`);
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void): WebSocket | null {
    if (typeof window === 'undefined') return null;

    const wsUrl = this.baseURL.replace('http', 'ws');
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
