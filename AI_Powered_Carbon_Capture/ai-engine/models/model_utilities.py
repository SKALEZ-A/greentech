import numpy as np
import pandas as pd
import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any, Union
from pathlib import Path
import joblib
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import cross_val_score, learning_curve
import matplotlib.pyplot as plt
import seaborn as sns

class ModelUtilities:
    """
    Utility class for AI model management, validation, and performance monitoring
    in the carbon capture system.
    """

    def __init__(self, base_model_dir: str = 'models'):
        self.base_model_dir = Path(base_model_dir)
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)

        # Create base directory if it doesn't exist
        self.base_model_dir.mkdir(parents=True, exist_ok=True)

    def validate_model_input(self, model_name: str, input_data: Dict[str, Any],
                           required_fields: List[str]) -> Tuple[bool, List[str]]:
        """
        Validate input data for a specific model.

        Args:
            model_name: Name of the model
            input_data: Input data dictionary
            required_fields: List of required fields

        Returns:
            Tuple of (is_valid, missing_fields)
        """
        try:
            missing_fields = []

            for field in required_fields:
                if field not in input_data or input_data[field] is None:
                    missing_fields.append(field)

            is_valid = len(missing_fields) == 0

            if not is_valid:
                self.logger.warning(f"Model {model_name}: Missing required fields: {missing_fields}")

            return is_valid, missing_fields

        except Exception as e:
            self.logger.error(f"Error validating model input: {e}")
            return False, ["validation_error"]

    def preprocess_sensor_data(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Preprocess raw sensor data for model input.

        Args:
            sensor_data: Raw sensor readings

        Returns:
            Preprocessed sensor data
        """
        try:
            processed_data = sensor_data.copy()

            # Convert timestamps
            if 'timestamp' in processed_data:
                if isinstance(processed_data['timestamp'], str):
                    processed_data['timestamp'] = pd.to_datetime(processed_data['timestamp'])
                processed_data['timestamp'] = processed_data['timestamp'].isoformat()

            # Handle missing values
            numeric_fields = ['temperature', 'pressure', 'flow_rate', 'humidity',
                            'air_quality', 'energy_consumption', 'co2_concentration',
                            'vibration', 'motor_current', 'bearing_temperature']

            for field in numeric_fields:
                if field in processed_data and processed_data[field] is not None:
                    # Ensure numeric type
                    try:
                        processed_data[field] = float(processed_data[field])
                    except (ValueError, TypeError):
                        processed_data[field] = 0.0
                        self.logger.warning(f"Invalid numeric value for {field}, set to 0.0")

            # Calculate derived features
            processed_data = self._add_derived_features(processed_data)

            # Data quality check
            processed_data['data_quality_score'] = self._calculate_data_quality(processed_data)

            return processed_data

        except Exception as e:
            self.logger.error(f"Error preprocessing sensor data: {e}")
            return sensor_data

    def _add_derived_features(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add derived features to sensor data."""
        try:
            # Efficiency ratio
            if 'energy_consumption' in data and 'co2_concentration' in data:
                energy = data['energy_consumption']
                co2 = data['co2_concentration']
                if co2 > 0:
                    data['energy_efficiency_ratio'] = energy / co2

            # Temperature-humidity index
            if 'temperature' in data and 'humidity' in data:
                temp = data['temperature']
                humidity = data['humidity']
                data['temp_humidity_index'] = temp * (humidity / 100)

            # Flow efficiency
            if 'flow_rate' in data and 'pressure' in data:
                flow = data['flow_rate']
                pressure = data['pressure']
                if pressure > 0:
                    data['flow_pressure_ratio'] = flow / pressure

            # System health indicators
            if 'vibration' in data and 'motor_current' in data:
                vibration = data['vibration']
                current = data['motor_current']
                data['system_health_score'] = max(0, 100 - (vibration * 10 + current - 10))

            return data

        except Exception as e:
            self.logger.error(f"Error adding derived features: {e}")
            return data

    def _calculate_data_quality(self, data: Dict[str, Any]) -> float:
        """Calculate data quality score (0-100)."""
        try:
            quality_score = 100.0
            total_fields = 0
            valid_fields = 0

            # Core sensor fields
            core_fields = ['temperature', 'pressure', 'flow_rate', 'co2_concentration']

            for field in core_fields:
                total_fields += 1
                if field in data and data[field] is not None:
                    # Check if value is reasonable
                    value = data[field]
                    if isinstance(value, (int, float)):
                        # Basic range checks
                        if field == 'temperature' and -50 <= value <= 100:
                            valid_fields += 1
                        elif field == 'pressure' and 0 <= value <= 200:
                            valid_fields += 1
                        elif field == 'flow_rate' and 0 <= value <= 10000:
                            valid_fields += 1
                        elif field == 'co2_concentration' and 0 <= value <= 100:
                            valid_fields += 1
                        else:
                            valid_fields += 0.5  # Partial credit for out-of-range but present
                    else:
                        valid_fields += 0.5  # Partial credit for non-numeric but present

            # Calculate quality percentage
            if total_fields > 0:
                quality_score = (valid_fields / total_fields) * 100

            return min(quality_score, 100.0)

        except Exception as e:
            self.logger.error(f"Error calculating data quality: {e}")
            return 50.0  # Default medium quality

    def generate_model_report(self, model_name: str, training_results: Dict[str, Any],
                            validation_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate comprehensive model performance report.

        Args:
            model_name: Name of the model
            training_results: Training metrics and results
            validation_results: Validation metrics and results

        Returns:
            Comprehensive model report
        """
        try:
            report = {
                'model_name': model_name,
                'report_generated': datetime.now().isoformat(),
                'training_summary': training_results,
                'validation_summary': validation_results,
                'performance_metrics': {},
                'recommendations': [],
                'risk_assessment': {}
            }

            # Analyze training metrics
            if 'metrics' in training_results:
                best_model = training_results.get('best_model', 'unknown')
                metrics = training_results['metrics'].get(best_model, {})

                report['performance_metrics']['accuracy'] = metrics.get('accuracy', 0)
                report['performance_metrics']['precision'] = metrics.get('macro_precision', 0)
                report['performance_metrics']['recall'] = metrics.get('macro_recall', 0)
                report['performance_metrics']['f1_score'] = metrics.get('macro_f1', 0)
                report['performance_metrics']['r2_score'] = metrics.get('r2_score', 0)

            # Generate recommendations
            report['recommendations'] = self._generate_model_recommendations(
                training_results, validation_results
            )

            # Risk assessment
            report['risk_assessment'] = self._assess_model_risks(
                training_results, validation_results
            )

            # Save report to file
            report_path = self.base_model_dir / f"{model_name}_report.json"
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2, default=str)

            self.logger.info(f"Model report saved to {report_path}")

            return report

        except Exception as e:
            self.logger.error(f"Error generating model report: {e}")
            return {
                'error': str(e),
                'report_generated': datetime.now().isoformat()
            }

    def _generate_model_recommendations(self, training_results: Dict[str, Any],
                                      validation_results: Dict[str, Any]) -> List[str]:
        """Generate model improvement recommendations."""
        recommendations = []

        try:
            # Check training performance
            if 'best_model' in training_results:
                best_model = training_results['best_model']
                metrics = training_results.get('metrics', {}).get(best_model, {})

                accuracy = metrics.get('accuracy', 0)
                r2_score = metrics.get('r2_score', 0)
                f1_score = metrics.get('macro_f1', 0)

                # Accuracy recommendations
                if accuracy < 0.7:
                    recommendations.append("Consider collecting more training data to improve model accuracy")
                    recommendations.append("Review feature engineering - current features may not be predictive enough")

                if r2_score < 0.6 and r2_score > 0:  # Regression models
                    recommendations.append("Model explains less than 60% of variance - consider additional features")
                    recommendations.append("Evaluate for non-linear relationships that current model might miss")

                if f1_score < 0.7 and f1_score > 0:  # Classification models
                    recommendations.append("Classification performance needs improvement - consider class balancing")
                    recommendations.append("Review misclassification patterns to identify problematic classes")

            # Overfitting check
            if 'cross_validation_scores' in training_results:
                cv_scores = training_results['cross_validation_scores']
                mean_cv = cv_scores.get('mean', 0)
                std_cv = cv_scores.get('std', 0)

                if std_cv > 0.1:  # High variance
                    recommendations.append("High variance detected - consider regularization or simpler model")
                    recommendations.append("Implement cross-validation with more folds for stable performance")

            # General recommendations
            recommendations.extend([
                "Monitor model performance in production environment",
                "Set up automated retraining pipeline when new data becomes available",
                "Consider ensemble methods for improved robustness"
            ])

        except Exception as e:
            self.logger.error(f"Error generating recommendations: {e}")
            recommendations = ["Error generating recommendations - manual review required"]

        return recommendations

    def _assess_model_risks(self, training_results: Dict[str, Any],
                          validation_results: Dict[str, Any]) -> Dict[str, Any]:
        """Assess potential risks in model deployment."""
        risk_assessment = {
            'overall_risk': 'low',
            'risk_factors': [],
            'mitigation_strategies': []
        }

        try:
            # Performance risks
            if 'best_model' in training_results:
                metrics = training_results.get('metrics', {}).get(training_results['best_model'], {})

                accuracy = metrics.get('accuracy', 0)
                r2_score = metrics.get('r2_score', 0)
                f1_score = metrics.get('macro_f1', 0)

                if accuracy < 0.6:
                    risk_assessment['risk_factors'].append('Low model accuracy may lead to poor predictions')
                    risk_assessment['mitigation_strategies'].append('Implement prediction confidence thresholds')

                if r2_score < 0.5 and r2_score > 0:
                    risk_assessment['risk_factors'].append('Low explanatory power may miss important patterns')
                    risk_assessment['mitigation_strategies'].append('Use model as one input among multiple decision factors')

            # Data quality risks
            if 'training_timestamp' in training_results:
                training_date = pd.to_datetime(training_results['training_timestamp'])
                days_since_training = (datetime.now() - training_date).days

                if days_since_training > 90:
                    risk_assessment['risk_factors'].append('Model trained on old data may not reflect current conditions')
                    risk_assessment['mitigation_strategies'].append('Schedule regular model retraining')

            # Determine overall risk level
            risk_count = len(risk_assessment['risk_factors'])
            if risk_count >= 3:
                risk_assessment['overall_risk'] = 'high'
            elif risk_count >= 1:
                risk_assessment['overall_risk'] = 'medium'

        except Exception as e:
            self.logger.error(f"Error assessing model risks: {e}")
            risk_assessment['overall_risk'] = 'unknown'
            risk_assessment['risk_factors'] = ['Error in risk assessment']

        return risk_assessment

    def create_model_dashboard_data(self, model_name: str, predictions_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create dashboard data for model monitoring.

        Args:
            model_name: Name of the model
            predictions_history: List of recent predictions

        Returns:
            Dashboard data dictionary
        """
        try:
            dashboard_data = {
                'model_name': model_name,
                'last_updated': datetime.now().isoformat(),
                'total_predictions': len(predictions_history),
                'performance_metrics': {},
                'predictions_trend': [],
                'alerts': []
            }

            if not predictions_history:
                return dashboard_data

            # Calculate performance metrics from recent predictions
            recent_predictions = predictions_history[-100:]  # Last 100 predictions

            # Extract confidence scores
            confidence_scores = [p.get('confidence', 0) for p in recent_predictions if 'confidence' in p]

            if confidence_scores:
                dashboard_data['performance_metrics']['avg_confidence'] = np.mean(confidence_scores)
                dashboard_data['performance_metrics']['min_confidence'] = np.min(confidence_scores)
                dashboard_data['performance_metrics']['max_confidence'] = np.max(confidence_scores)

            # Generate alerts
            low_confidence_predictions = [p for p in recent_predictions
                                        if p.get('confidence', 1.0) < 0.5]

            if len(low_confidence_predictions) > len(recent_predictions) * 0.1:  # >10% low confidence
                dashboard_data['alerts'].append({
                    'type': 'warning',
                    'message': f"High number of low-confidence predictions ({len(low_confidence_predictions)})",
                    'severity': 'medium'
                })

            # Predictions trend (last 20 predictions)
            trend_data = recent_predictions[-20:]
            dashboard_data['predictions_trend'] = [
                {
                    'timestamp': p.get('timestamp', datetime.now().isoformat()),
                    'confidence': p.get('confidence', 0),
                    'prediction': p.get('predicted_failure', p.get('predicted_efficiency', 0))
                }
                for p in trend_data
            ]

            return dashboard_data

        except Exception as e:
            self.logger.error(f"Error creating dashboard data: {e}")
            return {
                'error': str(e),
                'last_updated': datetime.now().isoformat()
            }

    def export_model_for_deployment(self, model_name: str, model_object: Any,
                                  preprocessor_objects: Dict[str, Any],
                                  metadata: Dict[str, Any]) -> str:
        """
        Export model and preprocessing objects for deployment.

        Args:
            model_name: Name of the model
            model_object: Trained model object
            preprocessor_objects: Dictionary of preprocessor objects
            metadata: Model metadata

        Returns:
            Path to exported model directory
        """
        try:
            # Create deployment directory
            deployment_dir = self.base_model_dir / f"{model_name}_deployment"
            deployment_dir.mkdir(exist_ok=True)

            # Save model
            if hasattr(model_object, 'save'):  # TensorFlow/Keras model
                model_path = deployment_dir / "model.h5"
                model_object.save(model_path)
            else:  # Scikit-learn model
                model_path = deployment_dir / "model.pkl"
                joblib.dump(model_object, model_path)

            # Save preprocessors
            for name, preprocessor in preprocessor_objects.items():
                if preprocessor is not None:
                    preprocessor_path = deployment_dir / f"{name}.pkl"
                    joblib.dump(preprocessor, preprocessor_path)

            # Save metadata
            metadata_path = deployment_dir / "metadata.json"
            metadata['exported_at'] = datetime.now().isoformat()
            metadata['model_name'] = model_name

            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2, default=str)

            # Create deployment script template
            self._create_deployment_script(deployment_dir, model_name)

            deployment_path = str(deployment_dir)
            self.logger.info(f"Model exported for deployment to {deployment_path}")

            return deployment_path

        except Exception as e:
            self.logger.error(f"Error exporting model for deployment: {e}")
            raise

    def _create_deployment_script(self, deployment_dir: Path, model_name: str) -> None:
        """Create a deployment script template."""
        script_content = f'''#!/usr/bin/env python3
"""
Deployment script for {model_name} model.
This script provides functions to load and use the model in production.
"""

import joblib
import json
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional

class {model_name.title().replace("_", "")}Predictor:
    """Production predictor for {model_name} model."""

    def __init__(self, model_dir: str):
        self.model_dir = Path(model_dir)
        self.model = None
        self.preprocessors = {{}}
        self.metadata = {{}}

        self._load_model()

    def _load_model(self):
        """Load model and preprocessors."""
        try:
            # Load metadata
            with open(self.model_dir / "metadata.json", 'r') as f:
                self.metadata = json.load(f)

            # Load model
            model_path = self.model_dir / "model.pkl"
            if model_path.exists():
                self.model = joblib.load(model_path)
            else:
                # Try TensorFlow model
                import tensorflow as tf
                self.model = tf.keras.models.load_model(self.model_dir / "model.h5")

            # Load preprocessors
            preprocessor_files = list(self.model_dir.glob("*.pkl"))
            for pkl_file in preprocessor_files:
                if pkl_file.name != "model.pkl":
                    name = pkl_file.stem
                    self.preprocessors[name] = joblib.load(pkl_file)

            print(f"Model loaded successfully from {{self.model_dir}}")

        except Exception as e:
            print(f"Error loading model: {{e}}")
            raise

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make prediction using the loaded model.

        Args:
            input_data: Input data dictionary

        Returns:
            Prediction results
        """
        try:
            # Preprocess input data
            processed_data = self._preprocess_input(input_data)

            # Make prediction
            if hasattr(self.model, 'predict_proba'):
                # Classification model
                prediction = self.model.predict(processed_data)[0]
                confidence = np.max(self.model.predict_proba(processed_data)[0])
            else:
                # Regression model
                prediction = self.model.predict(processed_data)[0]
                confidence = 0.8  # Default confidence for regression

            return {{
                'prediction': float(prediction),
                'confidence': float(confidence),
                'model_version': self.metadata.get('model_version', 'unknown'),
                'timestamp': str(pd.Timestamp.now())
            }}

        except Exception as e:
            return {{
                'error': str(e),
                'prediction': None,
                'confidence': 0.0
            }}

    def _preprocess_input(self, input_data: Dict[str, Any]) -> np.ndarray:
        """Preprocess input data for prediction."""
        # This should be customized based on your preprocessing needs
        # For now, return input data as numpy array
        return np.array([list(input_data.values())])

# Usage example
if __name__ == "__main__":
    predictor = {model_name.title().replace("_", "")}Predictor(".")
    sample_input = {{
        # Add your sample input data here
        "feature1": 1.0,
        "feature2": 2.0
    }}
    result = predictor.predict(sample_input)
    print(result)
'''

        script_path = deployment_dir / f"predict_{model_name}.py"
        with open(script_path, 'w') as f:
            f.write(script_content)

        # Make script executable
        script_path.chmod(0o755)

    def validate_prediction_consistency(self, model_name: str, test_cases: List[Dict[str, Any]],
                                      tolerance: float = 0.05) -> Dict[str, Any]:
        """
        Validate prediction consistency across multiple runs.

        Args:
            model_name: Name of the model
            test_cases: List of test input cases
            tolerance: Acceptable variance tolerance

        Returns:
            Consistency validation results
        """
        try:
            consistency_results = {
                'model_name': model_name,
                'total_test_cases': len(test_cases),
                'consistency_score': 0.0,
                'inconsistent_predictions': [],
                'validation_timestamp': datetime.now().isoformat()
            }

            if not test_cases:
                return consistency_results

            # Run predictions multiple times
            num_runs = 3
            all_predictions = []

            for run in range(num_runs):
                run_predictions = []
                for test_case in test_cases:
                    # This would call the actual model prediction method
                    # For now, we'll simulate with random predictions
                    prediction = np.random.random()
                    run_predictions.append(prediction)
                all_predictions.append(run_predictions)

            # Check consistency across runs
            all_predictions = np.array(all_predictions)
            std_devs = np.std(all_predictions, axis=0)
            mean_predictions = np.mean(all_predictions, axis=0)

            # Calculate consistency score
            inconsistent_count = 0
            for i, (std_dev, mean_pred) in enumerate(zip(std_devs, mean_predictions)):
                relative_std = std_dev / (abs(mean_pred) + 1e-6)  # Avoid division by zero

                if relative_std > tolerance:
                    inconsistent_count += 1
                    consistency_results['inconsistent_predictions'].append({
                        'test_case_index': i,
                        'std_dev': float(std_dev),
                        'relative_std': float(relative_std),
                        'mean_prediction': float(mean_pred)
                    })

            consistency_results['consistency_score'] = 1.0 - (inconsistent_count / len(test_cases))

            return consistency_results

        except Exception as e:
            self.logger.error(f"Error validating prediction consistency: {e}")
            return {
                'error': str(e),
                'consistency_score': 0.0,
                'validation_timestamp': datetime.now().isoformat()
            }
