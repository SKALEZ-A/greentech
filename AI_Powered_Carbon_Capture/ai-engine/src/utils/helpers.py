"""
Utility functions for the Carbon Capture AI Engine.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import json
import logging
import hashlib
import os

logger = logging.getLogger(__name__)

def calculate_efficiency_metrics(current_efficiency: float,
                               predicted_efficiency: float,
                               actual_co2_captured: float,
                               energy_used: float) -> Dict[str, float]:
    """
    Calculate various efficiency metrics for carbon capture.

    Args:
        current_efficiency: Current system efficiency (%)
        predicted_efficiency: Predicted system efficiency (%)
        actual_co2_captured: Actual CO2 captured (tons)
        energy_used: Energy used (kWh)

    Returns:
        Dictionary of efficiency metrics
    """
    try:
        efficiency_gain = predicted_efficiency - current_efficiency
        efficiency_ratio = predicted_efficiency / current_efficiency if current_efficiency > 0 else 0

        # Energy intensity (kWh per ton of CO2)
        energy_intensity = energy_used / actual_co2_captured if actual_co2_captured > 0 else float('inf')

        # Cost effectiveness (assuming $0.12/kWh)
        energy_cost_per_ton = energy_intensity * 0.12

        return {
            'efficiency_gain_percent': efficiency_gain,
            'efficiency_ratio': efficiency_ratio,
            'energy_intensity_kwh_per_ton': energy_intensity,
            'energy_cost_per_ton_usd': energy_cost_per_ton,
            'performance_score': min(predicted_efficiency / 100, 1.0)  # 0-1 scale
        }

    except Exception as e:
        logger.error(f"Error calculating efficiency metrics: {e}")
        return {
            'efficiency_gain_percent': 0,
            'efficiency_ratio': 1,
            'energy_intensity_kwh_per_ton': float('inf'),
            'energy_cost_per_ton_usd': float('inf'),
            'performance_score': 0
        }

def validate_sensor_data(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate sensor data and flag anomalies.

    Args:
        sensor_data: Dictionary of sensor readings

    Returns:
        Validation results with flags and cleaned data
    """
    validation_result = {
        'is_valid': True,
        'anomalies': [],
        'warnings': [],
        'cleaned_data': sensor_data.copy()
    }

    # Define valid ranges for each sensor type
    sensor_ranges = {
        'temperature': {'min': -10, 'max': 60, 'unit': '°C'},
        'pressure': {'min': 30, 'max': 80, 'unit': 'psi'},
        'flow_rate': {'min': 500, 'max': 2000, 'unit': 'L/min'},
        'humidity': {'min': 0, 'max': 100, 'unit': '%'},
        'air_quality': {'min': 0, 'max': 500, 'unit': 'AQI'},
        'energy_consumption': {'min': 0, 'max': 5000, 'unit': 'kWh'},
        'co2_concentration': {'min': 300, 'max': 1000, 'unit': 'ppm'},
        'unit_age_days': {'min': 0, 'max': 3650, 'unit': 'days'},  # 10 years
        'maintenance_days_since': {'min': 0, 'max': 1000, 'unit': 'days'},
        'efficiency_current': {'min': 0, 'max': 100, 'unit': '%'}
    }

    for sensor_name, value in sensor_data.items():
        if sensor_name in sensor_ranges:
            sensor_config = sensor_ranges[sensor_name]

            # Check for null/missing values
            if value is None or (isinstance(value, float) and np.isnan(value)):
                validation_result['warnings'].append(f"{sensor_name}: missing value")
                # Use default value
                validation_result['cleaned_data'][sensor_name] = sensor_config.get('default', 0)
                continue

            # Check range
            if not (sensor_config['min'] <= value <= sensor_config['max']):
                validation_result['anomalies'].append({
                    'sensor': sensor_name,
                    'value': value,
                    'expected_range': f"{sensor_config['min']}-{sensor_config['max']} {sensor_config['unit']}",
                    'severity': 'high' if abs(value) > sensor_config['max'] * 1.5 else 'medium'
                })

                # Clamp value to valid range
                validation_result['cleaned_data'][sensor_name] = np.clip(
                    value, sensor_config['min'], sensor_config['max']
                )

            # Check for unrealistic precision (possible sensor error)
            if isinstance(value, float) and value != 0:
                decimal_places = len(str(value).split('.')[-1]) if '.' in str(value) else 0
                if decimal_places > 6:  # Unrealistic precision
                    validation_result['warnings'].append(
                        f"{sensor_name}: unrealistic precision ({decimal_places} decimal places)"
                    )

    # Overall validation status
    if validation_result['anomalies']:
        validation_result['is_valid'] = False

    return validation_result

