import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import xgboost as xgb
import joblib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
import json
import os

class EnergyOptimizationModel:
    """
    AI model for optimizing energy usage in carbon capture systems.
    Minimizes energy consumption while maintaining capture efficiency.
    """

    def __init__(self, model_version: str = "1.0.0"):
        self.model_version = model_version
        self.models = {}
        self.scalers = {}

        # Energy optimization features
        self.energy_features = [
            'temperature', 'pressure', 'flow_rate', 'humidity',
            'co2_concentration', 'air_quality', 'unit_age_days',
            'efficiency_target', 'renewable_energy_available',
            'grid_electricity_cost', 'time_of_day', 'season'
        ]

        # Target variables
        self.energy_targets = [
            'optimal_power_consumption', 'renewable_energy_usage',
            'grid_energy_usage', 'energy_cost_per_ton_co2'
        ]

        # Hyperparameters for energy models
        self.hyperparams = {
            'rf': {
                'n_estimators': 150,
                'max_depth': 12,
                'min_samples_split': 2,
                'min_samples_leaf': 1,
                'random_state': 42
            },
            'xgb': {
                'n_estimators': 150,
                'max_depth': 8,
                'learning_rate': 0.05,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'random_state': 42
            },
            'nn': {
                'epochs': 200,
                'batch_size': 64,
                'validation_split': 0.2,
                'early_stopping_patience': 20,
                'learning_rate': 0.001
            }
        }

        # Energy cost parameters (can be updated based on location)
        self.energy_costs = {
            'renewable_kwh_cost': 0.08,  # $/kWh
            'grid_kwh_cost': 0.12,       # $/kWh
            'peak_hour_multiplier': 1.5,
            'off_peak_multiplier': 0.8
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

    def preprocess_energy_data(self, data: pd.DataFrame, fit: bool = False) -> pd.DataFrame:
        """
        Preprocess energy optimization data.

        Args:
            data: Input dataframe
            fit: Whether to fit scalers

        Returns:
            Preprocessed dataframe
        """
        try:
            processed_data = data.copy()

            # Handle missing values
            processed_data = processed_data.fillna(processed_data.mean())

            # Add derived energy features
            processed_data = self._add_energy_features(processed_data)

            # Ensure all required columns exist
            for col in self.energy_features:
                if col not in processed_data.columns:
                    processed_data[col] = 0

            # Select feature columns
            feature_data = processed_data[self.energy_features]

            if fit:
                # Fit and transform scalers
                scaled_features = self.scalers['standard'].fit_transform(feature_data)
            else:
                # Transform using fitted scalers
                scaled_features = self.scalers['standard'].transform(feature_data)

            # Convert back to dataframe
            scaled_df = pd.DataFrame(
                scaled_features,
                columns=self.energy_features,
                index=feature_data.index
            )

            return scaled_df

        except Exception as e:
            self.logger.error(f"Error in energy data preprocessing: {e}")
            raise

    def _add_energy_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Add derived features for energy optimization."""
        try:
            # Energy intensity ratio
            if 'power_consumption' in data.columns and 'co2_concentration' in data.columns:
                data['energy_intensity_ratio'] = data.get('power_consumption', 0) / (data['co2_concentration'] + 1)

            # Time-based energy cost factors
            if 'time_of_day' in data.columns:
                data['peak_hour_flag'] = data['time_of_day'].apply(
                    lambda x: 1 if 17 <= x <= 21 else 0  # Peak hours: 5-9 PM
                )
                data['off_peak_flag'] = data['time_of_day'].apply(
                    lambda x: 1 if 22 <= x <= 6 else 0   # Off-peak: 10 PM-6 AM
                )

            # Seasonal energy factors
            if 'season' in data.columns:
                season_multipliers = {'winter': 1.2, 'summer': 1.1, 'spring': 0.9, 'fall': 0.95}
                data['season_energy_multiplier'] = data['season'].map(season_multipliers).fillna(1.0)

            # Renewable energy potential
            if 'renewable_energy_available' in data.columns and 'power_consumption' in data.columns:
                data['renewable_energy_ratio'] = data['renewable_energy_available'] / (data.get('power_consumption', 1) + 1)

            # Efficiency-weighted energy cost
            if 'efficiency_target' in data.columns and 'grid_electricity_cost' in data.columns:
                data['efficiency_weighted_cost'] = data['grid_electricity_cost'] / (data['efficiency_target'] + 0.1)

            # Operating condition stress factor
            if 'temperature' in data.columns and 'pressure' in data.columns:
                data['operating_stress_factor'] = (data['temperature'] * data['pressure']) / 10000

            return data

        except Exception as e:
            self.logger.error(f"Error adding energy features: {e}")
            return data

    def train_energy_optimization_model(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train models for energy consumption optimization.

        Args:
            data: Training dataframe with operational data and energy metrics

        Returns:
            Dictionary with training results and metrics
        """
        try:
            self.logger.info("Starting energy optimization model training...")

            # Prepare data
            X = self.preprocess_energy_data(data[self.energy_features], fit=True)
            y = data['optimal_power_consumption']  # Target: optimal power consumption

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            results = {}

            # Train Random Forest for energy optimization
            self.logger.info("Training Random Forest energy model...")
            rf_model = RandomForestRegressor(**self.hyperparams['rf'])
            rf_model.fit(X_train, y_train)

            rf_pred = rf_model.predict(X_test)
            rf_metrics = self._calculate_energy_metrics(y_test, rf_pred)

            results['random_forest'] = {
                'model': rf_model,
                'metrics': rf_metrics,
                'feature_importance': dict(zip(self.energy_features, rf_model.feature_importances_))
            }

            # Train XGBoost for energy optimization
            self.logger.info("Training XGBoost energy model...")
            xgb_model = xgb.XGBRegressor(**self.hyperparams['xgb'])
            xgb_model.fit(X_train, y_train)

            xgb_pred = xgb_model.predict(X_test)
            xgb_metrics = self._calculate_energy_metrics(y_test, xgb_pred)

            results['xgboost'] = {
                'model': xgb_model,
                'metrics': xgb_metrics,
                'feature_importance': dict(zip(self.energy_features, xgb_model.feature_importances_))
            }

            # Train Neural Network for energy optimization
            self.logger.info("Training Neural Network energy model...")
            nn_model = self._build_energy_neural_network(X_train.shape[1])

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
                        patience=10,
                        factor=0.5,
                        min_lr=1e-6
                    )
                ],
                verbose=0
            )

            nn_pred = nn_model.predict(X_test).flatten()
            nn_metrics = self._calculate_energy_metrics(y_test, nn_pred)

            results['neural_network'] = {
                'model': nn_model,
                'metrics': nn_metrics
            }

            # Select best model based on R² score
            best_model_key = max(results.keys(),
                               key=lambda k: results[k]['metrics']['r2_score'])

            self.models['energy'] = results[best_model_key]['model']

            self.logger.info(f"Best energy model: {best_model_key}")
            self.logger.info(f"Training completed. Best R²: {results[best_model_key]['metrics']['r2_score']:.4f}")

            return {
                'success': True,
                'best_model': best_model_key,
                'models_trained': list(results.keys()),
                'metrics': {k: v['metrics'] for k, v in results.items()},
                'training_timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Error training energy optimization model: {e}")
            return {
                'success': False,
                'error': str(e),
                'training_timestamp': datetime.now().isoformat()
            }

    def _build_energy_neural_network(self, input_dim: int) -> keras.Model:
        """Build neural network for energy optimization."""
        model = keras.Sequential([
            keras.layers.Dense(256, activation='relu', input_dim=input_dim,
                             kernel_regularizer=keras.regularizers.l2(0.01)),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(0.2),

            keras.layers.Dense(128, activation='relu',
                             kernel_regularizer=keras.regularizers.l2(0.01)),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(0.2),

            keras.layers.Dense(64, activation='relu',
                             kernel_regularizer=keras.regularizers.l2(0.005)),
            keras.layers.Dense(32, activation='relu'),

            keras.layers.Dense(1, activation='linear')  # Regression output
        ])

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=self.hyperparams['nn']['learning_rate']),
            loss='mean_squared_error',
            metrics=['mae', 'mse']
        )

        return model

    def _calculate_energy_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate regression metrics for energy optimization."""
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_true, y_pred)
        mae = mean_absolute_error(y_true, y_pred)

        # Additional energy-specific metrics
        mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1))) * 100  # Mean Absolute Percentage Error

        # Energy efficiency score (lower is better for consumption prediction)
        efficiency_score = 1 - (rmse / np.mean(y_true))

        return {
            'mse': float(mse),
            'rmse': float(rmse),
            'r2_score': float(r2),
            'mae': float(mae),
            'mape': float(mape),
            'efficiency_score': float(efficiency_score)
        }

    def optimize_energy_usage(self, operational_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize energy usage for given operational conditions.

        Args:
            operational_data: Current operational parameters

        Returns:
            Energy optimization recommendations
        """
        try:
            if 'energy' not in self.models:
                raise ValueError("Energy model not trained. Please train the model first.")

            # Convert to dataframe
            input_df = pd.DataFrame([operational_data])

            # Preprocess
            processed_data = self.preprocess_energy_data(input_df, fit=False)

            # Predict optimal power consumption
            optimal_power = float(self.models['energy'].predict(processed_data)[0])

            # Calculate current power consumption
            current_power = operational_data.get('power_consumption', 0)

            # Calculate energy savings
            energy_savings = max(current_power - optimal_power, 0)
            savings_percentage = (energy_savings / current_power * 100) if current_power > 0 else 0

            # Renewable energy optimization
            renewable_available = operational_data.get('renewable_energy_available', 0)
            renewable_usage = min(optimal_power * 0.8, renewable_available)  # Target 80% renewable
            grid_usage = optimal_power - renewable_usage

            # Cost calculations
            time_of_day = operational_data.get('time_of_day', 12)
            is_peak_hour = 17 <= time_of_day <= 21
            is_off_peak = 22 <= time_of_day <= 6

            cost_multiplier = 1.0
            if is_peak_hour:
                cost_multiplier = self.energy_costs['peak_hour_multiplier']
            elif is_off_peak:
                cost_multiplier = self.energy_costs['off_peak_multiplier']

            renewable_cost = renewable_usage * self.energy_costs['renewable_kwh_cost']
            grid_cost = grid_usage * self.energy_costs['grid_kwh_cost'] * cost_multiplier
            total_cost = renewable_cost + grid_cost

            # CO2 impact (renewable has lower carbon intensity)
            co2_intensity_renewable = 0.05  # kg CO2/kWh (very low for renewables)
            co2_intensity_grid = 0.4       # kg CO2/kWh (average grid)
            co2_emissions = (renewable_usage * co2_intensity_renewable +
                           grid_usage * co2_intensity_grid)

            # Generate optimization recommendations
            recommendations = self._generate_energy_recommendations(
                operational_data, optimal_power, energy_savings, renewable_usage
            )

            result = {
                'optimal_power_consumption': optimal_power,
                'current_power_consumption': current_power,
                'energy_savings_kwh': energy_savings,
                'savings_percentage': savings_percentage,
                'renewable_energy_usage': renewable_usage,
                'grid_energy_usage': grid_usage,
                'total_energy_cost': total_cost,
                'renewable_cost': renewable_cost,
                'grid_cost': grid_cost,
                'co2_emissions_kg': co2_emissions,
                'recommendations': recommendations,
                'optimization_score': self._calculate_optimization_score(
                    operational_data, optimal_power, renewable_usage
                ),
                'model_version': self.model_version,
                'timestamp': datetime.now().isoformat()
            }

            self.logger.info(f"Energy optimization: {energy_savings:.1f} kWh savings ({savings_percentage:.1f}%)")

            return result

        except Exception as e:
            self.logger.error(f"Error optimizing energy usage: {e}")
            raise

    def _generate_energy_recommendations(self, operational_data: Dict[str, Any],
                                       optimal_power: float, energy_savings: float,
                                       renewable_usage: float) -> List[Dict[str, Any]]:
        """Generate energy optimization recommendations."""
        recommendations = []

        current_power = operational_data.get('power_consumption', 0)
        renewable_available = operational_data.get('renewable_energy_available', 0)

        # Power consumption optimization
        if energy_savings > current_power * 0.1:  # >10% savings
            recommendations.append({
                'category': 'power_optimization',
                'title': 'Significant Energy Savings Available',
                'description': f'Implement recommended power settings to save {energy_savings:.1f} kWh',
                'impact': {
                    'energy_savings': energy_savings,
                    'cost_savings': energy_savings * 0.1,  # Approximate cost savings
                    'co2_reduction': energy_savings * 0.3   # Approximate CO2 reduction
                },
                'priority': 'high',
                'implementation_time': '1-2 hours'
            })

        # Renewable energy utilization
        renewable_ratio = renewable_usage / (optimal_power + 1)
        if renewable_ratio < 0.7 and renewable_available > optimal_power * 0.5:
            recommendations.append({
                'category': 'renewable_integration',
                'title': 'Increase Renewable Energy Usage',
                'description': 'Optimize system to use more renewable energy sources',
                'impact': {
                    'renewable_increase': optimal_power * 0.8 - renewable_usage,
                    'cost_savings': (optimal_power * 0.8 - renewable_usage) * 0.04,
                    'co2_reduction': (optimal_power * 0.8 - renewable_usage) * 0.35
                },
                'priority': 'high',
                'implementation_time': '2-4 hours'
            })

        # Peak hour optimization
        time_of_day = operational_data.get('time_of_day', 12)
        if 17 <= time_of_day <= 21:  # Peak hours
            recommendations.append({
                'category': 'peak_shifting',
                'title': 'Peak Hour Energy Management',
                'description': 'Shift non-critical operations away from peak hours',
                'impact': {
                    'cost_savings': optimal_power * 0.04,  # Peak hour cost reduction
                    'grid_reliability': 'Improved grid stability'
                },
                'priority': 'medium',
                'implementation_time': 'Immediate'
            })

        # Efficiency improvements
        efficiency = operational_data.get('efficiency_current', 0)
        if efficiency < 85:
            recommendations.append({
                'category': 'efficiency_improvement',
                'title': 'System Efficiency Enhancement',
                'description': 'Implement efficiency improvements to reduce energy consumption',
                'impact': {
                    'efficiency_gain': 5.0,  # 5% efficiency improvement
                    'energy_savings': optimal_power * 0.05
                },
                'priority': 'medium',
                'implementation_time': '1-3 days'
            })

        return recommendations

    def _calculate_optimization_score(self, operational_data: Dict[str, Any],
                                    optimal_power: float, renewable_usage: float) -> float:
        """Calculate overall optimization score (0-100)."""
        score = 0

        # Power optimization score (40% weight)
        current_power = operational_data.get('power_consumption', optimal_power)
        if current_power > 0:
            power_score = max(0, (1 - abs(optimal_power - current_power) / current_power) * 40)
        else:
            power_score = 40
        score += power_score

        # Renewable utilization score (35% weight)
        total_power = operational_data.get('power_consumption', optimal_power)
        renewable_ratio = renewable_usage / (total_power + 1)
        renewable_score = min(renewable_ratio * 35, 35)
        score += renewable_score

        # Time-based optimization score (15% weight)
        time_of_day = operational_data.get('time_of_day', 12)
        if 22 <= time_of_day <= 6:  # Off-peak hours
            time_score = 15
        elif 17 <= time_of_day <= 21:  # Peak hours
            time_score = 5
        else:  # Normal hours
            time_score = 10
        score += time_score

        # Efficiency score (10% weight)
        efficiency = operational_data.get('efficiency_current', 85)
        efficiency_score = min(efficiency / 100 * 10, 10)
        score += efficiency_score

        return min(score, 100)

    def save_models(self, directory: str = 'models/energy') -> None:
        """
        Save trained energy models to disk.

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
                'energy_features': self.energy_features,
                'energy_targets': self.energy_targets,
                'hyperparameters': self.hyperparams,
                'energy_costs': self.energy_costs,
                'saved_at': datetime.now().isoformat()
            }

            with open(os.path.join(directory, 'energy_metadata.json'), 'w') as f:
                json.dump(metadata, f, indent=2)

            self.logger.info(f"Energy models saved to {directory}")

        except Exception as e:
            self.logger.error(f"Error saving energy models: {e}")
            raise

    def load_models(self, directory: str = 'models/energy') -> None:
        """
        Load trained energy models from disk.

        Args:
            directory: Directory containing saved models
        """
        try:
            # Load metadata
            metadata_path = os.path.join(directory, 'energy_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.model_version = metadata.get('model_version', self.model_version)
                    self.energy_costs = metadata.get('energy_costs', self.energy_costs)

            # Load models
            for model_name in ['energy']:
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

            self.logger.info(f"Energy models loaded from {directory}")

        except Exception as e:
            self.logger.error(f"Error loading energy models: {e}")
            raise

    def get_model_health(self) -> Dict[str, Any]:
        """
        Get health status of energy optimization models.

        Returns:
            Dictionary with model health information
        """
        try:
            health_status = {
                'overall_status': 'healthy',
                'energy_model_loaded': 'energy' in self.models,
                'scalers_loaded': all(scaler is not None for scaler in self.scalers.values()),
                'model_version': self.model_version,
                'energy_costs_configured': bool(self.energy_costs),
                'last_check': datetime.now().isoformat()
            }

            if not health_status['energy_model_loaded']:
                health_status['overall_status'] = 'unhealthy'

            if not health_status['scalers_loaded']:
                health_status['overall_status'] = 'degraded'

            return health_status

        except Exception as e:
            self.logger.error(f"Error checking energy model health: {e}")
            return {
                'overall_status': 'error',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
