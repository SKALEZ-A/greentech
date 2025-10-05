#!/usr/bin/env python3
"""
Simulation Engine for Carbon Capture IoT Network

This module provides a comprehensive simulation engine that coordinates
multiple IoT gateways, sensors, and simulates realistic carbon capture
unit operations.
"""

import sys
import os
import json
import logging
import time
import threading
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
import numpy as np

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from iot_simulation.src.gateways.iot_gateway import IoTGateway
from iot_simulation.src.sensors.sensor_simulator import create_sensor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SimulationEngine:
    """
    Comprehensive simulation engine for carbon capture IoT network.
    """

    def __init__(self, config_file: str = None):
        """
        Initialize simulation engine.

        Args:
            config_file: Path to simulation configuration file
        """
        self.config = self._load_config(config_file)
        self.gateways = {}
        self.units = {}
        self.scenarios = {}
        self.is_running = False

        # Simulation state
        self.simulation_time = datetime.now()
        self.real_time_factor = self.config.get('real_time_factor', 1.0)
        self.scenario_active = None

        # Statistics
        self.stats = {
            'start_time': None,
            'end_time': None,
            'total_readings': 0,
            'active_gateways': 0,
            'active_sensors': 0,
            'scenarios_executed': 0
        }

        # Load scenarios
        self._load_scenarios()

        logger.info("Initialized Carbon Capture Simulation Engine")

    def _load_config(self, config_file: str = None) -> Dict[str, Any]:
        """Load simulation configuration."""
        default_config = {
            'gateways': [
                {
                    'id': 'GATEWAY-001',
                    'units': ['CC-001', 'CC-002'],
                    'mqtt_config': {
                        'broker': 'localhost',
                        'port': 1883
                    }
                }
            ],
            'units': {
                'CC-001': {
                    'name': 'Carbon Capture Unit 1',
                    'capacity': 100,  # tons CO2 per day
                    'sensors': [
                        {'type': 'temperature', 'count': 3},
                        {'type': 'pressure', 'count': 2},
                        {'type': 'flow_rate', 'count': 2},
                        {'type': 'co2_concentration', 'count': 2},
                        {'type': 'energy_consumption', 'count': 1}
                    ]
                },
                'CC-002': {
                    'name': 'Carbon Capture Unit 2',
                    'capacity': 150,
                    'sensors': [
                        {'type': 'temperature', 'count': 4},
                        {'type': 'pressure', 'count': 3},
                        {'type': 'flow_rate', 'count': 3},
                        {'type': 'co2_concentration', 'count': 2},
                        {'type': 'energy_consumption', 'count': 1},
                        {'type': 'humidity', 'count': 1}
                    ]
                }
            },
            'real_time_factor': 1.0,
            'backend_url': 'http://localhost:8000',
            'scenarios_file': 'config/simulation_config.json'
        }

        if config_file and os.path.exists(config_file):
            with open(config_file, 'r') as f:
                user_config = json.load(f)
            default_config.update(user_config)

        return default_config

    def _load_scenarios(self):
        """Load simulation scenarios."""
        scenarios_file = self.config.get('scenarios_file', 'config/simulation_config.json')

        if os.path.exists(scenarios_file):
            try:
                with open(scenarios_file, 'r') as f:
                    scenarios_data = json.load(f)
                self.scenarios = scenarios_data.get('scenarios', {})
                logger.info(f"Loaded {len(self.scenarios)} simulation scenarios")
            except Exception as e:
                logger.error(f"Error loading scenarios: {e}")
                self._create_default_scenarios()
        else:
            self._create_default_scenarios()

    def _create_default_scenarios(self):
        """Create default simulation scenarios."""
        self.scenarios = {
            'normal_operation': {
                'name': 'Normal Operation',
                'description': 'Standard carbon capture operation',
                'duration_minutes': 60,
                'sensor_anomalies': 0.01,
                'system_events': []
            },
            'maintenance_scenario': {
                'name': 'Scheduled Maintenance',
                'description': 'Unit undergoing scheduled maintenance',
                'duration_minutes': 30,
                'sensor_anomalies': 0.05,
                'system_events': [
                    {'time': 5, 'type': 'maintenance_start', 'description': 'Maintenance window opened'},
                    {'time': 25, 'type': 'maintenance_end', 'description': 'Maintenance completed'}
                ]
            },
            'failure_scenario': {
                'name': 'Equipment Failure',
                'description': 'Simulated equipment failure and recovery',
                'duration_minutes': 45,
                'sensor_anomalies': 0.15,
                'system_events': [
                    {'time': 10, 'type': 'sensor_failure', 'sensor_type': 'pressure', 'description': 'Pressure sensor failure'},
                    {'time': 20, 'type': 'system_alert', 'severity': 'critical', 'description': 'System pressure anomaly'},
                    {'time': 35, 'type': 'recovery', 'description': 'System recovered'}
                ]
            },
            'peak_load': {
                'name': 'Peak Load Operation',
                'description': 'High load operation scenario',
                'duration_minutes': 40,
                'sensor_anomalies': 0.08,
                'system_events': [
                    {'time': 5, 'type': 'load_increase', 'description': 'Load increased to 120%'},
                    {'time': 30, 'type': 'load_decrease', 'description': 'Load returned to normal'}
                ]
            }
        }

        logger.info("Created default simulation scenarios")

    def initialize_gateways(self):
        """Initialize IoT gateways."""
        for gateway_config in self.config['gateways']:
            gateway = IoTGateway(
                gateway_id=gateway_config['id'],
                backend_url=self.config['backend_url'],
                mqtt_config=gateway_config.get('mqtt_config', {})
            )

            # Add units to gateway
            for unit_id in gateway_config['units']:
                if unit_id in self.config['units']:
                    unit_config = self.config['units'][unit_id]
                    self._add_unit_to_gateway(gateway, unit_id, unit_config)

            self.gateways[gateway_config['id']] = gateway
            self.units.update({unit_id: gateway_config['id'] for unit_id in gateway_config['units']})

        logger.info(f"Initialized {len(self.gateways)} gateways with {len(self.units)} units")

    def _add_unit_to_gateway(self, gateway: IoTGateway, unit_id: str, unit_config: Dict[str, Any]):
        """Add unit sensors to gateway."""
        sensor_counter = {}

        for sensor_config in unit_config['sensors']:
            sensor_type = sensor_config['type']
            count = sensor_config['count']

            if sensor_type not in sensor_counter:
                sensor_counter[sensor_type] = 1

            for i in range(count):
                sensor_id = "03d"
                gateway.add_sensor(sensor_type, sensor_id, unit_id)

                sensor_counter[sensor_type] += 1

    def start_simulation(self) -> bool:
        """
        Start the simulation engine.

        Returns:
            Success status
        """
        logger.info("Starting Carbon Capture Simulation Engine")

        try:
            # Initialize gateways
            self.initialize_gateways()

            # Start all gateways
            for gateway in self.gateways.values():
                if not gateway.start():
                    logger.error(f"Failed to start gateway {gateway.gateway_id}")
                    return False

            self.is_running = True
            self.stats['start_time'] = datetime.now()

            # Start monitoring thread
            self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
            self.monitoring_thread.start()

            logger.info("Simulation engine started successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to start simulation engine: {e}")
            return False

    def stop_simulation(self):
        """Stop the simulation engine."""
        logger.info("Stopping Carbon Capture Simulation Engine")

        self.is_running = False

        # Stop all gateways
        for gateway in self.gateways.values():
            gateway.stop()

        self.stats['end_time'] = datetime.now()

        logger.info("Simulation engine stopped")

    def run_scenario(self, scenario_name: str) -> bool:
        """
        Run a specific simulation scenario.

        Args:
            scenario_name: Name of scenario to run

        Returns:
            Success status
        """
        if scenario_name not in self.scenarios:
            logger.error(f"Scenario {scenario_name} not found")
            return False

        scenario = self.scenarios[scenario_name]
        self.scenario_active = scenario_name

        logger.info(f"Starting scenario: {scenario['name']}")

        try:
            # Apply scenario settings
            self._apply_scenario_settings(scenario)

            # Schedule scenario events
            self._schedule_scenario_events(scenario)

            # Run for scenario duration
            duration_seconds = scenario['duration_minutes'] * 60 / self.real_time_factor
            time.sleep(duration_seconds)

            # Reset to normal operation
            self._reset_scenario_settings()

            self.scenario_active = None
            self.stats['scenarios_executed'] += 1

            logger.info(f"Scenario {scenario_name} completed")
            return True

        except Exception as e:
            logger.error(f"Scenario {scenario_name} failed: {e}")
            self.scenario_active = None
            return False

    def _apply_scenario_settings(self, scenario: Dict[str, Any]):
        """Apply scenario-specific settings."""
        # Update sensor anomaly rates
        anomaly_rate = scenario.get('sensor_anomalies', 0.01)

        for gateway in self.gateways.values():
            for sensor in gateway.sensors.values():
                if hasattr(sensor, 'error_probability'):
                    sensor.error_probability = anomaly_rate

    def _schedule_scenario_events(self, scenario: Dict[str, Any]):
        """Schedule scenario events."""
        events = scenario.get('system_events', [])

        for event in events:
            event_time = event['time'] * 60 / self.real_time_factor  # Convert to seconds

            def trigger_event(evt):
                time.sleep(event_time)
                if self.is_running and self.scenario_active == scenario['name']:
                    self._trigger_scenario_event(evt)

            threading.Thread(target=trigger_event, args=(event,), daemon=True).start()

    def _trigger_scenario_event(self, event: Dict[str, Any]):
        """Trigger a scenario event."""
        event_type = event['type']

        logger.info(f"Triggering scenario event: {event['description']}")

        if event_type == 'sensor_failure':
            self._simulate_sensor_failure(event)
        elif event_type == 'system_alert':
            self._simulate_system_alert(event)
        elif event_type == 'maintenance_start':
            self._simulate_maintenance_start(event)
        elif event_type == 'maintenance_end':
            self._simulate_maintenance_end(event)
        elif event_type == 'load_increase':
            self._simulate_load_change(event, increase=True)
        elif event_type == 'load_decrease':
            self._simulate_load_change(event, increase=False)
        elif event_type == 'recovery':
            self._simulate_recovery(event)

    def _simulate_sensor_failure(self, event: Dict[str, Any]):
        """Simulate sensor failure."""
        sensor_type = event.get('sensor_type', 'temperature')

        # Find a sensor of the specified type
        for gateway in self.gateways.values():
            for sensor in gateway.sensors.values():
                if sensor.sensor_type == sensor_type:
                    # Increase error probability dramatically
                    sensor.error_probability = 0.9
                    logger.info(f"Simulated failure of {sensor_type} sensor {sensor.sensor_id}")
                    break

    def _simulate_system_alert(self, event: Dict[str, Any]):
        """Simulate system alert."""
        severity = event.get('severity', 'warning')
        logger.warning(f"Simulated system alert: {event['description']} (severity: {severity})")

        # In a real implementation, this would trigger alerts to the backend
        # For now, just log the event

    def _simulate_maintenance_start(self, event: Dict[str, Any]):
        """Simulate maintenance start."""
        logger.info("Simulated maintenance period start")

        # Reduce sensor update frequencies during maintenance
        for gateway in self.gateways.values():
            for sensor in gateway.sensors.values():
                if hasattr(sensor, 'config'):
                    sensor.config['update_interval'] = sensor.config.get('update_interval', 30) * 2

    def _simulate_maintenance_end(self, event: Dict[str, Any]):
        """Simulate maintenance end."""
        logger.info("Simulated maintenance period end")

        # Restore normal sensor update frequencies
        for gateway in self.gateways.values():
            for sensor in gateway.sensors.values():
                if hasattr(sensor, 'config'):
                    sensor.config['update_interval'] = sensor.config.get('update_interval', 60) // 2

    def _simulate_load_change(self, event: Dict[str, Any], increase: bool = True):
        """Simulate load change."""
        factor = 1.5 if increase else 0.7
        direction = "increase" if increase else "decrease"

        logger.info(f"Simulated load {direction}: {event['description']}")

        # Adjust sensor nominal values to simulate load change
        for gateway in self.gateways.values():
            for sensor in gateway.sensors.values():
                if hasattr(sensor, 'nominal_value'):
                    if sensor.sensor_type in ['flow_rate', 'energy_consumption']:
                        sensor.nominal_value *= factor
                    elif sensor.sensor_type == 'temperature':
                        sensor.nominal_value += (5 * factor if increase else -3)

    def _simulate_recovery(self, event: Dict[str, Any]):
        """Simulate system recovery."""
        logger.info("Simulated system recovery")

        # Reset all sensors to normal operation
        for gateway in self.gateways.values():
            for sensor in gateway.sensors.values():
                if hasattr(sensor, 'error_probability'):
                    sensor.error_probability = 0.01

                # Reset nominal values to baseline
                self._reset_sensor_to_baseline(sensor)

    def _reset_sensor_to_baseline(self, sensor):
        """Reset sensor to baseline values."""
        if sensor.sensor_type == 'temperature':
            sensor.nominal_value = 25.0
        elif sensor.sensor_type == 'pressure':
            sensor.nominal_value = 45.0
        elif sensor.sensor_type == 'flow_rate':
            sensor.nominal_value = 1200.0
        elif sensor.sensor_type == 'co2_concentration':
            sensor.nominal_value = 420.0
        elif sensor.sensor_type == 'energy_consumption':
            sensor.nominal_value = 850.0

    def _reset_scenario_settings(self):
        """Reset scenario-specific settings."""
        for gateway in self.gateways.values():
            for sensor in gateway.sensors.values():
                if hasattr(sensor, 'error_probability'):
                    sensor.error_probability = 0.01
                self._reset_sensor_to_baseline(sensor)

    def _monitoring_loop(self):
        """Monitoring loop for simulation statistics."""
        while self.is_running:
            try:
                self._update_statistics()
                time.sleep(30)  # Update every 30 seconds
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")

    def _update_statistics(self):
        """Update simulation statistics."""
        total_readings = 0
        active_sensors = 0

        for gateway in self.gateways.values():
            gateway_status = gateway.get_status()
            active_sensors += gateway_status.get('active_sensors', 0)
            buffer_status = gateway_status.get('buffer_status', {})
            total_readings += buffer_status.get('total_readings', 0)

        self.stats.update({
            'active_gateways': len([g for g in self.gateways.values() if g.is_running]),
            'active_sensors': active_sensors,
            'total_readings': total_readings,
            'scenario_active': self.scenario_active
        })

    def get_status(self) -> Dict[str, Any]:
        """Get simulation engine status."""
        return {
            'is_running': self.is_running,
            'simulation_time': self.simulation_time.isoformat(),
            'real_time_factor': self.real_time_factor,
            'active_scenario': self.scenario_active,
            'gateways': {
                gid: g.get_status() for gid, g in self.gateways.items()
            },
            'stats': self.stats,
            'available_scenarios': list(self.scenarios.keys())
        }

    def get_available_scenarios(self) -> Dict[str, Any]:
        """Get available simulation scenarios."""
        return {
            name: {
                'name': scenario['name'],
                'description': scenario['description'],
                'duration_minutes': scenario['duration_minutes']
            }
            for name, scenario in self.scenarios.items()
        }

