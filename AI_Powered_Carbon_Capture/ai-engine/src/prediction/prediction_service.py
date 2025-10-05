"""
Prediction Service for Carbon Capture AI Engine

This module provides prediction services for efficiency, maintenance, and energy optimization
using trained machine learning models.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import numpy as np
import pandas as pd
from concurrent.futures import ThreadPoolExecutor
import json
import os

# Add parent directory to path for imports
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.optimization_model import CarbonCaptureOptimizer

class PredictionService:
    """
    Service for making predictions using trained AI models.
    Handles efficiency prediction, maintenance forecasting, and energy optimization.
    """

    def __init__(self, model_version: str = "1.0.0", cache_enabled: bool = True):
        """
        Initialize the prediction service.

        Args:
            model_version: Version of models to use
            cache_enabled: Whether to enable prediction caching
        """
        self.model_version = model_version
        self.cache_enabled = cache_enabled
        self.optimizer = CarbonCaptureOptimizer(model_version=model_version)
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.logger = self._setup_logging()

        # Cache for predictions (simple in-memory cache)
        self.prediction_cache = {}
        self.cache_ttl = 300  # 5 minutes cache TTL

    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration."""
        logger = logging.getLogger(__name__)
        logger.setLevel(logging.INFO)

        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

        return logger

    async def predict_efficiency(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict carbon capture efficiency.

        Args:
            sensor_data: Current sensor readings

        Returns:
            Efficiency prediction results
        """
        start_time = time.time()
        cache_key = f"efficiency_{hash(json.dumps(sensor_data, sort_keys=True))}"

        # Check cache
        if self.cache_enabled and cache_key in self.prediction_cache:
            cached_result = self.prediction_cache[cache_key]
            if time.time() - cached_result['timestamp'] < self.cache_ttl:
                self.logger.info("Returning cached efficiency prediction")
                return cached_result['data']

        try:
            # Run prediction in thread pool
            result = await asyncio.get_event_loop().run_in_executor(
                self.executor, self.optimizer.predict_efficiency, sensor_data
            )

            # Cache result
            if self.cache_enabled:
                self.prediction_cache[cache_key] = {
                    'data': result,
                    'timestamp': time.time()
                }

            # Clean old cache entries
            self._clean_cache()

            processing_time = time.time() - start_time
            result['processing_time_ms'] = processing_time * 1000

            self.logger.info(".2f")
            return result

        except Exception as e:
            self.logger.error(f"Efficiency prediction failed: {e}")
            raise

    async def predict_maintenance(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict maintenance needs.

        Args:
            sensor_data: Current sensor readings

        Returns:
            Maintenance prediction results
        """
        start_time = time.time()
        cache_key = f"maintenance_{hash(json.dumps(sensor_data, sort_keys=True))}"

        # Check cache
        if self.cache_enabled and cache_key in self.prediction_cache:
            cached_result = self.prediction_cache[cache_key]
            if time.time() - cached_result['timestamp'] < self.cache_ttl:
                self.logger.info("Returning cached maintenance prediction")
                return cached_result['data']

        try:
            # Run prediction in thread pool
            result = await asyncio.get_event_loop().run_in_executor(
                self.optimizer.predict_maintenance, sensor_data
            )

            # Cache result
            if self.cache_enabled:
                self.prediction_cache[cache_key] = {
                    'data': result,
                    'timestamp': time.time()
                }

            # Clean old cache entries
            self._clean_cache()

            processing_time = time.time() - start_time
            result['processing_time_ms'] = processing_time * 1000

            self.logger.info(".3f")
            return result

        except Exception as e:
            self.logger.error(f"Maintenance prediction failed: {e}")
            raise

    async def optimize_energy(self, operational_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize energy usage.

        Args:
            operational_data: Current operational parameters

        Returns:
            Energy optimization recommendations
        """
        start_time = time.time()
        cache_key = f"energy_{hash(json.dumps(operational_data, sort_keys=True))}"

        # Check cache
        if self.cache_enabled and cache_key in self.prediction_cache:
            cached_result = self.prediction_cache[cache_key]
            if time.time() - cached_result['timestamp'] < self.cache_ttl:
                self.logger.info("Returning cached energy optimization")
                return cached_result['data']

        try:
            # Run optimization in thread pool
            result = await asyncio.get_event_loop().run_in_executor(
                self.optimizer.optimize_energy_usage, operational_data
            )

            # Cache result
            if self.cache_enabled:
                self.prediction_cache[cache_key] = {
                    'data': result,
                    'timestamp': time.time()
                }

            # Clean old cache entries
            self._clean_cache()

            processing_time = time.time() - start_time
            result['processing_time_ms'] = processing_time * 1000

            self.logger.info(".1f")
            return result

        except Exception as e:
            self.logger.error(f"Energy optimization failed: {e}")
            raise

    async def get_batch_predictions(self, units_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Get predictions for multiple units in batch.

        Args:
            units_data: List of unit data with sensor readings

        Returns:
            List of prediction results
        """
        start_time = time.time()
        self.logger.info(f"Starting batch predictions for {len(units_data)} units")

        # Create tasks for concurrent processing
        tasks = []
        for unit_data in units_data:
            unit_id = unit_data.get('unit_id', 'unknown')
            sensor_data = unit_data.get('sensor_data', {})

            # Create combined prediction task
            task = self._predict_unit_comprehensive(unit_id, sensor_data)
            tasks.append(task)

        # Execute all tasks concurrently with semaphore to limit concurrency
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent predictions

        async def limited_predict(task):
            async with semaphore:
                return await task

        limited_tasks = [limited_predict(task) for task in tasks]
        results = await asyncio.gather(*limited_tasks, return_exceptions=True)

        # Process results
        processed_results = []
        for i, result in enumerate(results):
            unit_data = units_data[i]
            unit_id = unit_data.get('unit_id', f'unit_{i}')

            if isinstance(result, Exception):
                self.logger.error(f"Batch prediction failed for unit {unit_id}: {result}")
                processed_results.append({
                    'unit_id': unit_id,
                    'success': False,
                    'error': str(result),
                    'timestamp': datetime.now().isoformat()
                })
            else:
                processed_results.append({
                    'unit_id': unit_id,
                    'success': True,
                    **result,
                    'timestamp': datetime.now().isoformat()
                })

        total_time = time.time() - start_time
        self.logger.info(".2f")

        return processed_results

    async def _predict_unit_comprehensive(self, unit_id: str, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get comprehensive predictions for a single unit."""
        # Run predictions concurrently
        efficiency_task = self.predict_efficiency(sensor_data)
        maintenance_task = self.predict_maintenance(sensor_data)

        efficiency_result, maintenance_result = await asyncio.gather(
            efficiency_task, maintenance_task
        )

        # Energy optimization with operational data
        operational_data = self._extract_operational_data(sensor_data)
        energy_result = await self.optimize_energy(operational_data)

        return {
            'efficiency_prediction': efficiency_result,
            'maintenance_prediction': maintenance_result,
            'energy_optimization': energy_result,
            'comprehensive_score': self._calculate_comprehensive_score(
                efficiency_result, maintenance_result, energy_result
            )
        }

    def _extract_operational_data(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract operational data from sensor readings."""
        return {
            'energy_consumption': sensor_data.get('energy_consumption', 0),
            'renewable_energy_available': sensor_data.get('renewable_energy_available', 0.7),
            'renewable_usage': sensor_data.get('renewable_usage', 0.6),
            'grid_usage': sensor_data.get('grid_usage', 0.4),
            'peak_hours': sensor_data.get('peak_hours', False),
            'current_hour': sensor_data.get('current_hour', datetime.now().hour)
        }

    def _calculate_comprehensive_score(self,
                                     efficiency_result: Dict[str, Any],
                                     maintenance_result: Dict[str, Any],
                                     energy_result: Dict[str, Any]) -> float:
        """
        Calculate a comprehensive performance score combining all predictions.

        Returns score from 0-100, where higher is better.
        """
        try:
            # Efficiency score (40% weight)
            efficiency_score = min(efficiency_result.get('predicted_efficiency', 80) / 100, 1.0) * 40

            # Maintenance score (30% weight) - lower risk is better
            maintenance_score = 0
            risk_level = maintenance_result.get('risk_level', 'medium')
            if risk_level == 'low':
                maintenance_score = 30
            elif risk_level == 'medium':
                maintenance_score = 20
            else:  # high/critical
                maintenance_score = 10

            # Energy score (30% weight) - higher savings is better
            energy_savings = energy_result.get('energy_savings', 0)
            energy_score = min(energy_savings / 100, 1.0) * 30  # Normalize to max 100 kWh savings

            total_score = efficiency_score + maintenance_score + energy_score

            return round(total_score, 2)

        except Exception as e:
            self.logger.error(f"Error calculating comprehensive score: {e}")
            return 50.0  # Default neutral score

    def _clean_cache(self):
        """Clean expired cache entries."""
        current_time = time.time()
        expired_keys = [
            key for key, value in self.prediction_cache.items()
            if current_time - value['timestamp'] > self.cache_ttl
        ]

        for key in expired_keys:
            del self.prediction_cache[key]

        # Log cache status periodically
        if len(self.prediction_cache) > 100:  # Arbitrary threshold
            self.logger.warning(f"Cache size is large: {len(self.prediction_cache)} entries")

    async def get_prediction_stats(self) -> Dict[str, Any]:
        """
        Get prediction service statistics.

        Returns:
            Statistics about prediction performance
        """
        return {
            'cache_enabled': self.cache_enabled,
            'cache_size': len(self.prediction_cache),
            'cache_ttl_seconds': self.cache_ttl,
            'model_version': self.model_version,
            'active_threads': self.executor._threads,
            'timestamp': datetime.now().isoformat()
        }

    def shutdown(self):
        """Shutdown the prediction service."""
        self.logger.info("Shutting down prediction service...")

        if self.executor:
            self.executor.shutdown(wait=True)

        if self.optimizer:
            try:
                self.optimizer.save_models()
                self.logger.info("Models saved before shutdown")
            except Exception as e:
                self.logger.error(f"Error saving models on shutdown: {e}")

        self.logger.info("Prediction service shutdown complete")

# Standalone prediction functions for backward compatibility
async def predict_efficiency_standalone(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """Standalone efficiency prediction function."""
    service = PredictionService()
    try:
        return await service.predict_efficiency(sensor_data)
    finally:
        service.shutdown()

async def predict_maintenance_standalone(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """Standalone maintenance prediction function."""
    service = PredictionService()
    try:
        return await service.predict_maintenance(sensor_data)
    finally:
        service.shutdown()

if __name__ == '__main__':
    # Example usage
    async def main():
        service = PredictionService()

        # Example sensor data
        sensor_data = {
            'temperature': 75.5,
            'pressure': 45.2,
            'flow_rate': 1200.5,
            'humidity': 65.3,
            'energy_consumption': 850.2,
            'co2_concentration': 412.8,
            'unit_age_days': 365,
            'maintenance_days_since': 30,
            'efficiency_current': 82.5
        }

        try:
            # Test efficiency prediction
            efficiency_result = await service.predict_efficiency(sensor_data)
            print("Efficiency Prediction:")
            print(json.dumps(efficiency_result, indent=2, default=str))

            # Test maintenance prediction
            maintenance_result = await service.predict_maintenance(sensor_data)
            print("\nMaintenance Prediction:")
            print(json.dumps(maintenance_result, indent=2, default=str))

            # Test energy optimization
            operational_data = {
                'energy_consumption': 850.2,
                'renewable_energy_available': 0.7,
                'renewable_usage': 0.6,
                'grid_usage': 0.4,
                'peak_hours': False
            }

            energy_result = await service.optimize_energy(operational_data)
            print("\nEnergy Optimization:")
            print(json.dumps(energy_result, indent=2, default=str))

        finally:
            service.shutdown()

    asyncio.run(main())