def preprocess_features(data: pd.DataFrame,
                       feature_columns: List[str],
                       add_derived_features: bool = True) -> pd.DataFrame:
    """
    Preprocess features for model input.

    Args:
        data: Input dataframe
        feature_columns: List of feature column names
        add_derived_features: Whether to add derived features

    Returns:
        Preprocessed dataframe
    """
    try:
        processed_data = data.copy()

        # Handle missing values
        processed_data = processed_data.fillna(processed_data.mean())

        # Ensure all required columns exist
        for col in feature_columns:
            if col not in processed_data.columns:
                processed_data[col] = 0

        # Select only feature columns
        feature_data = processed_data[feature_columns]

        # Add derived features if requested
        if add_derived_features:
            # Energy efficiency ratio
            if 'energy_consumption' in feature_data.columns and 'co2_concentration' in feature_data.columns:
                feature_data['energy_efficiency_ratio'] = (
                    feature_data['energy_consumption'] / (feature_data['co2_concentration'] + 1)
                )

            # Temperature-humidity index
            if 'temperature' in feature_data.columns and 'humidity' in feature_data.columns:
                feature_data['temp_humidity_index'] = (
                    feature_data['temperature'] * (feature_data['humidity'] / 100)
                )

            # Flow rate efficiency
            if 'flow_rate' in feature_data.columns and 'pressure' in feature_data.columns:
                feature_data['flow_pressure_ratio'] = (
                    feature_data['flow_rate'] / (feature_data['pressure'] + 1)
                )

            # Maintenance urgency
            if 'unit_age_days' in feature_data.columns and 'maintenance_days_since' in feature_data.columns:
                feature_data['maintenance_urgency'] = (
                    feature_data['unit_age_days'] / (feature_data['maintenance_days_since'] + 1)
                )

        return feature_data

    except Exception as e:
        logger.error(f"Error preprocessing features: {e}")
        return data[feature_columns] if all(col in data.columns for col in feature_columns) else data

def calculate_prediction_confidence(prediction: float,
                                  feature_importance: Dict[str, float],
                                  feature_values: Dict[str, float]) -> float:
    """
    Calculate confidence score for a prediction.

    Args:
        prediction: Model prediction
        feature_importance: Dictionary of feature importance scores
        feature_values: Dictionary of feature values used in prediction

    Returns:
        Confidence score (0-1)
    """
    try:
        # Base confidence from prediction magnitude
        base_confidence = min(abs(prediction) / 100, 1.0)  # Normalize to 0-1

        # Feature completeness score
        available_features = sum(1 for feature in feature_importance.keys()
                               if feature in feature_values and feature_values[feature] is not None)
        completeness_score = available_features / len(feature_importance)

        # Weighted importance score
        total_importance = sum(feature_importance.values())
        weighted_score = sum(
            feature_importance.get(feature, 0) * (1 if feature in feature_values else 0)
            for feature in feature_importance.keys()
        ) / total_importance if total_importance > 0 else 0

        # Combined confidence score
        confidence = (base_confidence * 0.4 + completeness_score * 0.3 + weighted_score * 0.3)

        return min(confidence, 1.0)

    except Exception as e:
        logger.error(f"Error calculating prediction confidence: {e}")
        return 0.5  # Default moderate confidence

def generate_maintenance_schedule(unit_age_days: int,
                                maintenance_history: List[Dict[str, Any]],
                                risk_score: float) -> Dict[str, Any]:
    """
    Generate optimized maintenance schedule.

    Args:
        unit_age_days: Age of unit in days
        maintenance_history: List of past maintenance records
        risk_score: Current risk score (0-1)

    Returns:
        Maintenance schedule recommendations
    """
    try:
        # Base maintenance intervals
        base_intervals = {
            'routine_check': 30,  # days
            'minor_maintenance': 90,  # days
            'major_maintenance': 365,  # days
            'comprehensive_overhaul': 1095  # days (3 years)
        }

        # Adjust intervals based on risk score
        risk_multiplier = 1 + (risk_score * 0.5)  # 0-50% reduction in intervals

        adjusted_intervals = {
            k: max(int(v / risk_multiplier), 7)  # Minimum 1 week
            for k, v in base_intervals.items()
        }

        # Calculate next maintenance dates
        last_maintenance = max([m.get('date', datetime.now() - timedelta(days=365))
                              for m in maintenance_history], default=datetime.now() - timedelta(days=365))

        next_maintenance = {
            'routine_check': last_maintenance + timedelta(days=adjusted_intervals['routine_check']),
            'minor_maintenance': last_maintenance + timedelta(days=adjusted_intervals['minor_maintenance']),
            'major_maintenance': last_maintenance + timedelta(days=adjusted_intervals['major_maintenance']),
            'comprehensive_overhaul': last_maintenance + timedelta(days=adjusted_intervals['comprehensive_overhaul'])
        }

        # Determine priority based on risk and time to next maintenance
        days_to_next_routine = (next_maintenance['routine_check'] - datetime.now()).days
        priority = 'low'
        if risk_score > 0.7 or days_to_next_routine < 7:
            priority = 'critical'
        elif risk_score > 0.5 or days_to_next_routine < 14:
            priority = 'high'
        elif risk_score > 0.3 or days_to_next_routine < 30:
            priority = 'medium'

        return {
            'schedule': {
                maintenance_type: date.isoformat()
                for maintenance_type, date in next_maintenance.items()
            },
            'intervals_days': adjusted_intervals,
            'priority': priority,
            'risk_adjusted': risk_score > 0.3,
            'recommendations': [
                f"Next routine check: {next_maintenance['routine_check'].strftime('%Y-%m-%d')}",
                f"Next minor maintenance: {next_maintenance['minor_maintenance'].strftime('%Y-%m-%d')}",
                f"Risk-adjusted intervals applied (risk score: {risk_score:.2f})"
            ]
        }

    except Exception as e:
        logger.error(f"Error generating maintenance schedule: {e}")
        return {
            'schedule': {},
            'intervals_days': base_intervals,
            'priority': 'unknown',
            'risk_adjusted': False,
            'recommendations': ['Unable to generate schedule due to error']
        }

