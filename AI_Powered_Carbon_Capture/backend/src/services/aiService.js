import axios from 'axios';
import winston from 'winston';
import { ApiError } from '../middleware/errorHandler.js';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/ai-service.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

class AIService {
  constructor() {
    this.baseURL = process.env.AI_ENGINE_URL || 'http://localhost:5000';
    this.apiKey = process.env.AI_ENGINE_API_KEY;
    this.timeout = parseInt(process.env.AI_REQUEST_TIMEOUT) || 30000;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('AI Engine API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  /**
   * Optimize carbon capture efficiency for a unit
   * @param {string} unitId - Carbon capture unit ID
   * @param {Object} sensorData - Current sensor readings
   * @param {Object} operationalData - Operational parameters
   * @returns {Promise<Object>} Optimization results
   */
  async optimizeEfficiency(unitId, sensorData, operationalData = null) {
    try {
      const payload = {
        unit_id: unitId,
        sensor_data: sensorData,
        ...(operationalData && { operational_data: operationalData })
      };

      logger.info(`Requesting efficiency optimization for unit ${unitId}`);

      const response = await this.client.post('/optimize/efficiency', payload);

      logger.info(`Efficiency optimization completed for unit ${unitId}`, {
        predictedEfficiency: response.data.predicted_efficiency
      });

      return {
        unitId,
        predictedEfficiency: response.data.predicted_efficiency,
        currentEfficiency: response.data.current_efficiency,
        optimizationSuggestions: response.data.optimization_suggestions,
        confidence: response.data.confidence_score,
        modelVersion: response.data.model_version,
        timestamp: response.data.timestamp,
        processingTime: response.data.processing_time_ms
      };

    } catch (error) {
      logger.error(`Efficiency optimization failed for unit ${unitId}:`, error.message);
      throw new ApiError(
        'AI efficiency optimization failed',
        500,
        'AI_OPTIMIZATION_FAILED',
        { unitId, error: error.message }
      );
    }
  }

  /**
   * Predict maintenance needs for a unit
   * @param {string} unitId - Carbon capture unit ID
   * @param {Object} sensorData - Current sensor readings
   * @returns {Promise<Object>} Maintenance prediction results
   */
  async predictMaintenance(unitId, sensorData) {
    try {
      const payload = {
        unit_id: unitId,
        sensor_data: sensorData
      };

      logger.info(`Requesting maintenance prediction for unit ${unitId}`);

      const response = await this.client.post('/predict/maintenance', payload);

      logger.info(`Maintenance prediction completed for unit ${unitId}`, {
        maintenanceScore: response.data.maintenance_score,
        riskLevel: response.data.risk_level
      });

      return {
        unitId,
        maintenanceScore: response.data.maintenance_score,
        alerts: response.data.alerts,
        nextMaintenanceDate: response.data.next_maintenance_date,
        riskLevel: response.data.risk_level,
        modelVersion: response.data.model_version,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.error(`Maintenance prediction failed for unit ${unitId}:`, error.message);
      throw new ApiError(
        'AI maintenance prediction failed',
        500,
        'AI_MAINTENANCE_FAILED',
        { unitId, error: error.message }
      );
    }
  }

  /**
   * Optimize energy usage for a unit
   * @param {string} unitId - Carbon capture unit ID
   * @param {Object} operationalData - Current operational parameters
   * @returns {Promise<Object>} Energy optimization results
   */
  async optimizeEnergy(unitId, operationalData) {
    try {
      const payload = {
        unit_id: unitId,
        operational_data: operationalData
      };

      logger.info(`Requesting energy optimization for unit ${unitId}`);

      const response = await this.client.post('/optimize/energy', payload);

      logger.info(`Energy optimization completed for unit ${unitId}`, {
        energySavings: response.data.energy_savings,
        costSavings: response.data.cost_savings
      });

      return {
        unitId,
        energySavings: response.data.energy_savings,
        costSavings: response.data.cost_savings,
        renewableUsage: response.data.renewable_usage,
        recommendations: response.data.recommendations,
        optimizationPotential: response.data.optimization_potential,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.error(`Energy optimization failed for unit ${unitId}:`, error.message);
      throw new ApiError(
        'AI energy optimization failed',
        500,
        'AI_ENERGY_FAILED',
        { unitId, error: error.message }
      );
    }
  }

  /**
   * Get AI model health status
   * @returns {Promise<Object>} Model health information
   */
  async getModelHealth() {
    try {
      logger.info('Requesting AI model health status');

      const response = await this.client.get('/model-health');

      logger.info('AI model health check completed', {
        overallStatus: response.data.overall_status,
        modelsLoaded: Object.keys(response.data.models).length
      });

      return {
        overallStatus: response.data.overall_status,
        models: response.data.models,
        modelVersion: response.data.version,
        scalersLoaded: response.data.scalers_loaded,
        lastCheck: response.data.last_check
      };

    } catch (error) {
      logger.error('AI model health check failed:', error.message);
      throw new ApiError(
        'AI model health check failed',
        500,
        'AI_HEALTH_CHECK_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Train AI models with new data
   * @param {string} modelType - Type of model to train ('efficiency' or 'maintenance')
   * @param {Array} trainingData - Training data
   * @returns {Promise<Object>} Training results
   */
  async trainModel(modelType, trainingData) {
    try {
      const endpoint = modelType === 'maintenance' ? '/train/maintenance' : '/train/efficiency';

      const payload = {
        features: trainingData.features || trainingData,
        targets: trainingData.targets
      };

      logger.info(`Starting ${modelType} model training`);

      const response = await this.client.post(endpoint, payload);

      logger.info(`${modelType} model training initiated`, {
        status: response.data.status,
        estimatedDuration: response.data.estimated_duration
      });

      return {
        status: response.data.status,
        message: response.data.message,
        estimatedDuration: response.data.estimated_duration,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.error(`${modelType} model training failed:`, error.message);
      throw new ApiError(
        'AI model training failed',
        500,
        'AI_TRAINING_FAILED',
        { modelType, error: error.message }
      );
    }
  }

  /**
   * Save current AI models
   * @returns {Promise<Object>} Save operation results
   */
  async saveModels() {
    try {
      logger.info('Saving AI models');

      const response = await this.client.post('/models/save');

      logger.info('AI models saved successfully');

      return {
        message: response.data.message,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.error('AI model saving failed:', error.message);
      throw new ApiError(
        'AI model saving failed',
        500,
        'AI_SAVE_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Load AI models from disk
   * @returns {Promise<Object>} Load operation results
   */
  async loadModels() {
    try {
      logger.info('Loading AI models');

      const response = await this.client.post('/models/load');

      logger.info('AI models loaded successfully');

      return {
        message: response.data.message,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      logger.error('AI model loading failed:', error.message);
      throw new ApiError(
        'AI model loading failed',
        500,
        'AI_LOAD_FAILED',
        { error: error.message }
      );
    }
  }

  /**
   * Check if AI service is available
   * @returns {Promise<boolean>} Service availability
   */
  async isServiceAvailable() {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      logger.warn('AI service health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get AI service information
   * @returns {Promise<Object>} Service information
   */
  async getServiceInfo() {
    try {
      const [healthResponse, modelHealthResponse] = await Promise.all([
        this.client.get('/health'),
        this.client.get('/model-health')
      ]);

      return {
        service: 'AI Engine',
        version: healthResponse.data.service.split('-').pop(),
        status: healthResponse.data.status,
        modelHealth: modelHealthResponse.data,
        timestamp: healthResponse.data.timestamp,
        uptime: healthResponse.data.uptime
      };

    } catch (error) {
      logger.error('Failed to get AI service info:', error.message);
      return {
        service: 'AI Engine',
        status: 'unavailable',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export default new AIService();
