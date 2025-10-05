"""
Configuration settings for the Carbon Capture AI Engine.
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Configuration class for AI Engine."""

    # Server Configuration
    HOST: str = os.getenv('AI_ENGINE_HOST', '0.0.0.0')
    PORT: int = int(os.getenv('AI_ENGINE_PORT', '5000'))
    WORKERS: int = int(os.getenv('AI_ENGINE_WORKERS', '4'))

    # Model Configuration
    MODEL_VERSION: str = os.getenv('MODEL_VERSION', '1.0.0')
    MODEL_CACHE_SIZE: int = int(os.getenv('MODEL_CACHE_SIZE', '100'))
    MODEL_CACHE_TTL: int = int(os.getenv('MODEL_CACHE_TTL', '300'))  # 5 minutes

    # Prediction Configuration
    PREDICTION_TIMEOUT: int = int(os.getenv('PREDICTION_TIMEOUT', '30'))
    MAX_CONCURRENT_PREDICTIONS: int = int(os.getenv('MAX_CONCURRENT_PREDICTIONS', '10'))
    PREDICTION_CACHE_ENABLED: bool = os.getenv('PREDICTION_CACHE_ENABLED', 'true').lower() == 'true'

    # Training Configuration
    TRAINING_DATA_PATH: str = os.getenv('TRAINING_DATA_PATH', 'data/training/')
    MODEL_SAVE_PATH: str = os.getenv('MODEL_SAVE_PATH', 'models/')
    TRAINING_LOGS_PATH: str = os.getenv('TRAINING_LOGS_PATH', 'logs/training/')

    # External Services
    BACKEND_URL: str = os.getenv('BACKEND_URL', 'http://localhost:8000')
    DATABASE_URL: str = os.getenv('DATABASE_URL', 'mongodb://localhost:27017/carbon-capture-ai')

    # Logging Configuration
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT: str = os.getenv('LOG_FORMAT', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # CORS Configuration
    CORS_ORIGINS: list = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:8000').split(',')
    CORS_CREDENTIALS: bool = os.getenv('CORS_CREDENTIALS', 'true').lower() == 'true'

    # Security
    API_KEY: str = os.getenv('AI_ENGINE_API_KEY', 'default-api-key-change-in-production')
    SECRET_KEY: str = os.getenv('SECRET_KEY', 'default-secret-key-change-in-production')

    # Model Hyperparameters
    EFFICIENCY_MODEL_PARAMS: Dict[str, Any] = {
        'random_forest': {
            'n_estimators': int(os.getenv('RF_N_ESTIMATORS', '100')),
            'max_depth': int(os.getenv('RF_MAX_DEPTH', '10')),
            'min_samples_split': int(os.getenv('RF_MIN_SAMPLES_SPLIT', '2')),
            'min_samples_leaf': int(os.getenv('RF_MIN_SAMPLES_LEAF', '1')),
            'random_state': 42
        },
        'xgboost': {
            'n_estimators': int(os.getenv('XGB_N_ESTIMATORS', '100')),
            'max_depth': int(os.getenv('XGB_MAX_DEPTH', '6')),
            'learning_rate': float(os.getenv('XGB_LEARNING_RATE', '0.1')),
            'subsample': float(os.getenv('XGB_SUBSAMPLE', '0.8')),
            'colsample_bytree': float(os.getenv('XGB_COLSAMPLE_BYTREE', '0.8')),
            'random_state': 42
        },
        'neural_network': {
            'epochs': int(os.getenv('NN_EPOCHS', '100')),
            'batch_size': int(os.getenv('NN_BATCH_SIZE', '32')),
            'validation_split': float(os.getenv('NN_VALIDATION_SPLIT', '0.2')),
            'early_stopping_patience': int(os.getenv('NN_EARLY_STOPPING', '10'))
        }
    }

    MAINTENANCE_MODEL_PARAMS: Dict[str, Any] = {
        'gradient_boosting': {
            'n_estimators': int(os.getenv('GB_N_ESTIMATORS', '100')),
            'learning_rate': float(os.getenv('GB_LEARNING_RATE', '0.1')),
            'max_depth': int(os.getenv('GB_MAX_DEPTH', '6')),
            'min_samples_split': int(os.getenv('GB_MIN_SAMPLES_SPLIT', '2')),
            'min_samples_leaf': int(os.getenv('GB_MIN_SAMPLES_LEAF', '1')),
            'random_state': 42
        },
        'feature_importance_threshold': float(os.getenv('FEATURE_IMPORTANCE_THRESHOLD', '0.01'))
    }

    # Feature Engineering
    FEATURE_COLUMNS: list = [
        'temperature', 'pressure', 'flow_rate', 'humidity',
        'air_quality', 'energy_consumption', 'co2_concentration',
        'unit_age_days', 'maintenance_days_since', 'efficiency_current'
    ]

    DERIVED_FEATURES: Dict[str, str] = {
        'energy_efficiency_ratio': 'energy_consumption / (co2_concentration + 1)',
        'temp_humidity_index': 'temperature * (humidity / 100)',
        'flow_pressure_ratio': 'flow_rate / (pressure + 1)',
        'maintenance_urgency': 'unit_age_days / (maintenance_days_since + 1)'
    }

    # Optimization Templates
    OPTIMIZATION_TEMPLATES: Dict[str, Dict[str, Any]] = {
        'efficiency_focused': {
            'priority_weights': {
                'efficiency': 0.5,
                'energy_savings': 0.3,
                'maintenance_risk': 0.2
            },
            'constraints': {
                'max_energy_increase': 0.05,
                'min_efficiency_gain': 0.02
            }
        },
        'energy_efficient': {
            'priority_weights': {
                'efficiency': 0.2,
                'energy_savings': 0.6,
                'maintenance_risk': 0.2
            },
            'constraints': {
                'max_efficiency_decrease': 0.01,
                'min_energy_savings': 50
            }
        },
        'maintenance_prioritized': {
            'priority_weights': {
                'efficiency': 0.2,
                'energy_savings': 0.2,
                'maintenance_risk': 0.6
            },
            'constraints': {
                'max_maintenance_risk': 0.3,
                'maintenance_window_days': 30
            }
        },
        'balanced': {
            'priority_weights': {
                'efficiency': 0.33,
                'energy_savings': 0.33,
                'maintenance_risk': 0.34
            },
            'constraints': {
                'balanced_tradeoff': True
            }
        }
    }

    # Performance Monitoring
    ENABLE_PERFORMANCE_MONITORING: bool = os.getenv('ENABLE_PERFORMANCE_MONITORING', 'true').lower() == 'true'
    METRICS_COLLECTION_INTERVAL: int = int(os.getenv('METRICS_COLLECTION_INTERVAL', '60'))  # seconds

    # Error Handling
    MAX_RETRIES: int = int(os.getenv('MAX_RETRIES', '3'))
    RETRY_DELAY: float = float(os.getenv('RETRY_DELAY', '1.0'))

    # Development Settings
    DEBUG_MODE: bool = os.getenv('DEBUG_MODE', 'false').lower() == 'true'
    AUTO_RELOAD: bool = os.getenv('AUTO_RELOAD', 'true').lower() == 'true'

# Global config instance
config = Config()