def calculate_carbon_credits(captured_co2_tons: float,
                           efficiency: float,
                           methodology: str = 'baseline') -> Dict[str, Any]:
    """
    Calculate carbon credits based on captured CO2.

    Args:
        captured_co2_tons: Tons of CO2 captured
        efficiency: Capture efficiency percentage
        methodology: Carbon credit methodology

    Returns:
        Carbon credit calculations
    """
    try:
        # Base credit calculation (1 credit per ton CO2)
        base_credits = captured_co2_tons

        # Efficiency bonus (up to 20% bonus for high efficiency)
        efficiency_bonus = min(efficiency / 100 * 0.2, 0.2)
        efficiency_adjusted_credits = base_credits * (1 + efficiency_bonus)

        # Methodology adjustments
        methodology_multipliers = {
            'baseline': 1.0,
            'enhanced': 1.1,  # 10% bonus for enhanced methodologies
            'innovative': 1.2  # 20% bonus for innovative approaches
        }

        methodology_multiplier = methodology_multipliers.get(methodology, 1.0)
        final_credits = efficiency_adjusted_credits * methodology_multiplier

        # Calculate monetary value (assuming $25 per credit)
        estimated_value = final_credits * 25

        return {
            'base_credits': base_credits,
            'efficiency_bonus': efficiency_bonus,
            'methodology_multiplier': methodology_multiplier,
            'final_credits': final_credits,
            'estimated_value_usd': estimated_value,
            'breakdown': {
                'base_amount': base_credits,
                'efficiency_adjustment': base_credits * efficiency_bonus,
                'methodology_adjustment': efficiency_adjusted_credits * (methodology_multiplier - 1)
            }
        }

    except Exception as e:
        logger.error(f"Error calculating carbon credits: {e}")
        return {
            'base_credits': 0,
            'final_credits': 0,
            'estimated_value_usd': 0,
            'error': str(e)
        }

def create_data_hash(data: Dict[str, Any]) -> str:
    """
    Create a hash of the input data for caching/validation purposes.

    Args:
        data: Data to hash

    Returns:
        SHA256 hash string
    """
    try:
        # Convert to JSON string with sorted keys for consistent hashing
        data_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(data_str.encode()).hexdigest()
    except Exception as e:
        logger.error(f"Error creating data hash: {e}")
        return "error_hash"

def format_prediction_response(prediction_data: Dict[str, Any],
                             include_metadata: bool = True) -> Dict[str, Any]:
    """
    Format prediction results for API response.

    Args:
        prediction_data: Raw prediction data
        include_metadata: Whether to include metadata

    Returns:
        Formatted response
    """
    try:
        response = {
            'prediction': prediction_data.get('prediction', {}),
            'confidence': prediction_data.get('confidence', 0.5),
            'timestamp': datetime.now().isoformat()
        }

        if include_metadata:
            response['metadata'] = {
                'model_version': prediction_data.get('model_version', 'unknown'),
                'processing_time_ms': prediction_data.get('processing_time_ms', 0),
                'data_hash': create_data_hash(prediction_data.get('input_data', {}))
            }

        return response

    except Exception as e:
        logger.error(f"Error formatting prediction response: {e}")
        return {
            'prediction': {},
            'confidence': 0,
            'timestamp': datetime.now().isoformat(),
            'error': str(e)
        }
