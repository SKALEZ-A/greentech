#!/usr/bin/env python3
"""
IoT Gateway for Carbon Capture Network

This module provides an IoT gateway that collects data from sensors,
processes it, and forwards it to the backend system.
"""

import sys
import os
import json
import logging
import time
import threading
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
import requests
from concurrent.futures import ThreadPoolExecutor

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from iot_simulation.src.protocols.mqtt_protocol import MQTTProtocol, MQTTManager
from iot_simulation.src.sensors.sensor_simulator import create_sensor, SensorSimulator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class IoTGateway:
    """
    IoT Gateway for managing sensor data collection and transmission.
    """

    def __init__(self,
                 gateway_id: str,
                 backend_url: str = 'http://localhost:8000',
                 mqtt_config: Dict[str, Any] = None):
        """
        Initialize IoT gateway.

        Args:
            gateway_id: Unique gateway identifier
            backend_url: Backend API URL
            mqtt_config: MQTT configuration
        """
        self.gateway_id = gateway_id
        self.backend_url = backend_url
        self.mqtt_config = mqtt_config or {
            'broker': 'localhost',
            'port': 1883,
            'use_tls': False
        }

        # Components
        self.mqtt_manager = MQTTManager()
        self.sensors = {}
        self.units = {}
        self.executor = ThreadPoolExecutor(max_workers=10)

        # Data processing
        self.data_buffer = {}
        self.buffer_size = 100
        self.flush_interval = 30  # seconds

        # Status
        self.is_running = False
        self.last_health_check = datetime.now()

        # Configuration
        self.config = {
            'batch_size': 50,
            'retry_attempts': 3,
            'retry_delay': 1.0,
            'health_check_interval': 60
        }

        # Initialize MQTT clients
        self._initialize_mqtt_clients()

        logger.info(f"Initialized IoT Gateway {gateway_id}")

    def _initialize_mqtt_clients(self):
        """Initialize MQTT clients for different purposes."""
        # Sensor data client
        sensor_client = MQTTProtocol(
            broker=self.mqtt_config['broker'],
            port=self.mqtt_config['port'],
            client_id=f"gateway_{self.gateway_id}_sensors",
            use_tls=self.mqtt_config.get('use_tls', False)
        )

        # Command client
        command_client = MQTTProtocol(
            broker=self.mqtt_config['broker'],
            port=self.mqtt_config['port'],
            client_id=f"gateway_{self.gateway_id}_commands",
            use_tls=self.mqtt_config.get('use_tls', False)
        )

        # Status client
        status_client = MQTTProtocol(
            broker=self.mqtt_config['broker'],
            port=self.mqtt_config['port'],
            client_id=f"gateway_{self.gateway_id}_status",
            use_tls=self.mqtt_config.get('use_tls', False)
        )

        # Add to manager
        self.mqtt_manager.add_client('sensors', sensor_client)
        self.mqtt_manager.add_client('commands', command_client)
        self.mqtt_manager.add_client('status', status_client)

        # Set up topic handlers
        self._setup_topic_handlers()

    def _setup_topic_handlers(self):
        """Setup MQTT topic handlers."""
        # Handle sensor data
        self.mqtt_manager.add_topic_handler('sensors/#', self._handle_sensor_data)

        # Handle commands
        self.mqtt_manager.add_topic_handler('commands/#', self._handle_commands)

        # Handle status requests
        self.mqtt_manager.add_topic_handler('status/#', self._handle_status_requests)

    def _handle_sensor_data(self, client_name: str, message: Dict[str, Any]):
        """Handle incoming sensor data."""
        try:
            topic_parts = message['topic'].split('/')
            if len(topic_parts) >= 4:
                unit_id = topic_parts[1]
                sensor_type = topic_parts[2]
                sensor_id = topic_parts[3]

                sensor_data = message['payload']

                # Validate sensor data
                if self._validate_sensor_data(sensor_data):
                    # Buffer data for batch processing
                    self._buffer_sensor_data(unit_id, sensor_id, sensor_data)

                    logger.debug(f"Received sensor data: {sensor_id} = {sensor_data.get('value')}")
                else:
                    logger.warning(f"Invalid sensor data received: {sensor_data}")

        except Exception as e:
            logger.error(f"Error handling sensor data: {e}")

    def _handle_commands(self, client_name: str, message: Dict[str, Any]):
        """Handle incoming commands."""
        try:
            topic_parts = message['topic'].split('/')
            unit_id = topic_parts[1]

            command = message['payload']

            logger.info(f"Received command for unit {unit_id}: {command}")

            # Process command
            self._process_command(unit_id, command)

        except Exception as e:
            logger.error(f"Error handling command: {e}")

    def _handle_status_requests(self, client_name: str, message: Dict[str, Any]):
        """Handle status requests."""
        try:
            topic_parts = message['topic'].split('/')
            unit_id = topic_parts[1]

            # Send status update
            self._send_status_update(unit_id)

        except Exception as e:
            logger.error(f"Error handling status request: {e}")

    def _validate_sensor_data(self, data: Dict[str, Any]) -> bool:
        """Validate sensor data structure."""
        required_fields = ['sensor_id', 'value', 'timestamp']

        for field in required_fields:
            if field not in data:
                return False

        # Check value is numeric
        if not isinstance(data['value'], (int, float)):
            return False

        return True

    def _buffer_sensor_data(self, unit_id: str, sensor_id: str, data: Dict[str, Any]):
        """Buffer sensor data for batch processing."""
        if unit_id not in self.data_buffer:
            self.data_buffer[unit_id] = {}

        if sensor_id not in self.data_buffer[unit_id]:
            self.data_buffer[unit_id][sensor_id] = []

        # Add data to buffer
        self.data_buffer[unit_id][sensor_id].append(data)

        # Check if buffer should be flushed
        total_readings = sum(len(readings) for readings in self.data_buffer[unit_id].values())
        if total_readings >= self.buffer_size:
            self._flush_buffer(unit_id)

    def _flush_buffer(self, unit_id: str):
        """Flush buffered data to backend."""
        if unit_id not in self.data_buffer:
            return

        unit_data = self.data_buffer[unit_id]

        # Process each sensor's data
        for sensor_id, readings in unit_data.items():
            if readings:
                success = self._send_sensor_readings(sensor_id, readings)
                if success:
                    # Clear processed readings
                    unit_data[sensor_id] = []
                else:
                    logger.warning(f"Failed to send readings for sensor {sensor_id}")

        # Clean up empty buffers
        self.data_buffer[unit_id] = {
            sensor_id: readings
            for sensor_id, readings in self.data_buffer[unit_id].items()
            if readings
        }

        if not self.data_buffer[unit_id]:
            del self.data_buffer[unit_id]

    def _send_sensor_readings(self, sensor_id: str, readings: List[Dict[str, Any]]) -> bool:
        """Send sensor readings to backend."""
        try:
            # Group readings for batch processing
            for reading in readings:
                success = self._send_single_reading(sensor_id, reading)
                if not success:
                    return False
                time.sleep(0.1)  # Small delay to avoid overwhelming the backend

            return True

        except Exception as e:
            logger.error(f"Error sending sensor readings: {e}")
            return False

    def _send_single_reading(self, sensor_id: str, reading: Dict[str, Any]) -> bool:
        """Send single sensor reading to backend."""
        try:
            url = f"{self.backend_url}/api/sensors/{sensor_id}/readings"
            headers = {
                'Content-Type': 'application/json',
                'X-API-Key': f"gateway_{self.gateway_id}"
            }

            payload = {
                'value': reading['value'],
                'quality': reading.get('quality', 'good'),
                'timestamp': reading.get('timestamp')
            }

            response = requests.post(url, json=payload, headers=headers, timeout=10)

            return response.status_code == 200

        except Exception as e:
            logger.error(f"Error sending reading for sensor {sensor_id}: {e}")
            return False

    def _process_command(self, unit_id: str, command: Dict[str, Any]):
        """Process incoming command."""
        command_type = command.get('type')

        if command_type == 'restart_sensor':
            sensor_id = command.get('sensor_id')
            self._restart_sensor(unit_id, sensor_id)
        elif command_type == 'calibrate_sensor':
            sensor_id = command.get('sensor_id')
            self._calibrate_sensor(unit_id, sensor_id, command.get('parameters', {}))
        elif command_type == 'update_config':
            self._update_configuration(command.get('config', {}))
        elif command_type == 'shutdown':
            self._shutdown_unit(unit_id)
        else:
            logger.warning(f"Unknown command type: {command_type}")

    def _restart_sensor(self, unit_id: str, sensor_id: str):
        """Restart a sensor."""
        logger.info(f"Restarting sensor {sensor_id} in unit {unit_id}")

        # In a real implementation, this would send commands to the physical sensor
        # For simulation, we'll just log and send confirmation
        self._send_command_response(unit_id, {
            'type': 'sensor_restarted',
            'sensor_id': sensor_id,
            'timestamp': datetime.now().isoformat()
        })

    def _calibrate_sensor(self, unit_id: str, sensor_id: str, parameters: Dict[str, Any]):
        """Calibrate a sensor."""
        logger.info(f"Calibrating sensor {sensor_id} in unit {unit_id}")

        # Send calibration command response
        self._send_command_response(unit_id, {
            'type': 'sensor_calibrated',
            'sensor_id': sensor_id,
            'parameters': parameters,
            'timestamp': datetime.now().isoformat()
        })

    def _update_configuration(self, config: Dict[str, Any]):
        """Update gateway configuration."""
        logger.info("Updating gateway configuration")

        # Update configuration
        self.config.update(config)

        # Send confirmation
        self.mqtt_manager.publish_to_all('status/gateway', {
            'gateway_id': self.gateway_id,
            'status': 'config_updated',
            'config': self.config,
            'timestamp': datetime.now().isoformat()
        })

    def _shutdown_unit(self, unit_id: str):
        """Shutdown a unit."""
        logger.info(f"Shutting down unit {unit_id}")

        # Stop all sensors for this unit
        unit_sensors = [s for s in self.sensors.values() if s.unit_id == unit_id]
        for sensor in unit_sensors:
            sensor.stop_simulation()

        # Send shutdown confirmation
        self._send_command_response(unit_id, {
            'type': 'unit_shutdown',
            'timestamp': datetime.now().isoformat()
        })

    def _send_command_response(self, unit_id: str, response: Dict[str, Any]):
        """Send command response via MQTT."""
        topic = f"responses/{unit_id}"
        self.mqtt_manager.publish_to_all(topic, {
            'gateway_id': self.gateway_id,
            **response
        })

    def _send_status_update(self, unit_id: str = None):
        """Send status update."""
        status = self.get_status()

        if unit_id:
            topic = f"status/{unit_id}"
        else:
            topic = f"status/gateway/{self.gateway_id}"

        self.mqtt_manager.publish_to_all(topic, status)

    def add_sensor(self, sensor_type: str, sensor_id: str, unit_id: str, config: Dict[str, Any] = None):
        """
        Add a sensor to the gateway.

        Args:
            sensor_type: Type of sensor
            sensor_id: Sensor identifier
            unit_id: Unit identifier
            config: Sensor configuration
        """
        sensor_config = config or {}
        sensor_config.update({
            'backend_url': self.backend_url,
            'use_mqtt': True,
            'mqtt_broker': self.mqtt_config['broker'],
            'mqtt_port': self.mqtt_config['port']
        })

        sensor = create_sensor(sensor_type, sensor_id, unit_id, sensor_config)
        self.sensors[sensor_id] = sensor

        # Add to unit tracking
        if unit_id not in self.units:
            self.units[unit_id] = []
        self.units[unit_id].append(sensor_id)

        logger.info(f"Added sensor {sensor_id} to gateway")

    def remove_sensor(self, sensor_id: str):
        """Remove a sensor from the gateway."""
        if sensor_id in self.sensors:
            sensor = self.sensors[sensor_id]
            sensor.stop_simulation()
            del self.sensors[sensor_id]

            # Remove from unit tracking
            for unit_id, sensor_ids in self.units.items():
                if sensor_id in sensor_ids:
                    sensor_ids.remove(sensor_id)
                    if not sensor_ids:
                        del self.units[unit_id]
                    break

            logger.info(f"Removed sensor {sensor_id} from gateway")

    def start(self):
        """Start the IoT gateway."""
        logger.info(f"Starting IoT Gateway {self.gateway_id}")

        self.is_running = True

        # Connect MQTT clients
        for client_name, client in self.mqtt_manager.clients.items():
            if not client.connect():
                logger.error(f"Failed to connect {client_name} MQTT client")
                return False

        # Start background tasks
        self._start_background_tasks()

        # Start sensors
        for sensor in self.sensors.values():
            sensor.start_simulation()

        logger.info("IoT Gateway started successfully")
        return True

    def stop(self):
        """Stop the IoT gateway."""
        logger.info(f"Stopping IoT Gateway {self.gateway_id}")

        self.is_running = False

        # Stop sensors
        for sensor in self.sensors.values():
            sensor.stop_simulation()

        # Disconnect MQTT clients
        for client in self.mqtt_manager.clients.values():
            client.disconnect()

        # Shutdown executor
        self.executor.shutdown(wait=True)

        logger.info("IoT Gateway stopped")

    def _start_background_tasks(self):
        """Start background maintenance tasks."""
        # Buffer flush task
        def flush_buffers():
            while self.is_running:
                for unit_id in list(self.data_buffer.keys()):
                    self._flush_buffer(unit_id)
                time.sleep(self.flush_interval)

        # Health check task
        def health_check():
            while self.is_running:
                self._perform_health_check()
                time.sleep(self.config['health_check_interval'])

        # Status update task
        def status_update():
            while self.is_running:
                self._send_status_update()
                time.sleep(300)  # Every 5 minutes

        # Start threads
        threading.Thread(target=flush_buffers, daemon=True).start()
        threading.Thread(target=health_check, daemon=True).start()
        threading.Thread(target=status_update, daemon=True).start()

    def _perform_health_check(self):
        """Perform health check."""
        try:
            # Check backend connectivity
            response = requests.get(f"{self.backend_url}/health", timeout=5)
            backend_healthy = response.status_code == 200

            # Check MQTT connectivity
            mqtt_healthy = all(client.is_connected for client in self.mqtt_manager.clients.values())

            # Check sensor health
            sensor_health = {}
            for sensor_id, sensor in self.sensors.items():
                health_score = sensor.getHealthScore() if hasattr(sensor, 'getHealthScore') else 85
                sensor_health[sensor_id] = health_score

            health_status = {
                'gateway_id': self.gateway_id,
                'timestamp': datetime.now().isoformat(),
                'backend_connected': backend_healthy,
                'mqtt_connected': mqtt_healthy,
                'active_sensors': len(self.sensors),
                'sensor_health': sensor_health,
                'buffered_readings': sum(
                    len(readings) for unit_data in self.data_buffer.values()
                    for readings in unit_data.values()
                )
            }

            self.last_health_check = datetime.now()

            # Log health issues
            if not backend_healthy:
                logger.warning("Backend health check failed")
            if not mqtt_healthy:
                logger.warning("MQTT connectivity issues detected")

        except Exception as e:
            logger.error(f"Health check failed: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Get gateway status."""
        return {
            'gateway_id': self.gateway_id,
            'is_running': self.is_running,
            'active_sensors': len(self.sensors),
            'units': list(self.units.keys()),
            'mqtt_status': self.mqtt_manager.get_status(),
            'buffer_status': {
                'units_buffered': len(self.data_buffer),
                'total_readings': sum(
                    len(readings) for unit_data in self.data_buffer.values()
                    for readings in unit_data.values()
                )
            },
            'last_health_check': self.last_health_check.isoformat(),
            'config': self.config
        }

    def get_sensor_status(self, sensor_id: str = None) -> Dict[str, Any]:
        """Get sensor status."""
        if sensor_id:
            sensor = self.sensors.get(sensor_id)
            if sensor:
                return {
                    'sensor_id': sensor_id,
                    'type': sensor.sensor_type,
                    'unit_id': sensor.unit_id,
                    'active': sensor.is_active,
                    'last_reading': sensor.last_reading_time.isoformat() if sensor.last_reading_time else None,
                    'reading_count': sensor.reading_count
                }
            else:
                return {'error': 'Sensor not found'}
        else:
            return {
                sensor_id: {
                    'type': sensor.sensor_type,
                    'unit_id': sensor.unit_id,
                    'active': sensor.is_active,
                    'last_reading': sensor.last_reading_time.isoformat() if sensor.last_reading_time else None,
                    'reading_count': sensor.reading_count
                }
                for sensor_id, sensor in self.sensors.items()
            }

# Example usage
if __name__ == '__main__':
    # Create gateway
    gateway = IoTGateway('GATEWAY-001')

    # Add some sensors
    gateway.add_sensor('temperature', 'TEMP-001', 'CC-001')
    gateway.add_sensor('pressure', 'PRESS-001', 'CC-001')
    gateway.add_sensor('co2_concentration', 'CO2-001', 'CC-001')

    try:
        # Start gateway
        if gateway.start():
            logger.info("Gateway started. Press Ctrl+C to stop.")

            # Keep running
            while True:
                time.sleep(10)

                # Print status
                status = gateway.get_status()
                logger.info(f"Gateway status: {status['active_sensors']} sensors active")

    except KeyboardInterrupt:
        logger.info("Stopping gateway...")
    finally:
        gateway.stop()