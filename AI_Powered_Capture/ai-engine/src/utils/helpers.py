#!/usr/bin/env python3
"""
Utility functions for the Carbon Capture AI Engine
"""

import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
import pandas as pd
import numpy as np
from pathlib import Path

def setup_logging(name: str = __name__,
                 level: str = 'INFO',
                 log_file: Optional[str] = None) -> logging.Logger:
    """
    Setup standardized logging configuration.

    Args:
        name: Logger name
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional log file path

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))

    # Clear existing handlers
    logger.handlers.clear()

    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler if specified
    if log_file:
        try:
            file_handler = logging.FileHandler(log_file)
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
        except Exception as e:
            logger.warning(f"Could not create log file handler: {e}")

    return logger

def validate_sensor_data(sensor_data: Dict[str, Any],
                        required_fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Validate sensor data structure and values.

    Args:
        sensor_data: Sensor data dictionary
        required_fields: List of required field names

    Returns:
        Validation result with success status and errors
    """
    errors = []
    warnings = []

    if not sensor_data:
        errors.append("Sensor data is empty")
        return {'valid': False, 'errors': errors, 'warnings': warnings}

    # Default required fields for carbon capture
    if required_fields is None:
        required_fields = [
            'temperature', 'pressure', 'flow_rate',
            'energy_consumption', 'co2_concentration'
        ]

    # Check required fields
    for field in required_fields:
        if field not in sensor_data:
            errors.append(f"Missing required field: {field}")
        elif sensor_data[field] is None:
            errors.append(f"Required field is null: {field}")

    # Validate data types and ranges
    validations = {
        'temperature': {'type': (int, float), 'range': (-50, 100)},
        'pressure': {'type': (int, float), 'range': (0, 200)},
        'flow_rate': {'type': (int, float), 'range': (0, 2000)},
        'humidity': {'type': (int, float), 'range': (0, 100)},
        'energy_consumption': {'type': (int, float), 'range': (0, 10000)},
        'co2_concentration': {'type': (int, float), 'range': (0, 2000)},
        'unit_age_days': {'type': (int, float), 'range': (0, 10000)},
        'maintenance_days_since': {'type': (int, float), 'range': (0, 10000)},
        'efficiency_current': {'type': (int, float), 'range': (0, 100)},
        'vibration': {'type': (int, float), 'range': (0, 10)},
        'motor_current': {'type': (int, float), 'range': (0, 50)},
        'bearing_temp': {'type': (int, float), 'range': (-20, 150)}
    }

    for field, config in validations.items():
        if field in sensor_data and sensor_data[field] is not None:
            value = sensor_data[field]

            # Type validation
            if not isinstance(value, config['type']):
                errors.append(f"Invalid type for {field}: expected {config['type']}, got {type(value)}")

            # Range validation
            elif isinstance(value, (int, float)):
                min_val, max_val = config['range']
                if not (min_val <= value <= max_val):
                    warnings.append(f"Value for {field} outside typical range: {value} (expected {min_val}-{max_val})")

    # Cross-field validations
    if 'temperature' in sensor_data and 'humidity' in sensor_data:
        temp = sensor_data['temperature']
        humidity = sensor_data['humidity']

        # Check for physically impossible combinations
        if temp < 0 and humidity > 50:
            warnings.append("High humidity with sub-zero temperature may indicate sensor issues")

    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }

def clean_sensor_data(sensor_data: Dict[str, Any],
                     imputation_strategy: str = 'mean') -> Dict[str, Any]:
    """
    Clean and preprocess sensor data.

    Args:
        sensor_data: Raw sensor data
        imputation_strategy: Strategy for missing value imputation

    Returns:
        Cleaned sensor data
    """
    cleaned_data = sensor_data.copy()

    # Handle missing values
    numeric_fields = [
        'temperature', 'pressure', 'flow_rate', 'humidity',
        'energy_consumption', 'co2_concentration', 'unit_age_days',
        'maintenance_days_since', 'efficiency_current', 'vibration',
        'motor_current', 'bearing_temp'
    ]

    # Simple imputation with field averages (in real implementation, use historical data)
    field_defaults = {
        'temperature': 25.0,
        'pressure': 50.0,
        'flow_rate': 1000.0,
        'humidity': 60.0,
        'energy_consumption': 800.0,
        'co2_concentration': 400.0,
        'unit_age_days': 365.0,
        'maintenance_days_since': 90.0,
        'efficiency_current': 80.0,
        'vibration': 1.0,
        'motor_current': 15.0,
        'bearing_temp': 40.0
    }

    for field in numeric_fields:
        if field not in cleaned_data or cleaned_data[field] is None:
            cleaned_data[field] = field_defaults.get(field, 0)

    # Handle outliers using IQR method
    for field in numeric_fields:
        if field in cleaned_data:
            value = cleaned_data[field]
            field_mean = field_defaults[field]
            field_std = field_defaults[field] * 0.2  # Assume 20% standard deviation

            # Simple outlier detection
            lower_bound = field_mean - 3 * field_std
            upper_bound = field_mean + 3 * field_std

            if not (lower_bound <= value <= upper_bound):
                cleaned_data[field] = field_mean  # Replace with mean
                cleaned_data[f'{field}_was_outlier'] = True

    # Add derived features
    cleaned_data = add_derived_features(cleaned_data)

    return cleaned_data

def add_derived_features(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add derived features to sensor data.

    Args:
        sensor_data: Sensor data dictionary

    Returns:
        Sensor data with derived features
    """
    enhanced_data = sensor_data.copy()

    try:
        # Energy efficiency ratio
        if 'energy_consumption' in enhanced_data and 'co2_concentration' in enhanced_data:
            energy_consumption = enhanced_data['energy_consumption']
            co2_concentration = enhanced_data['co2_concentration']
            enhanced_data['energy_efficiency_ratio'] = energy_consumption / (co2_concentration + 1)

        # Temperature-humidity index
        if 'temperature' in enhanced_data and 'humidity' in enhanced_data:
            temp = enhanced_data['temperature']
            humidity = enhanced_data['humidity']
            enhanced_data['temp_humidity_index'] = temp * (humidity / 100)

        # Flow rate efficiency
        if 'flow_rate' in enhanced_data and 'pressure' in enhanced_data:
            flow_rate = enhanced_data['flow_rate']
            pressure = enhanced_data['pressure']
            enhanced_data['flow_pressure_ratio'] = flow_rate / (pressure + 1)

        # Maintenance urgency score
        if 'unit_age_days' in enhanced_data and 'maintenance_days_since' in enhanced_data:
            unit_age = enhanced_data['unit_age_days']
            days_since_maintenance = enhanced_data['maintenance_days_since']
            enhanced_data['maintenance_urgency'] = unit_age / (days_since_maintenance + 1)

        # Operational efficiency index
        if 'efficiency_current' in enhanced_data and 'energy_consumption' in enhanced_data:
            efficiency = enhanced_data['efficiency_current']
            energy = enhanced_data['energy_consumption']
            enhanced_data['operational_efficiency_index'] = efficiency / (energy + 1) * 100

    except Exception as e:
        # Log warning but don't fail
        logging.getLogger(__name__).warning(f"Error adding derived features: {e}")

    return enhanced_data

def calculate_efficiency_metrics(current_efficiency: float,
                               predicted_efficiency: float,
                               energy_consumption: float) -> Dict[str, float]:
    """
    Calculate efficiency-related metrics.

    Args:
        current_efficiency: Current efficiency percentage
        predicted_efficiency: Predicted efficiency percentage
        energy_consumption: Current energy consumption

    Returns:
        Dictionary of efficiency metrics
    """
    metrics = {}

    # Efficiency difference
    metrics['efficiency_difference'] = predicted_efficiency - current_efficiency
    metrics['efficiency_difference_percent'] = (metrics['efficiency_difference'] / current_efficiency) * 100

    # Energy efficiency per unit efficiency
    metrics['energy_per_efficiency_unit'] = energy_consumption / (current_efficiency + 1)

    # Efficiency trend (simplified)
    metrics['efficiency_trend'] = 'improving' if predicted_efficiency > current_efficiency else 'declining'

    # Efficiency category
    if current_efficiency >= 90:
        metrics['efficiency_category'] = 'excellent'
    elif current_efficiency >= 80:
        metrics['efficiency_category'] = 'good'
    elif current_efficiency >= 70:
        metrics['efficiency_category'] = 'fair'
    else:
        metrics['efficiency_category'] = 'poor'

    return metrics

def calculate_maintenance_priority(maintenance_score: float,
                                 unit_age_days: int,
                                 days_since_maintenance: int) -> Dict[str, Any]:
    """
    Calculate maintenance priority based on various factors.

    Args:
        maintenance_score: Maintenance risk score (0-1)
        unit_age_days: Age of unit in days
        days_since_maintenance: Days since last maintenance

    Returns:
        Maintenance priority information
    """
    priority_score = 0

    # Base priority from maintenance score
    priority_score += maintenance_score * 40

    # Age factor
    if unit_age_days > 2000:  # Over ~5.5 years
        priority_score += 25
    elif unit_age_days > 1000:  # Over ~2.7 years
        priority_score += 15

    # Time since maintenance factor
    if days_since_maintenance > 365:  # Over a year
        priority_score += 20
    elif days_since_maintenance > 180:  # Over 6 months
        priority_score += 10

    # Determine priority level
    if priority_score >= 60:
        priority_level = 'critical'
        recommended_action = 'Schedule immediate maintenance'
        timeframe_days = 7
    elif priority_score >= 40:
        priority_level = 'high'
        recommended_action = 'Schedule maintenance within 30 days'
        timeframe_days = 30
    elif priority_score >= 20:
        priority_level = 'medium'
        recommended_action = 'Schedule maintenance within 90 days'
        timeframe_days = 90
    else:
        priority_level = 'low'
        recommended_action = 'Continue regular monitoring'
        timeframe_days = 180

    return {
        'priority_score': priority_score,
        'priority_level': priority_level,
        'recommended_action': recommended_action,
        'timeframe_days': timeframe_days,
        'next_maintenance_date': (datetime.now() + timedelta(days=timeframe_days)).isoformat()
    }

def format_optimization_recommendations(recommendations: List[Dict[str, Any]]) -> str:
    """
    Format optimization recommendations for display.

    Args:
        recommendations: List of recommendation dictionaries

    Returns:
        Formatted string representation
    """
    if not recommendations:
        return "No optimization recommendations available."

    formatted = []
    formatted.append("🔧 OPTIMIZATION RECOMMENDATIONS")
    formatted.append("=" * 50)

    for i, rec in enumerate(recommendations, 1):
        formatted.append(f"\n{i}. {rec['title']}")
        formatted.append(f"   Category: {rec['category'].title()}")
        formatted.append(f"   Impact: Efficiency +{rec['impact'].get('efficiency_gain', 0):.1f}%, "
                        f"Energy -{rec['impact'].get('energy_savings', 0):.0f} kWh")
        formatted.append(f"   Difficulty: {rec['difficulty'].title()}")
        formatted.append(f"   Implementation Time: {rec['time_to_implement']} hours")

        if rec.get('cost', 0) > 0:
            formatted.append(f"   Estimated Cost: ${rec['cost']:,.0f}")

        formatted.append(f"   Risk Level: {rec['risk_level'].title()}")
        formatted.append(f"   Description: {rec['description']}")

    return "\n".join(formatted)

def save_results_to_file(results: Dict[str, Any],
                        filename: str,
                        output_dir: str = 'results') -> str:
    """
    Save results to a JSON file.

    Args:
        results: Results dictionary
        filename: Filename (without extension)
        output_dir: Output directory

    Returns:
        Path to saved file
    """
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Add timestamp to filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    full_filename = f"{filename}_{timestamp}.json"
    filepath = os.path.join(output_dir, full_filename)

    # Save to file
    with open(filepath, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    return filepath

def load_config(config_path: str) -> Dict[str, Any]:
    """
    Load configuration from JSON file.

    Args:
        config_path: Path to configuration file

    Returns:
        Configuration dictionary
    """
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config
    except FileNotFoundError:
        logging.getLogger(__name__).warning(f"Config file not found: {config_path}")
        return {}
    except json.JSONDecodeError as e:
        logging.getLogger(__name__).error(f"Invalid JSON in config file: {e}")
        return {}

def create_data_summary(sensor_data: Union[Dict[str, Any], List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Create statistical summary of sensor data.

    Args:
        sensor_data: Single sensor reading or list of readings

    Returns:
        Statistical summary
    """
    if isinstance(sensor_data, dict):
        # Single reading
        sensor_data = [sensor_data]

    if not sensor_data:
        return {'error': 'No data provided'}

    df = pd.DataFrame(sensor_data)

    # Select numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns

    summary = {
        'count': len(df),
        'timestamp_range': {
            'start': df.get('timestamp', pd.Series()).min(),
            'end': df.get('timestamp', pd.Series()).max()
        },
        'statistics': {}
    }

    # Calculate statistics for numeric columns
    for col in numeric_cols:
        summary['statistics'][col] = {
            'mean': float(df[col].mean()),
            'median': float(df[col].median()),
            'std': float(df[col].std()),
            'min': float(df[col].min()),
            'max': float(df[col].max()),
            'missing_count': int(df[col].isnull().sum())
        }

    return summary

def validate_unit_id(unit_id: str) -> bool:
    """
    Validate carbon capture unit ID format.

    Args:
        unit_id: Unit identifier to validate

    Returns:
        True if valid, False otherwise
    """
    import re

    # Pattern: CC- followed by 3 digits (e.g., CC-001)
    pattern = r'^CC-\d{3}$'

    return bool(re.match(pattern, unit_id))

def calculate_carbon_credits(efficiency_gain: float,
                           co2_captured_tons: float,
                           time_period_days: int = 30) -> Dict[str, Any]:
    """
    Calculate potential carbon credits from efficiency improvements.

    Args:
        efficiency_gain: Efficiency improvement percentage
        co2_captured_tons: Baseline CO2 captured per time period
        time_period_days: Time period for calculation

    Returns:
        Carbon credit calculation results
    """
    # Additional CO2 captured due to efficiency gain
    additional_co2 = co2_captured_tons * (efficiency_gain / 100)

    # Convert to annual equivalent
    annual_additional_co2 = additional_co2 * (365 / time_period_days)

    # Carbon credit value (simplified - actual rates vary by market)
    credit_value_per_ton = 25  # USD per ton CO2
    total_credit_value = annual_additional_co2 * credit_value_per_ton

    return {
        'additional_co2_captured_tons': additional_co2,
        'annual_additional_co2_tons': annual_additional_co2,
        'estimated_credit_value_usd': total_credit_value,
        'credit_value_per_ton_usd': credit_value_per_ton,
        'calculation_period_days': time_period_days
    }

def generate_alert_message(alert_type: str,
                          severity: str,
                          message: str,
                          unit_id: str,
                          recommendations: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Generate standardized alert message.

    Args:
        alert_type: Type of alert (maintenance, efficiency, safety)
        severity: Alert severity (low, medium, high, critical)
        message: Alert message
        unit_id: Unit identifier
        recommendations: List of recommended actions

    Returns:
        Standardized alert dictionary
    """
    severity_levels = {
        'low': 1,
        'medium': 2,
        'high': 3,
        'critical': 4
    }

    alert = {
        'alert_id': f"{alert_type.upper()}_{unit_id}_{int(datetime.now().timestamp())}",
        'alert_type': alert_type,
        'severity': severity,
        'severity_level': severity_levels.get(severity, 1),
        'message': message,
        'unit_id': unit_id,
        'timestamp': datetime.now().isoformat(),
        'acknowledged': False,
        'resolved': False
    }

    if recommendations:
        alert['recommendations'] = recommendations

    return alert

# Example usage and testing
if __name__ == '__main__':
    # Test the utility functions
    logger = setup_logging('utils_test', 'INFO')

    # Test sensor data validation
    test_sensor_data = {
        'temperature': 75.5,
        'pressure': 45.2,
        'flow_rate': 1200.5,
        'energy_consumption': 850.2,
        'co2_concentration': 412.8
    }

    validation = validate_sensor_data(test_sensor_data)
    logger.info(f"Validation result: {validation}")

    # Test data cleaning
    cleaned_data = clean_sensor_data(test_sensor_data)
    logger.info(f"Cleaned data: {cleaned_data}")

    # Test efficiency metrics
    metrics = calculate_efficiency_metrics(82.5, 87.2, 850.2)
    logger.info(f"Efficiency metrics: {metrics}")

    # Test maintenance priority
    maintenance_priority = calculate_maintenance_priority(0.75, 500, 60)
    logger.info(f"Maintenance priority: {maintenance_priority}")

    # Test carbon credits calculation
    credits = calculate_carbon_credits(5.0, 100, 30)
    logger.info(f"Carbon credits: {credits}")

    logger.info("Utility functions test completed")