# Command-line interface
def main():
    """Main simulation function."""
    import argparse

    parser = argparse.ArgumentParser(description='Carbon Capture IoT Simulation Engine')
    parser.add_argument('--config', '-c', help='Configuration file path')
    parser.add_argument('--scenario', '-s', help='Scenario to run')
    parser.add_argument('--duration', '-d', type=int, help='Simulation duration in minutes')
    parser.add_argument('--realtime-factor', '-r', type=float, default=1.0,
                       help='Real-time factor (1.0 = real-time, 2.0 = 2x speed)')

    args = parser.parse_args()

    # Create simulation engine
    engine = SimulationEngine(args.config)

    if args.realtime_factor:
        engine.real_time_factor = args.realtime_factor

    try:
        # Start simulation
        if not engine.start_simulation():
            logger.error("Failed to start simulation")
            return

        logger.info("Simulation started. Press Ctrl+C to stop.")

        if args.scenario:
            # Run specific scenario
            success = engine.run_scenario(args.scenario)
            if not success:
                logger.error(f"Failed to run scenario {args.scenario}")
        elif args.duration:
            # Run for specified duration
            duration_seconds = args.duration * 60 / engine.real_time_factor
            time.sleep(duration_seconds)
        else:
            # Run indefinitely
            while True:
                time.sleep(10)

                # Print status
                status = engine.get_status()
                logger.info(f"Simulation status: {status['active_sensors']} sensors, "
                          f"{status['stats']['total_readings']} readings")

    except KeyboardInterrupt:
        logger.info("Stopping simulation...")
    finally:
        engine.stop_simulation()

        # Print final statistics
        final_stats = engine.get_status()['stats']
        logger.info("Simulation completed:")
        logger.info(f"  Duration: {final_stats['end_time'] - final_stats['start_time'] if final_stats['end_time'] else 'Unknown'}")
        logger.info(f"  Total readings: {final_stats['total_readings']}")
        logger.info(f"  Scenarios executed: {final_stats['scenarios_executed']}")

if __name__ == '__main__':
    main()