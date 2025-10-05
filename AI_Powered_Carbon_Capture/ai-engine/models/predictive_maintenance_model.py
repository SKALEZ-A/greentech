import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import xgboost as xgb
import joblib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
import json
import os

class PredictiveMaintenanceModel:
    """
    AI model for predicting maintenance needs in carbon capture units.
    Uses sensor data to predict equipment failures and optimize maintenance schedules.
    """

    def __init__(self, model_version: str = "1.0.0"):
        self.model_version = model_version
        self.models = {}
        self.scalers = {}
        self.encoders = {}

        # Sensor features for maintenance prediction
        self.sensor_features = [
            'temperature', 'pressure', 'flow_rate', 'humidity',
            'vibration', 'motor_current', 'bearing_temperature',
            'air_quality', 'power_consumption', 'noise_level'
        ]

        # Operational features
        self.operational_features = [
            'unit_age_days', 'maintenance_days_since', 'operating_hours',
            'cycles_completed', 'efficiency_current'
        ]

        self.all_features = self.sensor_features + self.operational_features

        # Maintenance failure types
        self.failure_types = [
            'no_failure', 'motor_failure', 'pump_failure', 'valve_failure',
            'sensor_failure', 'filter_clogging', 'compressor_failure'
        ]

        # Hyperparameters
        self.hyperparams = {
            'rf': {
                'n_estimators': 100,
                'max_depth': 15,
                'min_samples_split': 2,
                'min_samples_leaf': 1,
                'class_weight': 'balanced',
                'random_state': 42
            },
            'xgb': {
                'n_estimators': 100,
                'max_depth': 6,
                'learning_rate': 0.1,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'scale_pos_weight': 10,
                'random_state': 42
            },
            'nn': {
                'epochs': 150,
                'batch_size': 32,
                'validation_split': 0.2,
                'early_stopping_patience': 15,
                'dropout_rate': 0.3
            }
        }

        # Setup logging
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)

        # Initialize preprocessors
        self._initialize_preprocessors()

    def _initialize_preprocessors(self):
        """Initialize data preprocessing components."""
        self.scalers['standard'] = StandardScaler()
        self.encoders['failure_type'] = LabelEncoder()
        self.encoders['failure_type'].fit(self.failure_types)

    def preprocess_maintenance_data(self, data: pd.DataFrame, fit: bool = False) -> Tuple[pd.DataFrame, np.ndarray]:
        """
        Preprocess maintenance training data.

        Args:
            data: Raw maintenance data
            fit: Whether to fit preprocessors

        Returns:
            Tuple of (processed_features, encoded_labels)
        """
        try:
            processed_data = data.copy()

            # Handle missing values
            processed_data = processed_data.fillna(processed_data.mean())

            # Add derived features
            processed_data = self._add_maintenance_features(processed_data)

            # Ensure all required columns exist
            for col in self.all_features:
                if col not in processed_data.columns:
                    processed_data[col] = 0

            # Select feature columns
            feature_data = processed_data[self.all_features]

            # Scale features
            if fit:
                scaled_features = self.scalers['standard'].fit_transform(feature_data)
            else:
                scaled_features = self.scalers['standard'].transform(feature_data)

            # Convert back to dataframe
            scaled_df = pd.DataFrame(
                scaled_features,
                columns=self.all_features,
                index=feature_data.index
            )

            # Encode target labels if present
            if 'failure_type' in data.columns:
                encoded_labels = self.encoders['failure_type'].transform(data['failure_type'])
                return scaled_df, encoded_labels
            else:
                # For prediction, return dummy labels
                return scaled_df, np.array([])

        except Exception as e:
            self.logger.error(f"Error in maintenance data preprocessing: {e}")
            raise

    def _add_maintenance_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Add derived features for maintenance prediction."""
        try:
            # Vibration to temperature ratio (indicates bearing wear)
            if 'vibration' in data.columns and 'temperature' in data.columns:
                data['vibration_temp_ratio'] = data['vibration'] / (data['temperature'] + 1)

            # Current efficiency degradation
            if 'efficiency_current' in data.columns and 'unit_age_days' in data.columns:
                data['efficiency_degradation'] = data['efficiency_current'] / (data['unit_age_days'] + 1)

            # Maintenance urgency score
            if 'unit_age_days' in data.columns and 'maintenance_days_since' in data.columns:
                data['maintenance_urgency'] = data['unit_age_days'] / (data['maintenance_days_since'] + 30)

            # Operating stress index
            if 'temperature' in data.columns and 'pressure' in data.columns:
                data['operating_stress'] = data['temperature'] * data['pressure'] / 1000

            # Power efficiency ratio
            if 'power_consumption' in data.columns and 'flow_rate' in data.columns:
                data['power_efficiency_ratio'] = data['power_consumption'] / (data['flow_rate'] + 1)

            return data

        except Exception as e:
            self.logger.error(f"Error adding maintenance features: {e}")
            return data

    def train_maintenance_model(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train multiple models for maintenance failure prediction.

        Args:
            data: Training dataframe with sensor data and failure labels

        Returns:
            Dictionary with training results and metrics
        """
        try:
            self.logger.info("Starting predictive maintenance model training...")

            # Prepare data
            X, y = self.preprocess_maintenance_data(data, fit=True)

            # Split data with stratification
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )

            results = {}

            # Train Random Forest Classifier
            self.logger.info("Training Random Forest maintenance model...")
            rf_model = RandomForestClassifier(**self.hyperparams['rf'])
            rf_model.fit(X_train, y_train)

            rf_pred = rf_model.predict(X_test)
            rf_proba = rf_model.predict_proba(X_test)
            rf_metrics = self._calculate_classification_metrics(y_test, rf_pred, rf_proba)

            results['random_forest'] = {
                'model': rf_model,
                'metrics': rf_metrics,
                'feature_importance': dict(zip(self.all_features, rf_model.feature_importances_))
            }

            # Train XGBoost Classifier
            self.logger.info("Training XGBoost maintenance model...")
            xgb_model = xgb.XGBClassifier(**self.hyperparams['xgb'])
            xgb_model.fit(X_train, y_train)

            xgb_pred = xgb_model.predict(X_test)
            xgb_proba = xgb_model.predict_proba(X_test)
            xgb_metrics = self._calculate_classification_metrics(y_test, xgb_pred, xgb_proba)

            results['xgboost'] = {
                'model': xgb_model,
                'metrics': xgb_metrics,
                'feature_importance': dict(zip(self.all_features, xgb_model.feature_importances_))
            }

            # Train Neural Network
            self.logger.info("Training Neural Network maintenance model...")
            nn_model = self._build_maintenance_neural_network(X_train.shape[1], len(self.failure_types))
            nn_model.fit(
                X_train, y_train,
                epochs=self.hyperparams['nn']['epochs'],
                batch_size=self.hyperparams['nn']['batch_size'],
                validation_split=self.hyperparams['nn']['validation_split'],
                callbacks=[
                    keras.callbacks.EarlyStopping(
                        patience=self.hyperparams['nn']['early_stopping_patience'],
                        restore_best_weights=True
                    ),
                    keras.callbacks.ReduceLROnPlateau(
                        patience=5,
                        factor=0.5,
                        min_lr=1e-6
                    )
                ],
                verbose=0
            )

            nn_pred = np.argmax(nn_model.predict(X_test), axis=1)
            nn_proba = nn_model.predict(X_test)
            nn_metrics = self._calculate_classification_metrics(y_test, nn_pred, nn_proba)

            results['neural_network'] = {
                'model': nn_model,
                'metrics': nn_metrics
            }

            # Select best model based on macro F1-score
            best_model_key = max(results.keys(),
                               key=lambda k: results[k]['metrics']['macro_f1'])

            self.models['maintenance'] = results[best_model_key]['model']

            self.logger.info(f"Best maintenance model: {best_model_key}")
            self.logger.info(f"Training completed. Best macro F1: {results[best_model_key]['metrics']['macro_f1']:.4f}")

            return {
                'success': True,
                'best_model': best_model_key,
                'models_trained': list(results.keys()),
                'metrics': {k: v['metrics'] for k, v in results.items()},
                'training_timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Error training maintenance model: {e}")
            return {
                'success': False,
                'error': str(e),
                'training_timestamp': datetime.now().isoformat()
            }

    def _build_maintenance_neural_network(self, input_dim: int, num_classes: int) -> keras.Model:
        """Build neural network architecture for maintenance prediction."""
        model = keras.Sequential([
            keras.layers.Dense(256, activation='relu', input_dim=input_dim,
                             kernel_regularizer=keras.regularizers.l2(0.01)),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(self.hyperparams['nn']['dropout_rate']),

            keras.layers.Dense(128, activation='relu',
                             kernel_regularizer=keras.regularizers.l2(0.01)),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(self.hyperparams['nn']['dropout_rate']),

            keras.layers.Dense(64, activation='relu',
                             kernel_regularizer=keras.regularizers.l2(0.005)),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(self.hyperparams['nn']['dropout_rate'] / 2),

            keras.layers.Dense(num_classes, activation='softmax')
        ])

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy', keras.metrics.Precision(), keras.metrics.Recall()]
        )

        return model

    def _calculate_classification_metrics(self, y_true: np.ndarray, y_pred: np.ndarray,
                                        y_proba: np.ndarray) -> Dict[str, float]:
        """Calculate comprehensive classification metrics."""
        try:
            # Basic classification report
            report = classification_report(y_true, y_pred, output_dict=True,
                                        target_names=self.failure_types, zero_division=0)

            # Confusion matrix
            cm = confusion_matrix(y_true, y_pred)

            # ROC AUC (one-vs-rest for multiclass)
            try:
                if y_proba.shape[1] > 2:  # Multiclass
                    auc = roc_auc_score(y_true, y_proba, multi_class='ovr', average='macro')
                else:  # Binary
                    auc = roc_auc_score(y_true, y_proba[:, 1])
            except:
                auc = 0.0

            # Extract key metrics
            accuracy = report['accuracy']
            macro_precision = report['macro avg']['precision']
            macro_recall = report['macro avg']['recall']
            macro_f1 = report['macro avg']['f1-score']
            weighted_f1 = report['weighted avg']['f1-score']

            return {
                'accuracy': float(accuracy),
                'macro_precision': float(macro_precision),
                'macro_recall': float(macro_recall),
                'macro_f1': float(macro_f1),
                'weighted_f1': float(weighted_f1),
                'roc_auc': float(auc),
                'confusion_matrix': cm.tolist(),
                'classification_report': report
            }

        except Exception as e:
            self.logger.error(f"Error calculating classification metrics: {e}")
            return {
                'accuracy': 0.0,
                'macro_precision': 0.0,
                'macro_recall': 0.0,
                'macro_f1': 0.0,
                'weighted_f1': 0.0,
                'roc_auc': 0.0,
                'error': str(e)
            }

    def predict_maintenance(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict maintenance needs for a carbon capture unit.

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
            processed_data, _ = self.preprocess_maintenance_data(input_df, fit=False)

            # Predict
            if hasattr(self.models['maintenance'], 'predict_proba'):
                # Tree-based models
                probabilities = self.models['maintenance'].predict_proba(processed_data)[0]
                prediction_idx = np.argmax(probabilities)
            else:
                # Neural network
                probabilities = self.models['maintenance'].predict(processed_data)[0]
                prediction_idx = np.argmax(probabilities)

            predicted_failure = self.failure_types[prediction_idx]
            confidence = float(probabilities[prediction_idx])

            # Generate maintenance recommendations
            recommendations = self._generate_maintenance_recommendations(
                sensor_data, predicted_failure, confidence
            )

            # Calculate risk score
            risk_score = self._calculate_risk_score(sensor_data, predicted_failure, confidence)

            # Estimate time to failure
            time_to_failure = self._estimate_time_to_failure(sensor_data, risk_score)

            result = {
                'predicted_failure': predicted_failure,
                'confidence': confidence,
                'probabilities': dict(zip(self.failure_types, probabilities.astype(float))),
                'risk_score': risk_score,
                'risk_level': self._get_risk_level(risk_score),
                'time_to_failure_days': time_to_failure,
                'recommendations': recommendations,
                'model_version': self.model_version,
                'timestamp': datetime.now().isoformat()
            }

            self.logger.info(f"Maintenance prediction: {predicted_failure} (confidence: {confidence:.3f})")

            return result

        except Exception as e:
            self.logger.error(f"Error predicting maintenance: {e}")
            raise

    def _generate_maintenance_recommendations(self, sensor_data: Dict[str, Any],
                                            predicted_failure: str, confidence: float) -> List[Dict[str, Any]]:
        """Generate maintenance recommendations based on predictions."""
        recommendations = []

        # Base recommendations based on predicted failure
        if predicted_failure == 'motor_failure':
            recommendations.append({
                'type': 'preventive',
                'component': 'motor',
                'action': 'Inspect motor bearings and windings',
                'priority': 'high' if confidence > 0.8 else 'medium',
                'timeframe_days': 7 if confidence > 0.8 else 30
            })

        elif predicted_failure == 'pump_failure':
            recommendations.append({
                'type': 'preventive',
                'component': 'pump',
                'action': 'Check pump seals and impeller condition',
                'priority': 'high' if confidence > 0.8 else 'medium',
                'timeframe_days': 14 if confidence > 0.8 else 45
            })

        elif predicted_failure == 'valve_failure':
            recommendations.append({
                'type': 'preventive',
                'component': 'valves',
                'action': 'Inspect valve actuators and seals',
                'priority': 'medium',
                'timeframe_days': 21
            })

        elif predicted_failure == 'compressor_failure':
            recommendations.append({
                'type': 'preventive',
                'component': 'compressor',
                'action': 'Schedule compressor maintenance and oil change',
                'priority': 'high',
                'timeframe_days': 7
            })

        # Sensor-based recommendations
        vibration = sensor_data.get('vibration', 0)
        if vibration > 2.5:
            recommendations.append({
                'type': 'immediate',
                'component': 'vibration',
                'action': 'High vibration detected - immediate inspection required',
                'priority': 'critical',
                'timeframe_days': 1
            })

        motor_current = sensor_data.get('motor_current', 0)
        if motor_current > 18:
            recommendations.append({
                'type': 'urgent',
                'component': 'electrical',
                'action': 'High current draw - check motor and electrical system',
                'priority': 'high',
                'timeframe_days': 3
            })

        temperature = sensor_data.get('temperature', 25)
        if temperature > 35:
            recommendations.append({
                'type': 'cooling',
                'component': 'thermal',
                'action': 'High temperature - check cooling system',
                'priority': 'high',
                'timeframe_days': 1
            })

        return recommendations

    def _calculate_risk_score(self, sensor_data: Dict[str, Any],
                            predicted_failure: str, confidence: float) -> float:
        """Calculate overall risk score for the unit."""
        base_risk = confidence

        # Adjust based on sensor readings
        risk_multipliers = {
            'vibration': lambda x: 1.5 if x > 3.0 else 1.2 if x > 2.0 else 1.0,
            'motor_current': lambda x: 1.4 if x > 20 else 1.2 if x > 15 else 1.0,
            'temperature': lambda x: 1.6 if x > 40 else 1.3 if x > 35 else 1.0,
            'unit_age_days': lambda x: 1.3 if x > 1000 else 1.1 if x > 500 else 1.0
        }

        for sensor, multiplier_func in risk_multipliers.items():
            if sensor in sensor_data:
                base_risk *= multiplier_func(sensor_data[sensor])

        # Adjust based on failure type severity
        failure_severity = {
            'no_failure': 0.1,
            'sensor_failure': 0.3,
            'filter_clogging': 0.4,
            'valve_failure': 0.6,
            'pump_failure': 0.7,
            'motor_failure': 0.8,
            'compressor_failure': 0.9
        }

        severity_multiplier = failure_severity.get(predicted_failure, 0.5)
        final_risk = min(base_risk * severity_multiplier, 1.0)

        return final_risk

    def _get_risk_level(self, risk_score: float) -> str:
        """Convert risk score to risk level."""
        if risk_score > 0.8:
            return 'critical'
        elif risk_score > 0.6:
            return 'high'
        elif risk_score > 0.4:
            return 'medium'
        elif risk_score > 0.2:
            return 'low'
        else:
            return 'minimal'

    def _estimate_time_to_failure(self, sensor_data: Dict[str, Any], risk_score: float) -> int:
        """Estimate days until potential failure."""
        base_days = 90  # Default maintenance interval

        # Adjust based on risk score
        if risk_score > 0.8:
            days = 7
        elif risk_score > 0.6:
            days = 14
        elif risk_score > 0.4:
            days = 30
        elif risk_score > 0.2:
            days = 60
        else:
            days = base_days

        # Adjust based on unit condition
        unit_age = sensor_data.get('unit_age_days', 0)
        if unit_age > 1000:
            days = max(days * 0.7, 7)

        maintenance_since = sensor_data.get('maintenance_days_since', 0)
        if maintenance_since < 30:
            days = max(days, 45)

        return int(days)

    def save_models(self, directory: str = 'models/maintenance') -> None:
        """
        Save trained maintenance models to disk.

        Args:
            directory: Directory to save models
        """
        try:
            os.makedirs(directory, exist_ok=True)

            # Save models
            if 'maintenance' in self.models:
                model = self.models['maintenance']
                if hasattr(model, 'save'):  # TensorFlow/Keras model
                    model.save(os.path.join(directory, 'maintenance_nn_model.h5'))
                else:  # Scikit-learn model
                    joblib.dump(model, os.path.join(directory, 'maintenance_model.pkl'))

            # Save preprocessors
            joblib.dump(self.scalers['standard'], os.path.join(directory, 'maintenance_scaler.pkl'))
            joblib.dump(self.encoders['failure_type'], os.path.join(directory, 'failure_type_encoder.pkl'))

            # Save metadata
            metadata = {
                'model_version': self.model_version,
                'features': self.all_features,
                'failure_types': self.failure_types,
                'hyperparameters': self.hyperparams,
                'saved_at': datetime.now().isoformat()
            }

            with open(os.path.join(directory, 'maintenance_metadata.json'), 'w') as f:
                json.dump(metadata, f, indent=2)

            self.logger.info(f"Maintenance models saved to {directory}")

        except Exception as e:
            self.logger.error(f"Error saving maintenance models: {e}")
            raise

    def load_models(self, directory: str = 'models/maintenance') -> None:
        """
        Load trained maintenance models from disk.

        Args:
            directory: Directory containing saved models
        """
        try:
            # Load metadata
            metadata_path = os.path.join(directory, 'maintenance_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.model_version = metadata.get('model_version', self.model_version)

            # Load model
            keras_path = os.path.join(directory, 'maintenance_nn_model.h5')
            sklearn_path = os.path.join(directory, 'maintenance_model.pkl')

            if os.path.exists(keras_path):
                self.models['maintenance'] = keras.models.load_model(keras_path)
            elif os.path.exists(sklearn_path):
                self.models['maintenance'] = joblib.load(sklearn_path)

            # Load preprocessors
            scaler_path = os.path.join(directory, 'maintenance_scaler.pkl')
            encoder_path = os.path.join(directory, 'failure_type_encoder.pkl')

            if os.path.exists(scaler_path):
                self.scalers['standard'] = joblib.load(scaler_path)
            if os.path.exists(encoder_path):
                self.encoders['failure_type'] = joblib.load(encoder_path)

            self.logger.info(f"Maintenance models loaded from {directory}")

        except Exception as e:
            self.logger.error(f"Error loading maintenance models: {e}")
            raise

    def get_model_health(self) -> Dict[str, Any]:
        """
        Get health status of maintenance models.

        Returns:
            Dictionary with model health information
        """
        try:
            health_status = {
                'overall_status': 'healthy',
                'model_loaded': 'maintenance' in self.models,
                'preprocessors_loaded': all(
                    scaler is not None for scaler in self.scalers.values()
                ),
                'model_version': self.model_version,
                'last_check': datetime.now().isoformat()
            }

            if not health_status['model_loaded']:
                health_status['overall_status'] = 'unhealthy'

            if not health_status['preprocessors_loaded']:
                health_status['overall_status'] = 'degraded'

            return health_status

        except Exception as e:
            self.logger.error(f"Error checking maintenance model health: {e}")
            return {
                'overall_status': 'error',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
