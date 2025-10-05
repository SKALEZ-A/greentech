/**
 * WebSocket Service for Real-time Communication
 * Handles real-time updates for sensor data, alerts, and system status
 */

const jwt = require('jsonwebtoken');
const { SensorData, CarbonCaptureUnit, User } = require('../models');
const notificationService = require('./notificationService');

class WebSocketService {
  constructor() {
    this.clients = new Map(); // userId -> Set of socket connections
    this.unitSubscriptions = new Map(); // unitId -> Set of userIds
    this.alertSubscriptions = new Map(); // userId -> alert preferences
  }

  /**
   * Initialize WebSocket server
   * @param {Object} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io;

    // Middleware for authentication
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;

        // Get user details
        const user = await User.findById(decoded.userId);
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.user = user;
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected via WebSocket`);

      this.addClient(socket.userId, socket);

      // Handle client events
      socket.on('subscribe:unit', (unitId) => this.handleUnitSubscription(socket, unitId));
      socket.on('unsubscribe:unit', (unitId) => this.handleUnitUnsubscription(socket, unitId));
      socket.on('subscribe:alerts', (preferences) => this.handleAlertSubscription(socket, preferences));
      socket.on('unsubscribe:alerts', () => this.handleAlertUnsubscription(socket));

      socket.on('disconnect', () => this.handleDisconnect(socket));
      socket.on('error', (error) => console.error('Socket error:', error));
    });

    console.log('WebSocket service initialized');
  }

  /**
   * Add client connection
   * @param {string} userId - User ID
   * @param {Object} socket - Socket connection
   */
  addClient(userId, socket) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(socket);
  }

  /**
   * Remove client connection
   * @param {string} userId - User ID
   * @param {Object} socket - Socket connection
   */
  removeClient(userId, socket) {
    if (this.clients.has(userId)) {
      this.clients.get(userId).delete(socket);
      if (this.clients.get(userId).size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  /**
   * Handle unit subscription
   * @param {Object} socket - Socket connection
   * @param {string} unitId - Unit ID to subscribe to
   */
  async handleUnitSubscription(socket, unitId) {
    try {
      // Verify user has access to this unit
      const unit = await CarbonCaptureUnit.findById(unitId);
      if (!unit) {
        socket.emit('error', { message: 'Unit not found' });
        return;
      }

      // Check permissions (admin can access all, operators only their units)
      const hasAccess = socket.userRole === 'admin' ||
        unit.operators.some(op => op.toString() === socket.userId);

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Add subscription
      if (!this.unitSubscriptions.has(unitId)) {
        this.unitSubscriptions.set(unitId, new Set());
      }
      this.unitSubscriptions.get(unitId).add(socket.userId);

      socket.emit('subscribed:unit', { unitId });

      console.log(`User ${socket.userId} subscribed to unit ${unitId}`);
    } catch (error) {
      console.error('Unit subscription error:', error);
      socket.emit('error', { message: 'Subscription failed' });
    }
  }

  /**
   * Handle unit unsubscription
   * @param {Object} socket - Socket connection
   * @param {string} unitId - Unit ID to unsubscribe from
   */
  handleUnitUnsubscription(socket, unitId) {
    if (this.unitSubscriptions.has(unitId)) {
      this.unitSubscriptions.get(unitId).delete(socket.userId);
      if (this.unitSubscriptions.get(unitId).size === 0) {
        this.unitSubscriptions.delete(unitId);
      }
    }

    socket.emit('unsubscribed:unit', { unitId });
    console.log(`User ${socket.userId} unsubscribed from unit ${unitId}`);
  }

  /**
   * Handle alert subscription
   * @param {Object} socket - Socket connection
   * @param {Object} preferences - Alert preferences
   */
  handleAlertSubscription(socket, preferences) {
    this.alertSubscriptions.set(socket.userId, {
      email: preferences.email || false,
      websocket: preferences.websocket !== false, // default true
      sms: preferences.sms || false,
      severity: preferences.severity || ['high', 'critical'], // default high and critical
      types: preferences.types || ['sensor_failure', 'efficiency_drop', 'maintenance_required']
    });

    socket.emit('subscribed:alerts', preferences);
    console.log(`User ${socket.userId} subscribed to alerts`);
  }

  /**
   * Handle alert unsubscription
   * @param {Object} socket - Socket connection
   */
  handleAlertUnsubscription(socket) {
    this.alertSubscriptions.delete(socket.userId);
    socket.emit('unsubscribed:alerts');
    console.log(`User ${socket.userId} unsubscribed from alerts`);
  }

  /**
   * Handle client disconnect
   * @param {Object} socket - Socket connection
   */
  handleDisconnect(socket) {
    console.log(`User ${socket.userId} disconnected`);

    // Remove from all subscriptions
    this.unitSubscriptions.forEach((userIds, unitId) => {
      userIds.delete(socket.userId);
      if (userIds.size === 0) {
        this.unitSubscriptions.delete(unitId);
      }
    });

    this.alertSubscriptions.delete(socket.userId);
    this.removeClient(socket.userId, socket);
  }

  /**
   * Broadcast sensor data update to subscribed users
   * @param {string} unitId - Unit ID
   * @param {Object} sensorData - Sensor data
   */
  async broadcastSensorUpdate(unitId, sensorData) {
    const subscribers = this.unitSubscriptions.get(unitId);
    if (!subscribers) return;

    const eventData = {
      unitId,
      sensorId: sensorData._id,
      sensorType: sensorData.sensor_type,
      value: sensorData.readings.current.value,
      timestamp: sensorData.readings.current.timestamp,
      quality: sensorData.readings.current.quality
    };

    // Send to all subscribers
    for (const userId of subscribers) {
      const userSockets = this.clients.get(userId);
      if (userSockets) {
        userSockets.forEach(socket => {
          socket.emit('sensor:update', eventData);
        });
      }
    }
  }

  /**
   * Broadcast unit status update
   * @param {string} unitId - Unit ID
   * @param {Object} statusData - Status data
   */
  async broadcastUnitStatus(unitId, statusData) {
    const subscribers = this.unitSubscriptions.get(unitId);
    if (!subscribers) return;

    const eventData = {
      unitId,
      status: statusData.status,
      efficiency: statusData.efficiency,
      timestamp: new Date(),
      ...statusData
    };

    for (const userId of subscribers) {
      const userSockets = this.clients.get(userId);
      if (userSockets) {
        userSockets.forEach(socket => {
          socket.emit('unit:status', eventData);
        });
      }
    }
  }

  /**
   * Send alert to subscribed users
   * @param {string} unitId - Unit ID
   * @param {Object} alert - Alert data
   */
  async sendAlert(unitId, alert) {
    const subscribers = this.unitSubscriptions.get(unitId);
    if (!subscribers) return;

    const alertData = {
      id: alert._id,
      unitId,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      timestamp: alert.timestamp,
      acknowledged: alert.acknowledged
    };

    for (const userId of subscribers) {
      const userPreferences = this.alertSubscriptions.get(userId);
      if (!userPreferences || !userPreferences.websocket) continue;

      // Check if user wants this type/severity of alert
      if (!userPreferences.severity.includes(alert.severity)) continue;
      if (!userPreferences.types.includes(alert.type)) continue;

      const userSockets = this.clients.get(userId);
      if (userSockets) {
        userSockets.forEach(socket => {
          socket.emit('alert:new', alertData);
        });
      }

      // Send email/SMS if configured
      if (userPreferences.email || userPreferences.sms) {
        try {
          const user = await User.findById(userId);
          if (user) {
            await notificationService.sendAlert(user, alert, userPreferences);
          }
        } catch (error) {
          console.error('Failed to send alert notification:', error);
        }
      }
    }
  }

  /**
   * Broadcast AI optimization result
   * @param {string} unitId - Unit ID
   * @param {Object} optimizationResult - AI optimization result
   */
  async broadcastOptimizationResult(unitId, optimizationResult) {
    const subscribers = this.unitSubscriptions.get(unitId);
    if (!subscribers) return;

    const eventData = {
      unitId,
      optimizationId: optimizationResult._id,
      strategy: optimizationResult.strategy,
      recommendations: optimizationResult.recommendations,
      projectedEfficiency: optimizationResult.projected_efficiency,
      timestamp: optimizationResult.timestamp
    };

    for (const userId of subscribers) {
      const userSockets = this.clients.get(userId);
      if (userSockets) {
        userSockets.forEach(socket => {
          socket.emit('optimization:result', eventData);
        });
      }
    }
  }

  /**
   * Send notification to specific user
   * @param {string} userId - User ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  sendToUser(userId, event, data) {
    const userSockets = this.clients.get(userId);
    if (userSockets) {
      userSockets.forEach(socket => {
        socket.emit(event, data);
      });
    }
  }

  /**
   * Send notification to all connected users with specific role
   * @param {string} role - User role
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  async sendToRole(role, event, data) {
    try {
      const users = await User.find({ role });
      for (const user of users) {
        this.sendToUser(user._id.toString(), event, data);
      }
    } catch (error) {
      console.error('Failed to send role notification:', error);
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connectedUsers: this.clients.size,
      totalConnections: Array.from(this.clients.values()).reduce((sum, sockets) => sum + sockets.size, 0),
      unitSubscriptions: this.unitSubscriptions.size,
      alertSubscriptions: this.alertSubscriptions.size
    };
  }
}

module.exports = new WebSocketService();
