import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import StandardScaler, LabelEncoder
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

class CarbonCreditValuationModel:
    """
    AI model for valuing carbon credits based on various market and environmental factors.
    Predicts optimal pricing and trading strategies for carbon credits.
    """

    def __init__(self, model_version: str = "1.0.0"):
        self.model_version = model_version
        self.models = {}
        self.scalers = {}
        self.encoders = {}

        # Carbon credit valuation features
        self.valuation_features = [
            'co2_captured_tons', 'capture_efficiency', 'project_type',
            'project_location', 'project_age_years', 'certification_standard',
            'additionality_score', 'permanence_score', 'leakage_risk',
            'market_demand', 'regulatory_pressure', 'technology_type',
            'energy_source', 'monitoring_frequency', 'third_party_verified'
        ]

        # Market features
        self.market_features = [
            'current_market_price', 'trading_volume', 'market_volatility',
            'policy_changes_index', 'industry_demand', 'geographic_premium'
        ]

        # Target variables
        self.valuation_targets = [
            'optimal_credit_price', 'market_value_prediction',
            'trading_probability', 'holding_period_months'
        ]

        # Hyperparameters
        self.hyperparams = {
            'rf': {
                'n_estimators': 200,
                'max_depth': 15,
                'min_samples_split': 2,
                'min_samples_leaf': 1,
                'random_state': 42
            },
            'xgb': {
                'n_estimators': 200,
                'max_depth': 8,
                'learning_rate': 0.05,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
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

        # Carbon credit standards and their baseline values
        self.certification_standards = {
            'verra_vcs': {'baseline_price': 25, 'premium_multiplier': 1.2},
            'gold_standard': {'baseline_price': 28, 'premium_multiplier': 1.3},
            'american_carbon_registry': {'baseline_price': 22, 'premium_multiplier': 1.1},
            'climate_action_reserve': {'baseline_price': 20, 'premium_multiplier': 1.0},
            'iso_14064': {'baseline_price': 18, 'premium_multiplier': 0.9}
        }

        # Setup logging
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)

        # Initialize preprocessors
        self._initialize_preprocessors()

    def _initialize_preprocessors(self):
        """Initialize data preprocessing components."""
        self.scalers['standard'] = StandardScaler()
        self.encoders['project_type'] = LabelEncoder()
        self.encoders['certification_standard'] = LabelEncoder()
        self.encoders['technology_type'] = LabelEncoder()

        # Fit encoders with known categories
        self.encoders['project_type'].fit([
            'direct_air_capture', 'forestry', 'renewable_energy',
            'industrial_process', 'methane_capture', 'soil_carbon'
        ])

        self.encoders['certification_standard'].fit(list(self.certification_standards.keys()))

        self.encoders['technology_type'].fit([
            'solid_sorbent', 'liquid_absorption', 'membrane_separation',
            'cryogenic', 'biological', 'mineralization'
        ])

    def preprocess_valuation_data(self, data: pd.DataFrame, fit: bool = False) -> pd.DataFrame:
        """
        Preprocess carbon credit valuation data.

        Args:
            data: Input dataframe
            fit: Whether to fit preprocessors

        Returns:
            Preprocessed dataframe
        """
        try:
            processed_data = data.copy()

            # Handle missing values
            processed_data = processed_data.fillna(processed_data.mean())

            # Encode categorical variables
            processed_data = self._encode_categorical_features(processed_data)

            # Add derived valuation features
            processed_data = self._add_valuation_features(processed_data)

            # Ensure all required columns exist
            all_features = self.valuation_features + self.market_features
            for col in all_features:
                if col not in processed_data.columns:
                    processed_data[col] = 0

            # Select feature columns
            feature_data = processed_data[all_features]

            if fit:
                # Fit and transform scalers
                scaled_features = self.scalers['standard'].fit_transform(feature_data)
            else:
                # Transform using fitted scalers
                scaled_features = self.scalers['standard'].transform(feature_data)

            # Convert back to dataframe
            scaled_df = pd.DataFrame(
                scaled_features,
                columns=all_features,
                index=feature_data.index
            )

            return scaled_df

        except Exception as e:
            self.logger.error(f"Error in valuation data preprocessing: {e}")
            raise

    def _encode_categorical_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Encode categorical features for model input."""
        try:
            encoded_data = data.copy()

            # Encode categorical columns
            categorical_mappings = {
                'project_type': 'project_type',
                'certification_standard': 'certification_standard',
                'technology_type': 'technology_type'
            }

            for col, encoder_key in categorical_mappings.items():
                if col in encoded_data.columns:
                    # Handle unknown categories
                    try:
                        encoded_data[f'{col}_encoded'] = self.encoders[encoder_key].transform(encoded_data[col])
                    except ValueError:
                        # For unknown categories, assign -1
                        known_categories = set(self.encoders[encoder_key].classes_)
                        encoded_data[f'{col}_encoded'] = encoded_data[col].apply(
                            lambda x: self.encoders[encoder_key].transform([x])[0] if x in known_categories else -1
                        )

            return encoded_data

        except Exception as e:
            self.logger.error(f"Error encoding categorical features: {e}")
            return data

    def _add_valuation_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Add derived features for carbon credit valuation."""
        try:
            # Quality score (combination of additionality, permanence, leakage)
            if all(col in data.columns for col in ['additionality_score', 'permanence_score', 'leakage_risk']):
                data['overall_quality_score'] = (
                    data['additionality_score'] * 0.4 +
                    data['permanence_score'] * 0.4 +
                    (1 - data['leakage_risk']) * 0.2
                )

            # Project maturity premium
            if 'project_age_years' in data.columns:
                data['maturity_premium'] = np.where(
                    data['project_age_years'] > 5, 1.2,
                    np.where(data['project_age_years'] > 2, 1.1, 1.0)
                )

            # Monitoring quality factor
            if 'monitoring_frequency' in data.columns and 'third_party_verified' in data.columns:
                data['monitoring_quality'] = (
                    data['monitoring_frequency'] * 0.7 +
                    data['third_party_verified'].astype(int) * 0.3
                )

            # Market demand multiplier
            if 'market_demand' in data.columns and 'regulatory_pressure' in data.columns:
                data['market_pressure_index'] = data['market_demand'] * data['regulatory_pressure']

            # Geographic premium (simplified)
            if 'project_location' in data.columns:
                # Simplified geographic premium based on region
                region_premiums = {
                    'north_america': 1.2, 'europe': 1.3, 'asia': 1.0,
                    'africa': 0.9, 'south_america': 1.0, 'oceania': 1.1
                }
                data['geographic_premium'] = data['project_location'].map(region_premiums).fillna(1.0)

            # Technology efficiency premium
            if 'capture_efficiency' in data.columns and 'technology_type' in data.columns:
                data['technology_efficiency_premium'] = data['capture_efficiency'] / 80  # Normalized to 80% baseline

            # Scale factor based on project size
            if 'co2_captured_tons' in data.columns:
                data['scale_factor'] = np.log(data['co2_captured_tons'] + 1) / np.log(1000)  # Log scale normalized to 1000 tons

            return data

        except Exception as e:
            self.logger.error(f"Error adding valuation features: {e}")
            return data

    def train_valuation_model(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train carbon credit valuation models.

        Args:
            data: Training dataframe with carbon credit data

        Returns:
            Dictionary with training results and metrics
        """
        try:
            self.logger.info("Starting carbon credit valuation model training...")

            # Prepare data
            all_features = self.valuation_features + self.market_features
            X = self.preprocess_valuation_data(data[all_features], fit=True)
            y = data['optimal_credit_price']  # Target: optimal credit price

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            results = {}

            # Train Random Forest
            self.logger.info("Training Random Forest valuation model...")
            rf_model = RandomForestRegressor(**self.hyperparams['rf'])
            rf_model.fit(X_train, y_train)

            rf_pred = rf_model.predict(X_test)
            rf_metrics = self._calculate_valuation_metrics(y_test, rf_pred)

            results['random_forest'] = {
                'model': rf_model,
                'metrics': rf_metrics,
                'feature_importance': dict(zip(X.columns, rf_model.feature_importances_))
            }

            # Train XGBoost
            self.logger.info("Training XGBoost valuation model...")
            xgb_model = xgb.XGBRegressor(**self.hyperparams['xgb'])
            xgb_model.fit(X_train, y_train)

            xgb_pred = xgb_model.predict(X_test)
            xgb_metrics = self._calculate_valuation_metrics(y_test, xgb_pred)

            results['xgboost'] = {
                'model': xgb_model,
                'metrics': xgb_metrics,
                'feature_importance': dict(zip(X.columns, xgb_model.feature_importances_))
            }

            # Train Neural Network
            self.logger.info("Training Neural Network valuation model...")
            nn_model = self._build_valuation_neural_network(X_train.shape[1])

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

            nn_pred = nn_model.predict(X_test).flatten()
            nn_metrics = self._calculate_valuation_metrics(y_test, nn_pred)

            results['neural_network'] = {
                'model': nn_model,
                'metrics': nn_metrics
            }

            # Select best model
            best_model_key = max(results.keys(),
                               key=lambda k: results[k]['metrics']['r2_score'])

            self.models['valuation'] = results[best_model_key]['model']

            self.logger.info(f"Best valuation model: {best_model_key}")
            self.logger.info(f"Training completed. Best R²: {results[best_model_key]['metrics']['r2_score']:.4f}")

            return {
                'success': True,
                'best_model': best_model_key,
                'models_trained': list(results.keys()),
                'metrics': {k: v['metrics'] for k, v in results.items()},
                'training_timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Error training valuation model: {e}")
            return {
                'success': False,
                'error': str(e),
                'training_timestamp': datetime.now().isoformat()
            }

    def _build_valuation_neural_network(self, input_dim: int) -> keras.Model:
        """Build neural network for carbon credit valuation."""
        model = keras.Sequential([
            keras.layers.Dense(128, activation='relu', input_dim=input_dim,
                             kernel_regularizer=keras.regularizers.l2(0.01)),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(self.hyperparams['nn']['dropout_rate']),

            keras.layers.Dense(64, activation='relu',
                             kernel_regularizer=keras.regularizers.l2(0.01)),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(self.hyperparams['nn']['dropout_rate']),

            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dropout(self.hyperparams['nn']['dropout_rate'] / 2),

            keras.layers.Dense(1, activation='linear')  # Regression output
        ])

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mean_squared_error',
            metrics=['mae', 'mse']
        )

        return model

    def _calculate_valuation_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        """Calculate valuation model metrics."""
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_true, y_pred)
        mae = mean_absolute_error(y_true, y_pred)

        # Additional valuation metrics
        mape = np.mean(np.abs((y_true - y_pred) / (y_true + 1))) * 100

        # Valuation accuracy score
        accuracy_score = 1 - (mae / np.mean(y_true))

        return {
            'mse': float(mse),
            'rmse': float(rmse),
            'r2_score': float(r2),
            'mae': float(mae),
            'mape': float(mape),
            'valuation_accuracy': float(accuracy_score)
        }

    def value_carbon_credits(self, credit_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Value carbon credits based on project characteristics.

        Args:
            credit_data: Carbon credit project data

        Returns:
            Valuation results and recommendations
        """
        try:
            if 'valuation' not in self.models:
                raise ValueError("Valuation model not trained. Please train the model first.")

            # Convert to dataframe
            input_df = pd.DataFrame([credit_data])

            # Preprocess
            processed_data = self.preprocess_valuation_data(input_df, fit=False)

            # Predict optimal price
            predicted_price = float(self.models['valuation'].predict(processed_data)[0])

            # Calculate confidence intervals
            confidence_interval = self._calculate_price_confidence_interval(
                processed_data, predicted_price
            )

            # Generate trading recommendations
            trading_recommendations = self._generate_trading_recommendations(
                credit_data, predicted_price
            )

            # Calculate risk assessment
            risk_assessment = self._assess_credit_risk(credit_data)

            # Market timing analysis
            market_timing = self._analyze_market_timing(credit_data)

            # Portfolio optimization suggestions
            portfolio_suggestions = self._generate_portfolio_suggestions(credit_data, predicted_price)

            result = {
                'predicted_price_per_ton': predicted_price,
                'confidence_interval': confidence_interval,
                'price_range': {
                    'low': confidence_interval['lower_bound'],
                    'high': confidence_interval['upper_bound']
                },
                'trading_recommendations': trading_recommendations,
                'risk_assessment': risk_assessment,
                'market_timing': market_timing,
                'portfolio_suggestions': portfolio_suggestions,
                'total_project_value': predicted_price * credit_data.get('co2_captured_tons', 0),
                'model_version': self.model_version,
                'valuation_timestamp': datetime.now().isoformat()
            }

            self.logger.info(f"Carbon credit valuation: ${predicted_price:.2f} per ton")

            return result

        except Exception as e:
            self.logger.error(f"Error valuing carbon credits: {e}")
            raise

    def _calculate_price_confidence_interval(self, processed_data: pd.DataFrame,
                                          predicted_price: float) -> Dict[str, float]:
        """Calculate confidence interval for price prediction."""
        # Simplified confidence interval calculation
        # In practice, this would use prediction intervals from the model
        base_uncertainty = 0.15  # 15% base uncertainty

        # Adjust based on data quality
        uncertainty_multiplier = 1.0

        # Higher uncertainty for new projects
        if 'project_age_years' in processed_data.columns:
            age = processed_data['project_age_years'].iloc[0]
            if age < 1:
                uncertainty_multiplier *= 1.5
            elif age < 3:
                uncertainty_multiplier *= 1.2

        # Higher uncertainty for lower certification standards
        if 'certification_standard_encoded' in processed_data.columns:
            cert_level = processed_data['certification_standard_encoded'].iloc[0]
            if cert_level <= 1:  # Lower certification levels
                uncertainty_multiplier *= 1.3

        final_uncertainty = base_uncertainty * uncertainty_multiplier

        return {
            'lower_bound': predicted_price * (1 - final_uncertainty),
            'upper_bound': predicted_price * (1 + final_uncertainty),
            'uncertainty_percentage': final_uncertainty * 100
        }

    def _generate_trading_recommendations(self, credit_data: Dict[str, Any],
                                        predicted_price: float) -> List[Dict[str, Any]]:
        """Generate trading recommendations."""
        recommendations = []

        current_market_price = credit_data.get('current_market_price', predicted_price)

        # Price-based recommendations
        price_ratio = predicted_price / (current_market_price + 0.01)

        if price_ratio > 1.1:  # 10% above market
            recommendations.append({
                'action': 'hold',
                'reason': 'Price significantly above market value',
                'expected_appreciation': f"{(price_ratio - 1) * 100:.1f}% above market",
                'timeframe': '3-6 months',
                'confidence': 'high'
            })
        elif price_ratio < 0.9:  # 10% below market
            recommendations.append({
                'action': 'sell',
                'reason': 'Price below market value',
                'potential_loss': f"{(1 - price_ratio) * 100:.1f}% below market",
                'timeframe': 'immediate',
                'confidence': 'medium'
            })
        else:
            recommendations.append({
                'action': 'monitor',
                'reason': 'Price aligned with market value',
                'strategy': 'Wait for optimal market conditions',
                'timeframe': '1-3 months',
                'confidence': 'medium'
            })

        # Volume-based recommendations
        trading_volume = credit_data.get('trading_volume', 1000)
        if trading_volume > 5000:
            recommendations.append({
                'action': 'consider_batch_trading',
                'reason': 'High trading volume indicates liquid market',
                'advantage': 'Lower transaction costs, better price discovery',
                'timeframe': 'ongoing',
                'confidence': 'high'
            })

        return recommendations

    def _assess_credit_risk(self, credit_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess risk factors for carbon credits."""
        risk_score = 0
        risk_factors = []

        # Permanence risk
        permanence = credit_data.get('permanence_score', 0.8)
        if permanence < 0.7:
            risk_score += 20
            risk_factors.append('Low permanence score')

        # Leakage risk
        leakage = credit_data.get('leakage_risk', 0.1)
        if leakage > 0.2:
            risk_score += 15
            risk_factors.append('High leakage risk')

        # Additionality risk
        additionality = credit_data.get('additionality_score', 0.8)
        if additionality < 0.7:
            risk_score += 10
            risk_factors.append('Low additionality score')

        # Project age risk
        age = credit_data.get('project_age_years', 2)
        if age < 1:
            risk_score += 25
            risk_factors.append('Very new project')

        # Certification risk
        certification = credit_data.get('certification_standard', 'unknown')
        if certification not in ['verra_vcs', 'gold_standard']:
            risk_score += 10
            risk_factors.append('Lower-tier certification')

        risk_level = 'low' if risk_score < 20 else 'medium' if risk_score < 40 else 'high'

        return {
            'risk_score': min(risk_score, 100),
            'risk_level': risk_level,
            'risk_factors': risk_factors,
            'recommended_discount': risk_score * 0.5  # 0.5% discount per risk point
        }

    def _analyze_market_timing(self, credit_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze optimal market timing for credit sales."""
        market_demand = credit_data.get('market_demand', 0.5)
        regulatory_pressure = credit_data.get('regulatory_pressure', 0.5)

        # Seasonal patterns (simplified)
        current_month = datetime.now().month

        # High demand periods (compliance deadlines)
        high_demand_months = [3, 6, 9, 12]  # Quarter ends
        seasonal_multiplier = 1.2 if current_month in high_demand_months else 1.0

        market_pressure = market_demand * regulatory_pressure * seasonal_multiplier

        if market_pressure > 0.7:
            timing = 'sell_now'
            reason = 'High market demand and regulatory pressure'
        elif market_pressure > 0.4:
            timing = 'monitor_and_sell'
            reason = 'Moderate market conditions'
        else:
            timing = 'hold'
            reason = 'Low market demand'

        return {
            'recommended_timing': timing,
            'reason': reason,
            'market_pressure_index': market_pressure,
            'seasonal_multiplier': seasonal_multiplier,
            'optimal_window_months': 3 if timing == 'sell_now' else 6 if timing == 'monitor_and_sell' else 12
        }

    def _generate_portfolio_suggestions(self, credit_data: Dict[str, Any],
                                      predicted_price: float) -> List[Dict[str, Any]]:
        """Generate portfolio diversification suggestions."""
        suggestions = []

        project_type = credit_data.get('project_type', 'unknown')
        certification = credit_data.get('certification_standard', 'unknown')

        # Technology diversification
        if project_type == 'direct_air_capture':
            suggestions.append({
                'type': 'diversification',
                'suggestion': 'Consider adding forestry or renewable energy credits',
                'reason': 'Balance technology-specific risks',
                'benefit': 'Reduced technology concentration risk'
            })

        # Geographic diversification
        location = credit_data.get('project_location', 'unknown')
        if location in ['north_america', 'europe']:
            suggestions.append({
                'type': 'geographic_diversification',
                'suggestion': 'Add credits from emerging markets',
                'reason': 'Reduce regional regulatory risk',
                'benefit': 'Lower geographic concentration risk'
            })

        # Certification diversification
        if certification in ['verra_vcs', 'gold_standard']:
            suggestions.append({
                'type': 'certification_diversification',
                'suggestion': 'Include lower-cost certification credits',
                'reason': 'Optimize cost-benefit ratio',
                'benefit': 'Improved portfolio efficiency'
            })

        return suggestions

    def save_models(self, directory: str = 'models/valuation') -> None:
        """
        Save trained valuation models to disk.

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

            # Save preprocessors
            for encoder_name, encoder in self.encoders.items():
                joblib.dump(encoder, os.path.join(directory, f'{encoder_name}_encoder.pkl'))

            joblib.dump(self.scalers['standard'], os.path.join(directory, 'valuation_scaler.pkl'))

            # Save metadata
            metadata = {
                'model_version': self.model_version,
                'valuation_features': self.valuation_features,
                'market_features': self.market_features,
                'certification_standards': self.certification_standards,
                'hyperparameters': self.hyperparams,
                'saved_at': datetime.now().isoformat()
            }

            with open(os.path.join(directory, 'valuation_metadata.json'), 'w') as f:
                json.dump(metadata, f, indent=2)

            self.logger.info(f"Valuation models saved to {directory}")

        except Exception as e:
            self.logger.error(f"Error saving valuation models: {e}")
            raise

    def load_models(self, directory: str = 'models/valuation') -> None:
        """
        Load trained valuation models from disk.

        Args:
            directory: Directory containing saved models
        """
        try:
            # Load metadata
            metadata_path = os.path.join(directory, 'valuation_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.model_version = metadata.get('model_version', self.model_version)
                    self.certification_standards = metadata.get('certification_standards', self.certification_standards)

            # Load models
            for model_name in ['valuation']:
                keras_path = os.path.join(directory, f'{model_name}_model.h5')
                sklearn_path = os.path.join(directory, f'{model_name}_model.pkl')

                if os.path.exists(keras_path):
                    self.models[model_name] = keras.models.load_model(keras_path)
                elif os.path.exists(sklearn_path):
                    self.models[model_name] = joblib.load(sklearn_path)

            # Load encoders
            for encoder_name in self.encoders.keys():
                encoder_path = os.path.join(directory, f'{encoder_name}_encoder.pkl')
                if os.path.exists(encoder_path):
                    self.encoders[encoder_name] = joblib.load(encoder_path)

            # Load scaler
            scaler_path = os.path.join(directory, 'valuation_scaler.pkl')
            if os.path.exists(scaler_path):
                self.scalers['standard'] = joblib.load(scaler_path)

            self.logger.info(f"Valuation models loaded from {directory}")

        except Exception as e:
            self.logger.error(f"Error loading valuation models: {e}")
            raise

    def get_model_health(self) -> Dict[str, Any]:
        """
        Get health status of valuation models.

        Returns:
            Dictionary with model health information
        """
        try:
            health_status = {
                'overall_status': 'healthy',
                'valuation_model_loaded': 'valuation' in self.models,
                'encoders_loaded': all(encoder is not None for encoder in self.encoders.values()),
                'scaler_loaded': self.scalers.get('standard') is not None,
                'model_version': self.model_version,
                'certification_standards_configured': bool(self.certification_standards),
                'last_check': datetime.now().isoformat()
            }

            if not health_status['valuation_model_loaded']:
                health_status['overall_status'] = 'unhealthy'

            if not health_status['encoders_loaded'] or not health_status['scaler_loaded']:
                health_status['overall_status'] = 'degraded'

            return health_status

        except Exception as e:
            self.logger.error(f"Error checking valuation model health: {e}")
            return {
                'overall_status': 'error',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
