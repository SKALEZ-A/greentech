/**
 * Performance Monitoring Service
 * Monitors system performance, tracks metrics, and provides insights
 */

const os = require('os');
const { performance } = require('perf_hooks');
const mongoose = require('mongoose');

class PerformanceService {
  constructor() {
    this.metrics = {
      responseTime: [],
      memoryUsage: [],
      cpuUsage: [],
      databaseConnections: [],
      activeUsers: [],
      apiCalls: new Map()
    };

    this.alerts = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start performance monitoring
   * @param {number} intervalMs - Monitoring interval in milliseconds
   */
  startMonitoring(intervalMs = 60000) { // Default 1 minute
    if (this.isMonitoring) {
      console.warn('Performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    console.log('Starting performance monitoring...');

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkThresholds();
    }, intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  /**
   * Collect current system metrics
   */
  collectMetrics() {
    const timestamp = new Date();

    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    this.metrics.memoryUsage.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      systemTotal: totalMemory,
      systemFree: freeMemory,
      systemUsed: totalMemory - freeMemory
    });

    // CPU usage
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total);
    }, 0) / cpus.length;

    this.metrics.cpuUsage.push({
      timestamp,
      usage: cpuUsage * 100, // Convert to percentage
      cores: cpus.length
    });

    // Database connections
    if (mongoose.connection.readyState === 1) {
      this.metrics.databaseConnections.push({
        timestamp,
        connections: mongoose.connection.db.serverConfig.s.pool.size || 0,
        available: mongoose.connection.db.serverConfig.s.pool.available || 0
      });
    }

    // Keep only last 100 entries for each metric
    Object.keys(this.metrics).forEach(key => {
      if (Array.isArray(this.metrics[key]) && this.metrics[key].length > 100) {
        this.metrics[key] = this.metrics[key].slice(-100);
      }
    });
  }

  /**
   * Track API response time
   * @param {string} endpoint - API endpoint
   * @param {number} responseTime - Response time in milliseconds
   * @param {number} statusCode - HTTP status code
   */
  trackApiResponse(endpoint, responseTime, statusCode) {
    if (!this.metrics.apiCalls.has(endpoint)) {
      this.metrics.apiCalls.set(endpoint, []);
    }

    this.metrics.apiCalls.get(endpoint).push({
      timestamp: new Date(),
      responseTime,
      statusCode,
      success: statusCode < 400
    });

    // Keep only last 100 calls per endpoint
    const calls = this.metrics.apiCalls.get(endpoint);
    if (calls.length > 100) {
      this.metrics.apiCalls.set(endpoint, calls.slice(-100));
    }
  }

  /**
   * Track active users
   * @param {number} count - Number of active users
   */
  trackActiveUsers(count) {
    this.metrics.activeUsers.push({
      timestamp: new Date(),
      count
    });
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  checkThresholds() {
    const thresholds = {
      memoryUsage: 0.85, // 85% memory usage
      cpuUsage: 0.80,    // 80% CPU usage
      responseTime: 5000, // 5 seconds average response time
      errorRate: 0.05    // 5% error rate
    };

    // Memory threshold check
    const latestMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    if (latestMemory) {
      const memoryUsageRatio = latestMemory.heapUsed / latestMemory.systemTotal;
      if (memoryUsageRatio > thresholds.memoryUsage) {
        this.createAlert('HIGH_MEMORY_USAGE', {
          message: `Memory usage is ${Math.round(memoryUsageRatio * 100)}%`,
          value: memoryUsageRatio,
          threshold: thresholds.memoryUsage
        });
      }
    }

    // CPU threshold check
    const latestCpu = this.metrics.cpuUsage[this.metrics.cpuUsage.length - 1];
    if (latestCpu && latestCpu.usage > thresholds.cpuUsage * 100) {
      this.createAlert('HIGH_CPU_USAGE', {
        message: `CPU usage is ${Math.round(latestCpu.usage)}%`,
        value: latestCpu.usage / 100,
        threshold: thresholds.cpuUsage
      });
    }

    // API performance check
    this.metrics.apiCalls.forEach((calls, endpoint) => {
      if (calls.length < 10) return; // Need minimum calls for meaningful average

      const recentCalls = calls.slice(-10); // Last 10 calls
      const avgResponseTime = recentCalls.reduce((sum, call) => sum + call.responseTime, 0) / recentCalls.length;
      const errorRate = recentCalls.filter(call => !call.success).length / recentCalls.length;

      if (avgResponseTime > thresholds.responseTime) {
        this.createAlert('SLOW_API_RESPONSE', {
          message: `Average response time for ${endpoint} is ${Math.round(avgResponseTime)}ms`,
          endpoint,
          value: avgResponseTime,
          threshold: thresholds.responseTime
        });
      }

      if (errorRate > thresholds.errorRate) {
        this.createAlert('HIGH_ERROR_RATE', {
          message: `Error rate for ${endpoint} is ${Math.round(errorRate * 100)}%`,
          endpoint,
          value: errorRate,
          threshold: thresholds.errorRate
        });
      }
    });
  }

  /**
   * Create performance alert
   * @param {string} type - Alert type
   * @param {Object} data - Alert data
   */
  createAlert(type, data) {
    const alert = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: this.getAlertSeverity(type),
      timestamp: new Date(),
      ...data
    };

    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    console.warn(`Performance Alert: ${alert.message}`);

    // TODO: Send alert to monitoring system or administrators
    // this.notificationService.sendPerformanceAlert(alert);
  }

  /**
   * Get alert severity based on type
   * @param {string} type - Alert type
   * @returns {string} Severity level
   */
  getAlertSeverity(type) {
    const severityMap = {
      'HIGH_MEMORY_USAGE': 'critical',
      'HIGH_CPU_USAGE': 'high',
      'SLOW_API_RESPONSE': 'medium',
      'HIGH_ERROR_RATE': 'high',
      'DATABASE_CONNECTION_ISSUE': 'critical'
    };

    return severityMap[type] || 'low';
  }

  /**
   * Get current performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const getLatest = (array) => array[array.length - 1] || null;
    const getAverage = (array, key, count = 10) => {
      if (array.length === 0) return null;
      const recent = array.slice(-count);
      return recent.reduce((sum, item) => sum + item[key], 0) / recent.length;
    };

    return {
      memory: {
        current: getLatest(this.metrics.memoryUsage),
        average: getAverage(this.metrics.memoryUsage, 'heapUsed')
      },
      cpu: {
        current: getLatest(this.metrics.cpuUsage),
        average: getAverage(this.metrics.cpuUsage, 'usage')
      },
      database: {
        current: getLatest(this.metrics.databaseConnections),
        average: getAverage(this.metrics.databaseConnections, 'connections')
      },
      users: {
        current: getLatest(this.metrics.activeUsers),
        average: getAverage(this.metrics.activeUsers, 'count')
      },
      api: {
        endpoints: Array.from(this.metrics.apiCalls.entries()).map(([endpoint, calls]) => ({
          endpoint,
          totalCalls: calls.length,
          successRate: calls.filter(c => c.success).length / calls.length,
          averageResponseTime: calls.reduce((sum, c) => sum + c.responseTime, 0) / calls.length
        }))
      },
      alerts: this.alerts.slice(-10), // Last 10 alerts
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Get performance report
   * @param {string} period - Time period ('hour', 'day', 'week')
   * @returns {Object} Performance report
   */
  getReport(period = 'hour') {
    const periods = {
      hour: 60,   // 60 minutes
      day: 1440,  // 24 hours
      week: 10080 // 7 days
    };

    const minutes = periods[period] || 60;
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const filterRecent = (array) => array.filter(item => item.timestamp > cutoff);

    const report = {
      period,
      timestamp: new Date(),
      summary: {
        avgMemoryUsage: this.calculateAverage(filterRecent(this.metrics.memoryUsage), 'heapUsed'),
        avgCpuUsage: this.calculateAverage(filterRecent(this.metrics.cpuUsage), 'usage'),
        avgResponseTime: this.calculateAverageApiResponseTime(filterRecent(this.metrics.apiCalls)),
        totalApiCalls: this.countTotalApiCalls(filterRecent(this.metrics.apiCalls)),
        errorRate: this.calculateErrorRate(filterRecent(this.metrics.apiCalls))
      },
      alerts: this.alerts.filter(alert => alert.timestamp > cutoff),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Calculate average value from metric array
   * @param {Array} metrics - Metrics array
   * @param {string} key - Key to average
   * @returns {number|null} Average value
   */
  calculateAverage(metrics, key) {
    if (metrics.length === 0) return null;
    return metrics.reduce((sum, metric) => sum + metric[key], 0) / metrics.length;
  }

  /**
   * Calculate average API response time
   * @param {Map} apiCalls - API calls map
   * @returns {number|null} Average response time
   */
  calculateAverageApiResponseTime(apiCalls) {
    let totalTime = 0;
    let totalCalls = 0;

    apiCalls.forEach(calls => {
      calls.forEach(call => {
        totalTime += call.responseTime;
        totalCalls++;
      });
    });

    return totalCalls > 0 ? totalTime / totalCalls : null;
  }

  /**
   * Count total API calls
   * @param {Map} apiCalls - API calls map
   * @returns {number} Total calls
   */
  countTotalApiCalls(apiCalls) {
    let total = 0;
    apiCalls.forEach(calls => {
      total += calls.length;
    });
    return total;
  }

  /**
   * Calculate error rate
   * @param {Map} apiCalls - API calls map
   * @returns {number|null} Error rate
   */
  calculateErrorRate(apiCalls) {
    let totalCalls = 0;
    let errorCalls = 0;

    apiCalls.forEach(calls => {
      calls.forEach(call => {
        totalCalls++;
        if (!call.success) errorCalls++;
      });
    });

    return totalCalls > 0 ? errorCalls / totalCalls : null;
  }

  /**
   * Generate performance recommendations
   * @returns {Array} Recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const metrics = this.getMetrics();

    // Memory recommendations
    if (metrics.memory.current) {
      const memoryUsage = metrics.memory.current.heapUsed / metrics.memory.current.systemTotal;
      if (memoryUsage > 0.8) {
        recommendations.push({
          type: 'memory',
          priority: 'high',
          message: 'High memory usage detected. Consider increasing memory limits or optimizing memory usage.',
          action: 'Increase memory allocation or implement memory optimization strategies.'
        });
      }
    }

    // CPU recommendations
    if (metrics.cpu.current && metrics.cpu.current.usage > 70) {
      recommendations.push({
        type: 'cpu',
        priority: 'high',
        message: 'High CPU usage detected. Consider scaling horizontally or optimizing CPU-intensive operations.',
        action: 'Implement horizontal scaling or optimize performance-critical code paths.'
      });
    }

    // API recommendations
    metrics.api.endpoints.forEach(endpoint => {
      if (endpoint.averageResponseTime > 2000) {
        recommendations.push({
          type: 'api',
          priority: 'medium',
          message: `Slow response time for ${endpoint.endpoint}: ${Math.round(endpoint.averageResponseTime)}ms`,
          action: 'Optimize database queries, implement caching, or scale the service.'
        });
      }

      if (endpoint.successRate < 0.95) {
        recommendations.push({
          type: 'api',
          priority: 'high',
          message: `High error rate for ${endpoint.endpoint}: ${Math.round((1 - endpoint.successRate) * 100)}%`,
          action: 'Investigate and fix API errors, implement better error handling.'
        });
      }
    });

    return recommendations;
  }

  /**
   * Export metrics for external monitoring systems
   * @returns {Object} Metrics in Prometheus format
   */
  exportMetrics() {
    const metrics = this.getMetrics();

    return {
      memory_heap_used: metrics.memory.current?.heapUsed || 0,
      memory_heap_total: metrics.memory.current?.heapTotal || 0,
      memory_system_used: metrics.memory.current?.systemUsed || 0,
      memory_system_total: metrics.memory.current?.systemTotal || 0,
      cpu_usage_percent: metrics.cpu.current?.usage || 0,
      database_connections: metrics.database.current?.connections || 0,
      active_users: metrics.users.current?.count || 0,
      api_calls_total: metrics.api.endpoints.reduce((sum, ep) => sum + ep.totalCalls, 0),
      alerts_active: metrics.alerts.filter(a => !a.resolved).length
    };
  }
}

module.exports = new PerformanceService();
