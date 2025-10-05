import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score
import xgboost as xgb
import joblib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
import json
import os

class CarbonCaptureOptimizer:
    def __init__(self, model_version: str = "1.0.0"):
        self.model_version = model_version
        self.models = {}
        self.scalers = {}
        self.feature_columns = [
            'temperature', 'pressure', 'flow_rate', 'humidity',
            'air_quality', 'energy_consumption', 'co2_concentration',
            'unit_age_days', 'maintenance_days_since', 'efficiency_current'
        ]
        self.target_columns = ['efficiency_predicted', 'energy_optimized', 'co2_capture_rate']

        # Hyperparameters for models
        self.hyperparams = {
            'rf': {
                'n_estimators': 100,
                'max_depth': 10,
                'min_samples_split': 2,
                'min_samples_leaf': 1,
                'random_state': 42
            },
            'xgb': {
                'n_estimators': 100,
                'max_depth': 6,
                'learning_rate': 0.1,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'random_state': 42
            },
            'nn': {
                'epochs': 100,
                'batch_size': 32,
                'validation_split': 0.2,
                'early_stopping_patience': 10
            }
        }

        # Setup logging
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)

        # Initialize scalers
        self._initialize_scalers()

    def _initialize_scalers(self):
        """Initialize data scalers for preprocessing."""
        self.scalers['standard'] = StandardScaler()
        self.scalers['minmax'] = MinMaxScaler()

    def preprocess_data(self, data: pd.DataFrame, fit: bool = False) -> pd.DataFrame:
        """
        Preprocess input data for model training/prediction.

        Args:
            data: Input dataframe
            fit: Whether to fit scalers (for training) or just transform (for prediction)

        Returns:
            Preprocessed dataframe
        """
        try:
            processed_data = data.copy()

            # Handle missing values
            processed_data = processed_data.fillna(processed_data.mean())

            # Add derived features
            processed_data = self._add_derived_features(processed_data)

            # Ensure all required columns exist
            for col in self.feature_columns:
                if col not in processed_data.columns:
                    processed_data[col] = 0

            # Select only feature columns
            feature_data = processed_data[self.feature_columns]

            if fit:
                # Fit and transform scalers
                scaled_features = self.scalers['standard'].fit_transform(feature_data)
            else:
                # Transform using fitted scalers
                scaled_features = self.scalers['standard'].transform(feature_data)

            # Convert back to dataframe
            scaled_df = pd.DataFrame(
                scaled_features,
                columns=self.feature_columns,
                index=feature_data.index
            )

            return scaled_df

        except Exception as e:
            self.logger.error(f"Error in data preprocessing: {e}")
            raise

    def _add_derived_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Add derived features to improve model performance."""
        try:
            # Energy efficiency ratio
            if 'energy_consumption' in data.columns and 'co2_concentration' in data.columns:
                data['energy_efficiency_ratio'] = data['energy_consumption'] / (data['co2_concentration'] + 1)

            # Temperature-humidity index
            if 'temperature' in data.columns and 'humidity' in data.columns:
                data['temp_humidity_index'] = data['temperature'] * (data['humidity'] / 100)

            # Flow rate efficiency
            if 'flow_rate' in data.columns and 'pressure' in data.columns:
                data['flow_pressure_ratio'] = data['flow_rate'] / (data['pressure'] + 1)

            # Maintenance urgency score
            if 'unit_age_days' in data.columns and 'maintenance_days_since' in data.columns:
                data['maintenance_urgency'] = data['unit_age_days'] / (data['maintenance_days_since'] + 1)

            return data

        except Exception as e:
            self.logger.error(f"Error adding derived features: {e}")
            return data

    def train_efficiency_model(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train multiple models for efficiency prediction.

        Args:
            data: Training dataframe with features and target

        Returns:
            Dictionary with training results and metrics
        """
        try:
            self.logger.info("Starting efficiency model training...")

            # Prepare data
            X = self.preprocess_data(data[self.feature_columns], fit=True)
            y = data['efficiency_predicted']

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            results = {}

            # Train Random Forest
            self.logger.info("Training Random Forest model...")
            rf_model = RandomForestRegressor(**self.hyperparams['rf'])
            rf_model.fit(X_train, y_train)

            rf_pred = rf_model.predict(X_test)
            rf_metrics = self._calculate_metrics(y_test, rf_pred)

            results['random_forest'] = {
                'model': rf_model,
                'metrics': rf_metrics,
                'feature_importance': dict(zip(self.feature_columns, rf_model.feature_importances_))
            }

            # Train XGBoost
            self.logger.info("Training XGBoost model...")
            xgb_model = xgb.XGBRegressor(**self.hyperparams['xgb'])
            xgb_model.fit(X_train, y_train)

            xgb_pred = xgb_model.predict(X_test)
            xgb_metrics = self._calculate_metrics(y_test, xgb_pred)

            results['xgboost'] = {
                'model': xgb_model,
                'metrics': xgb_metrics,
                'feature_importance': dict(zip(self.feature_columns, xgb_model.feature_importances_))
            }

            # Train Neural Network
            self.logger.info("Training Neural Network...")
            nn_model = self._build_neural_network(X_train.shape[1])
            nn_model.fit(
                X_train, y_train,
                epochs=self.hyperparams['nn']['epochs'],
                batch_size=self.hyperparams['nn']['batch_size'],
                validation_split=self.hyperparams['nn']['validation_split'],
                callbacks=[keras.callbacks.EarlyStopping(
                    patience=self.hyperparams['nn']['early_stopping_patience'],
                    restore_best_weights=True
                )],
                verbose=0
            )

            nn_pred = nn_model.predict(X_test).flatten()
            nn_metrics = self._calculate_metrics(y_test, nn_pred)

            results['neural_network'] = {
                'model': nn_model,
                'metrics': nn_metrics
            }

            # Select best model
            best_model_key = max(results.keys(),
                               key=lambda k: results[k]['metrics']['r2_score'])

            self.models['efficiency'] = results[best_model_key]['model']

            self.logger.info(f"Best efficiency model: {best_model_key}")
            self.logger.info(f"Training completed. Best R²: {results[best_model_key]['metrics']['r2_score']:.4f}")

            return {
                'success': True,
                'best_model': best_model_key,
                'models_trained': list(results.keys()),
                'metrics': {k: v['metrics'] for k, v in results.items()},
                'training_timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Error training efficiency model: {e}")
            return {
                'success': False,
                'error': str(e),
                'training_timestamp': datetime.now().isoformat()
            }

    def _build_neural_network(self, input_dim: int) -> keras.Model:
        """Build neural network architecture for regression."""
        model = keras.Sequential([
            keras.layers.Dense(128, activation='relu', input_dim=input_dim,
                             kernel_regularizer=keras.regularizers.l2(0.01)),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(64, activation='relu',
                             kernel_regularizer=keras.regularizers.l2(0.01)),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dense(1)  # Output layer for regression
        ])

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mean_squared_error',
            metrics=['mae', 'mse']
        )

        return model

    def _calculate_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate regression metrics."""
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_true, y_pred)
        mae = np.mean(np.abs(y_true - y_pred))

        return {
            'mse': float(mse),
            'rmse': float(rmse),
            'r2_score': float(r2),
            'mae': float(mae)
        }

    def train_predictive_maintenance(self, maintenance_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train predictive maintenance model.

        Args:
            maintenance_data: Training data for maintenance prediction

        Returns:
            Training results and metrics
        """
        try:
            self.logger.info("Starting predictive maintenance model training...")

            # Prepare features and target
            feature_cols = ['temperature', 'pressure', 'vibration', 'motor_current',
                          'bearing_temp', 'unit_age_days', 'maintenance_days_since']

            X = self.preprocess_data(maintenance_data[feature_cols], fit=True)
            y = maintenance_data['maintenance_needed']  # Binary target

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )

            # Train Gradient Boosting for maintenance prediction
            gb_model = GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            )

            gb_model.fit(X_train, y_train)

            # Cross-validation
            cv_scores = cross_val_score(gb_model, X_train, y_train, cv=5, scoring='r2')

            # Predictions
            gb_pred = gb_model.predict(X_test)

            # Calculate metrics
            metrics = self._calculate_metrics(y_test, gb_pred)

            # Feature importance
            feature_importance = dict(zip(feature_cols, gb_model.feature_importances_))

            self.models['maintenance'] = gb_model

            self.logger.info("Predictive maintenance model training completed")
            self.logger.info(f"Cross-validation R²: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")

            return {
                'success': True,
                'model_type': 'GradientBoostingRegressor',
                'metrics': metrics,
                'cross_validation_scores': {
                    'mean': float(cv_scores.mean()),
                    'std': float(cv_scores.std())
                },
                'feature_importance': feature_importance,
                'training_timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Error training predictive maintenance model: {e}")
            return {
                'success': False,
                'error': str(e),
                'training_timestamp': datetime.now().isoformat()
            }

    def predict_efficiency(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict carbon capture efficiency.

        Args:
            sensor_data: Current sensor readings

        Returns:
            Prediction results with optimization suggestions
        """
        try:
            if 'efficiency' not in self.models:
                raise ValueError("Efficiency model not trained. Please train the model first.")

            # Convert to dataframe
            input_df = pd.DataFrame([sensor_data])

            # Preprocess
            processed_data = self.preprocess_data(input_df, fit=False)

            # Predict
            prediction = self.models['efficiency'].predict(processed_data)[0]

            # Generate optimization suggestions
            suggestions = self._generate_efficiency_suggestions(sensor_data, prediction)

            result = {
                'predicted_efficiency': float(prediction),
                'current_efficiency': sensor_data.get('efficiency_current', 0),
                'optimization_suggestions': suggestions,
                'model_version': self.model_version,
                'confidence_score': self._calculate_confidence_score(sensor_data),
                'timestamp': datetime.now().isoformat()
            }

            self.logger.info(f"Efficiency prediction: {prediction:.2f}%")

            return result

        except Exception as e:
            self.logger.error(f"Error predicting efficiency: {e}")
            raise

    def predict_maintenance(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict maintenance needs.

        Args:
            sensor_data: Current sensor readings

        Returns:
            Maintenance prediction results
        """
        try:
            if 'maintenance' not in self.models:
                raise ValueError("Maintenance model not trained. Please train the model first.")

            # Convert to dataframe
            input_df = pd.DataFrame([sensor_data])

            # Preprocess
            processed_data = self.preprocess_data(input_df, fit=False)

            # Predict maintenance probability
            maintenance_score = self.models['maintenance'].predict(processed_data)[0]

            # Generate alerts
            alerts = self._generate_maintenance_alerts(sensor_data, maintenance_score)

            # Calculate next maintenance date
            next_maintenance = self._calculate_next_maintenance(sensor_data, maintenance_score)

            result = {
                'maintenance_score': float(maintenance_score),
                'alerts': alerts,
                'next_maintenance_date': next_maintenance.isoformat(),
                'risk_level': self._calculate_risk_level(maintenance_score),
                'model_version': self.model_version,
                'timestamp': datetime.now().isoformat()
            }

            self.logger.info(f"Maintenance prediction score: {maintenance_score:.3f}")

            return result

        except Exception as e:
            self.logger.error(f"Error predicting maintenance: {e}")
            raise

    def optimize_energy_usage(self, operational_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize energy usage based on operational data.

        Args:
            operational_data: Current operational parameters

        Returns:
            Energy optimization recommendations
        """
        try:
            # Simple rule-based optimization (can be enhanced with ML model)
            current_energy = operational_data.get('energy_consumption', 0)
            renewable_capacity = operational_data.get('renewable_capacity', 0)
            grid_cost = operational_data.get('grid_cost_per_kwh', 0.12)
            renewable_cost = operational_data.get('renewable_cost_per_kwh', 0.08)

            # Calculate potential savings
            max_renewable_usage = min(renewable_capacity, current_energy * 0.8)
            energy_savings = max_renewable_usage * 0.9  # 90% efficiency gain
            cost_savings = energy_savings * (grid_cost - renewable_cost)

            # Current renewable usage percentage
            current_renewable = operational_data.get('current_renewable_usage', 0)
            target_renewable = min(current_renewable + 20, 80)  # Target up to 80%

            recommendations = [
                f"Increase renewable energy usage to {target_renewable}%",
                "Optimize compressor scheduling during peak hours",
                "Implement predictive maintenance to reduce energy waste",
                "Adjust temperature setpoints for optimal efficiency"
            ]

            result = {
                'energy_savings': float(energy_savings),
                'cost_savings': float(cost_savings),
                'renewable_usage': float(target_renewable),
                'recommendations': recommendations,
                'current_energy_consumption': current_energy,
                'optimization_potential': float((energy_savings / current_energy) * 100),
                'timestamp': datetime.now().isoformat()
            }

            self.logger.info(f"Energy optimization: {energy_savings:.1f} kWh savings")

            return result

        except Exception as e:
            self.logger.error(f"Error optimizing energy usage: {e}")
            raise

    def _generate_efficiency_suggestions(self, sensor_data: Dict[str, Any],
                                       prediction: float) -> List[Dict[str, Any]]:
        """Generate optimization suggestions based on sensor data and prediction."""
        suggestions = []

        # Temperature optimization
        temperature = sensor_data.get('temperature', 25)
        if temperature > 30:
            suggestions.append({
                'type': 'efficiency',
                'title': 'Temperature Optimization',
                'description': f'Reduce operating temperature from {temperature}°C to 25°C',
                'impact': {
                    'co2Increase': 5.2,
                    'energySavings': 25.5
                },
                'priority': 'high' if temperature > 35 else 'medium'
            })

        # Pressure optimization
        pressure = sensor_data.get('pressure', 50)
        if pressure > 60:
            suggestions.append({
                'type': 'efficiency',
                'title': 'Pressure Optimization',
                'description': f'Optimize pressure settings from {pressure} psi to 45-50 psi',
                'impact': {
                    'co2Increase': 3.1,
                    'energySavings': 18.7
                },
                'priority': 'medium'
            })

        # Flow rate optimization
        flow_rate = sensor_data.get('flow_rate', 1000)
        if flow_rate > 1500:
            suggestions.append({
                'type': 'efficiency',
                'title': 'Flow Rate Optimization',
                'description': f'Reduce flow rate from {flow_rate} L/min to optimal range',
                'impact': {
                    'co2Increase': 2.8,
                    'energySavings': 15.3
                },
                'priority': 'low'
            })

        return suggestions

    def _generate_maintenance_alerts(self, sensor_data: Dict[str, Any],
                                   maintenance_score: float) -> List[Dict[str, Any]]:
        """Generate maintenance alerts based on prediction score."""
        alerts = []

        if maintenance_score > 0.8:
            alerts.append({
                'alertType': 'critical',
                'message': 'Immediate maintenance required - high failure risk detected',
                'probability': float(maintenance_score),
                'severity': 'critical'
            })
        elif maintenance_score > 0.6:
            alerts.append({
                'alertType': 'warning',
                'message': 'Maintenance recommended within next 7 days',
                'probability': float(maintenance_score),
                'severity': 'high'
            })
        elif maintenance_score > 0.4:
            alerts.append({
                'alertType': 'info',
                'message': 'Schedule maintenance check within next 30 days',
                'probability': float(maintenance_score),
                'severity': 'medium'
            })

        # Sensor-specific alerts
        vibration = sensor_data.get('vibration', 0)
        if vibration > 3.0:
            alerts.append({
                'alertType': 'warning',
                'message': 'Elevated vibration levels detected - motor inspection recommended',
                'probability': 0.7,
                'severity': 'medium'
            })

        motor_current = sensor_data.get('motor_current', 0)
        if motor_current > 20:
            alerts.append({
                'alertType': 'warning',
                'message': 'High motor current detected - electrical system check recommended',
                'probability': 0.6,
                'severity': 'medium'
            })

        return alerts

    def _calculate_next_maintenance(self, sensor_data: Dict[str, Any],
                                  maintenance_score: float) -> datetime:
        """Calculate recommended next maintenance date."""
        base_days = 90  # Default maintenance interval

        # Adjust based on maintenance score
        if maintenance_score > 0.8:
            days_to_maintenance = 7
        elif maintenance_score > 0.6:
            days_to_maintenance = 14
        elif maintenance_score > 0.4:
            days_to_maintenance = 30
        else:
            days_to_maintenance = base_days

        # Adjust based on unit age
        unit_age = sensor_data.get('unit_age_days', 0)
        if unit_age > 1000:  # Units older than ~3 years
            days_to_maintenance = max(days_to_maintenance * 0.7, 7)

        # Adjust based on recent maintenance
        days_since_maintenance = sensor_data.get('maintenance_days_since', 0)
        if days_since_maintenance < 30:
            days_to_maintenance = max(days_to_maintenance, 60)  # At least 60 days after recent maintenance

        return datetime.now() + timedelta(days=days_to_maintenance)

    def _calculate_risk_level(self, maintenance_score: float) -> str:
        """Calculate risk level based on maintenance score."""
        if maintenance_score > 0.8:
            return 'critical'
        elif maintenance_score > 0.6:
            return 'high'
        elif maintenance_score > 0.4:
            return 'medium'
        else:
            return 'low'

    def _calculate_confidence_score(self, sensor_data: Dict[str, Any]) -> float:
        """Calculate confidence score for predictions."""
        # Simple confidence calculation based on data completeness
        required_fields = ['temperature', 'pressure', 'flow_rate', 'energy_consumption']
        available_fields = sum(1 for field in required_fields if field in sensor_data and sensor_data[field] is not None)

        base_confidence = available_fields / len(required_fields)

        # Adjust for data quality indicators
        if 'data_quality' in sensor_data:
            quality = sensor_data['data_quality']
            base_confidence *= (quality / 100)

        return min(base_confidence, 1.0)

    def save_models(self, directory: str = 'models') -> None:
        """
        Save trained models and scalers to disk.

        Args:
            directory: Directory to save models
        """
        try:
            os.makedirs(directory, exist_ok=True)

            # Save models
            for model_name, model in self.models.items():
                if hasattr(model, 'save'):  # TensorFlow/Keras model
                    model.save(os.path.join(directory, f'{model_name}_model.h5'))
                else:  # Scikit-learn model
                    joblib.dump(model, os.path.join(directory, f'{model_name}_model.pkl'))

            # Save scalers
            for scaler_name, scaler in self.scalers.items():
                joblib.dump(scaler, os.path.join(directory, f'{scaler_name}_scaler.pkl'))

            # Save metadata
            metadata = {
                'model_version': self.model_version,
                'feature_columns': self.feature_columns,
                'target_columns': self.target_columns,
                'hyperparameters': self.hyperparams,
                'saved_at': datetime.now().isoformat()
            }

            with open(os.path.join(directory, 'model_metadata.json'), 'w') as f:
                json.dump(metadata, f, indent=2)

            self.logger.info(f"Models saved to {directory}")

        except Exception as e:
            self.logger.error(f"Error saving models: {e}")
            raise

    def load_models(self, directory: str = 'models') -> None:
        """
        Load trained models and scalers from disk.

        Args:
            directory: Directory containing saved models
        """
        try:
            # Load metadata
            metadata_path = os.path.join(directory, 'model_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.model_version = metadata.get('model_version', self.model_version)
                    self.feature_columns = metadata.get('feature_columns', self.feature_columns)
                    self.hyperparams = metadata.get('hyperparameters', self.hyperparams)

            # Load models
            for model_name in ['efficiency', 'maintenance']:
                # Try TensorFlow/Keras first
                keras_path = os.path.join(directory, f'{model_name}_model.h5')
                sklearn_path = os.path.join(directory, f'{model_name}_model.pkl')

                if os.path.exists(keras_path):
                    self.models[model_name] = keras.models.load_model(keras_path)
                elif os.path.exists(sklearn_path):
                    self.models[model_name] = joblib.load(sklearn_path)

            # Load scalers
            for scaler_name in ['standard', 'minmax']:
                scaler_path = os.path.join(directory, f'{scaler_name}_scaler.pkl')
                if os.path.exists(scaler_path):
                    self.scalers[scaler_name] = joblib.load(scaler_path)

            self.logger.info(f"Models loaded from {directory}")

        except Exception as e:
            self.logger.error(f"Error loading models: {e}")
            raise

    def get_model_health(self) -> Dict[str, Any]:
        """
        Get health status of all models.

        Returns:
            Dictionary with model health information
        """
        try:
            health_status = {
                'overall_status': 'healthy',
                'models': {},
                'model_version': self.model_version,
                'last_check': datetime.now().isoformat()
            }

            # Check each model
            for model_name in ['efficiency', 'maintenance']:
                if model_name in self.models:
                    health_status['models'][model_name] = {
                        'status': 'healthy',
                        'type': type(self.models[model_name]).__name__,
                        'loaded': True
                    }
                else:
                    health_status['models'][model_name] = {
                        'status': 'not_loaded',
                        'type': None,
                        'loaded': False
                    }
                    health_status['overall_status'] = 'degraded'

            # Check scalers
            scaler_status = all(scaler is not None for scaler in self.scalers.values())
            if not scaler_status:
                health_status['overall_status'] = 'degraded'

            health_status['scalers_loaded'] = scaler_status

            return health_status

        except Exception as e:
            self.logger.error(f"Error checking model health: {e}")
            return {
                'overall_status': 'error',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }