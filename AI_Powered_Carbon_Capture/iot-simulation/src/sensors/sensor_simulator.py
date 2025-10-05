#!/usr/bin/env python3
"""
Sensor Simulator for Carbon Capture IoT Network

This module simulates various sensors used in carbon capture units,
generating realistic sensor data with noise and occasional anomalies.
"""

import sys
import os
import json
import logging
import time
import random
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
import numpy as np
import requests

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from iot_simulation.src.protocols.mqtt_protocol import MQTTProtocol

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SensorSimulator:
    """
    Base class for simulating various types of sensors in carbon capture units.
    """

    def __init__(self,
                 sensor_id: str,
                 sensor_type: str,
                 unit_id: str,
                 config: Dict[str, Any] = None):
        """
        Initialize sensor simulator.

        Args:
            sensor_id: Unique sensor identifier
            sensor_type: Type of sensor (temperature, pressure, etc.)
            unit_id: Associated unit identifier
            config: Sensor configuration parameters
        """
        self.sensor_id = sensor_id
        self.sensor_type = sensor_type
        self.unit_id = unit_id
        self.config = config or self._get_default_config()

        # Sensor state
        self.is_active = True
        self.last_reading = None
        self.last_reading_time = None
        self.reading_count = 0

        # Error simulation
        self.error_probability = self.config.get('error_probability', 0.01)
        self.calibration_drift = 0.0

        # Communication
        self.mqtt_client = None
        self.backend_url = self.config.get('backend_url', 'http://localhost:8000')

        # Sensor-specific parameters
        self._initialize_sensor_parameters()

        logger.info(f"Initialized {sensor_type} sensor {sensor_id} for unit {unit_id}")

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration for sensor."""
        return {
            'update_interval': 30,  # seconds
            'backend_url': 'http://localhost:8000',
            'mqtt_broker': 'localhost',
            'mqtt_port': 1883,
            'error_probability': 0.01,
            'calibration_interval': 86400,  # 24 hours
            'data_quality': 0.95
        }

    def _initialize_sensor_parameters(self):
        """Initialize sensor-specific parameters."""
        # Base parameters - will be overridden by subclasses
        self.nominal_value = 25.0
        self.noise_level = 0.5
        self.drift_rate = 0.001
        self.unit = 'unknown'

    def generate_reading(self) -> Dict[str, Any]:
        """
        Generate a sensor reading with realistic noise and potential anomalies.

        Returns:
            Sensor reading data
        """
        try:
            # Base value with drift
            base_value = self.nominal_value + self.calibration_drift

            # Add noise
            noise = np.random.normal(0, self.noise_level)
            raw_value = base_value + noise

            # Simulate occasional anomalies
            if random.random() < self.error_probability:
                raw_value = self._generate_anomaly(raw_value)

            # Ensure value is within realistic bounds
            raw_value = self._clamp_value(raw_value)

            # Update calibration drift
            self.calibration_drift += np.random.normal(0, self.drift_rate)

            reading = {
                'sensor_id': self.sensor_id,
                'sensor_type': self.sensor_type,
                'unit_id': self.unit_id,
                'value': round(raw_value, 3),
                'unit': self.unit,
                'timestamp': datetime.now().isoformat(),
                'quality': self._calculate_data_quality(),
                'metadata': {
                    'reading_number': self.reading_count + 1,
                    'calibration_drift': round(self.calibration_drift, 4),
                    'is_anomaly': abs(raw_value - self.nominal_value) > self.noise_level * 3
                }
            }

            self.last_reading = reading
            self.last_reading_time = datetime.now()
            self.reading_count += 1

            return reading

        except Exception as e:
            logger.error(f"Error generating reading for sensor {self.sensor_id}: {e}")
            return None

    def _generate_anomaly(self, value: float) -> float:
        """Generate anomalous sensor readings."""
        anomaly_types = ['spike', 'drift', 'noise_burst', 'stuck_value']
        anomaly_type = random.choice(anomaly_types)

        if anomaly_type == 'spike':
            # Sudden spike or drop
            return value + random.choice([-1, 1]) * random.uniform(5, 15)
        elif anomaly_type == 'drift':
            # Gradual drift
            return value + random.uniform(-3, 3)
        elif anomaly_type == 'noise_burst':
            # High noise
            return value + np.random.normal(0, self.noise_level * 5)
        elif anomaly_type == 'stuck_value':
            # Stuck at last value
            return self.last_reading['value'] if self.last_reading else value

        return value

    def _clamp_value(self, value: float) -> float:
        """Clamp value to realistic sensor bounds."""
        # Default bounds - should be overridden by subclasses
        min_val = self.config.get('min_value', -1000)
        max_val = self.config.get('max_value', 1000)
        return max(min_val, min(max_val, value))

    def _calculate_data_quality(self) -> str:
        """Calculate data quality indicator."""
        if random.random() > self.config['data_quality']:
            return 'poor'
        elif random.random() > 0.9:
            return 'fair'
        else:
            return 'good'

    def send_to_backend(self, reading: Dict[str, Any]) -> bool:
        """
        Send sensor reading to backend API.

        Args:
            reading: Sensor reading data

        Returns:
            Success status
        """
        try:
            url = f"{self.backend_url}/api/sensors/{self.sensor_id}/readings"
            headers = {
                'Content-Type': 'application/json',
                'X-API-Key': self.config.get('api_key', 'sensor-api-key')
            }

            response = requests.post(url, json={
                'value': reading['value'],
                'quality': reading['quality'],
                'timestamp': reading['timestamp']
            }, headers=headers, timeout=10)

            if response.status_code == 200:
                logger.debug(f"Successfully sent reading for sensor {self.sensor_id}")
                return True
            else:
                logger.warning(f"Failed to send reading for sensor {self.sensor_id}: {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Error sending reading to backend for sensor {self.sensor_id}: {e}")
            return False

    def publish_to_mqtt(self, reading: Dict[str, Any]) -> bool:
        """
        Publish sensor reading to MQTT broker.

        Args:
            reading: Sensor reading data

        Returns:
            Success status
        """
        if not self.mqtt_client:
            return False

        try:
            topic = f"sensors/{self.unit_id}/{self.sensor_type}/{self.sensor_id}"
            payload = json.dumps(reading)

            self.mqtt_client.publish(topic, payload)
            logger.debug(f"Published reading to MQTT topic {topic}")
            return True

        except Exception as e:
            logger.error(f"Error publishing to MQTT for sensor {self.sensor_id}: {e}")
            return False

    def start_simulation(self):
        """Start the sensor simulation loop."""
        logger.info(f"Starting simulation for sensor {self.sensor_id}")

        # Initialize MQTT client if configured
        if self.config.get('use_mqtt', False):
            self.mqtt_client = MQTTProtocol(
                broker=self.config['mqtt_broker'],
                port=self.config['mqtt_port'],
                client_id=f"sensor_{self.sensor_id}"
            )

        def simulation_loop():
            while self.is_active:
                try:
                    # Generate reading
                    reading = self.generate_reading()

                    if reading:
                        # Send to backend
                        if not self.send_to_backend(reading):
                            logger.warning(f"Failed to send reading to backend for sensor {self.sensor_id}")

                        # Publish to MQTT
                        if self.mqtt_client:
                            self.publish_to_mqtt(reading)

                    # Wait for next reading
                    time.sleep(self.config['update_interval'])

                except Exception as e:
                    logger.error(f"Error in simulation loop for sensor {self.sensor_id}: {e}")
                    time.sleep(5)  # Brief pause before retry

        # Start simulation thread
        self.simulation_thread = threading.Thread(target=simulation_loop, daemon=True)
        self.simulation_thread.start()

    def stop_simulation(self):
        """Stop the sensor simulation."""
        logger.info(f"Stopping simulation for sensor {self.sensor_id}")
        self.is_active = False

        if self.mqtt_client:
            self.mqtt_client.disconnect()

class TemperatureSensor(SensorSimulator):
    """Temperature sensor simulator."""

    def _initialize_sensor_parameters(self):
        self.nominal_value = 25.0  # °C
        self.noise_level = 0.5
        self.drift_rate = 0.001
        self.unit = 'celsius'
        self.config.update({
            'min_value': -10,
            'max_value': 60
        })

class PressureSensor(SensorSimulator):
    """Pressure sensor simulator."""

    def _initialize_sensor_parameters(self):
        self.nominal_value = 45.0  # psi
        self.noise_level = 1.0
        self.drift_rate = 0.002
        self.unit = 'psi'
        self.config.update({
            'min_value': 30,
            'max_value': 80
        })

class FlowRateSensor(SensorSimulator):
    """Flow rate sensor simulator."""

    def _initialize_sensor_parameters(self):
        self.nominal_value = 1200.0  # L/min
        self.noise_level = 20.0
        self.drift_rate = 0.005
        self.unit = 'l_min'
        self.config.update({
            'min_value': 500,
            'max_value': 2000
        })

class CO2ConcentrationSensor(SensorSimulator):
    """CO2 concentration sensor simulator."""

    def _initialize_sensor_parameters(self):
        self.nominal_value = 420.0  # ppm
        self.noise_level = 5.0
        self.drift_rate = 0.001
        self.unit = 'ppm'
        self.config.update({
            'min_value': 300,
            'max_value': 1000
        })

class EnergyConsumptionSensor(SensorSimulator):
    """Energy consumption sensor simulator."""

    def _initialize_sensor_parameters(self):
        self.nominal_value = 850.0  # kW
        self.noise_level = 15.0
        self.drift_rate = 0.003
        self.unit = 'kw'
        self.config.update({
            'min_value': 0,
            'max_value': 5000
        })

class HumiditySensor(SensorSimulator):
    """Humidity sensor simulator."""

    def _initialize_sensor_parameters(self):
        self.nominal_value = 65.0  # %
        self.noise_level = 2.0
        self.drift_rate = 0.001
        self.unit = 'percent'
        self.config.update({
            'min_value': 0,
            'max_value': 100
        })

class VibrationSensor(SensorSimulator):
    """Vibration sensor simulator."""

    def _initialize_sensor_parameters(self):
        self.nominal_value = 0.8  # mm/s
        self.noise_level = 0.1
        self.drift_rate = 0.0005
        self.unit = 'mm_s'
        self.config.update({
            'min_value': 0,
            'max_value': 5
        })

class MotorCurrentSensor(SensorSimulator):
    """Motor current sensor simulator."""

    def _initialize_sensor_parameters(self):
        self.nominal_value = 12.0  # A
        self.noise_level = 0.5
        self.drift_rate = 0.001
        self.unit = 'ampere'
        self.config.update({
            'min_value': 8,
            'max_value': 20
        })

# Sensor factory function
def create_sensor(sensor_type: str, sensor_id: str, unit_id: str, config: Dict[str, Any] = None) -> SensorSimulator:
    """
    Factory function to create sensor instances.

    Args:
        sensor_type: Type of sensor to create
        sensor_id: Unique sensor identifier
        unit_id: Associated unit identifier
        config: Sensor configuration

    Returns:
        Sensor simulator instance
    """
    sensor_classes = {
        'temperature': TemperatureSensor,
        'pressure': PressureSensor,
        'flow_rate': FlowRateSensor,
        'co2_concentration': CO2ConcentrationSensor,
        'energy_consumption': EnergyConsumptionSensor,
        'humidity': HumiditySensor,
        'vibration': VibrationSensor,
        'motor_current': MotorCurrentSensor
    }

    sensor_class = sensor_classes.get(sensor_type)
    if not sensor_class:
        raise ValueError(f"Unknown sensor type: {sensor_type}")

    return sensor_class(sensor_id, sensor_type, unit_id, config)

# Example usage
if __name__ == '__main__':
    # Create a temperature sensor
    sensor = create_sensor('temperature', 'TEMP-001', 'CC-001', {
        'update_interval': 10,
        'backend_url': 'http://localhost:8000',
        'use_mqtt': False
    })

    # Start simulation
    sensor.start_simulation()

    try:
        # Run for 60 seconds
        time.sleep(60)
    except KeyboardInterrupt:
        pass
    finally:
        sensor.stop_simulation()
        print("Sensor simulation stopped")