#!/usr/bin/env python3
"""
Comprehensive Optimization Service for Carbon Capture Systems
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import time

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.optimization_model import CarbonCaptureOptimizer
from prediction.prediction_service import PredictionService

class OptimizationService:
    """
    Comprehensive optimization service that combines multiple AI models
    to provide holistic carbon capture system optimization.
    """

    def __init__(self,
                 model_version: str = "1.0.0",
                 max_concurrent_optimizations: int = 5):
        """
        Initialize the optimization service.

        Args:
            model_version: Version of models to use
            max_concurrent_optimizations: Maximum concurrent optimization tasks
        """
        self.model_version = model_version
        self.max_concurrent = max_concurrent_optimizations

        # Initialize components
        self.optimizer = CarbonCaptureOptimizer(model_version=model_version)
        self.prediction_service = PredictionService(
            model_version=model_version,
            cache_enabled=True
        )
        self.executor = ThreadPoolExecutor(max_workers=max_concurrent_optimizations)
        self.logger = self._setup_logging()

        # Optimization templates
        self.optimization_templates = self._load_optimization_templates()

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

        # File handler
        file_handler = logging.FileHandler('optimization_service.log')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        return logger

    def _load_optimization_templates(self) -> Dict[str, Any]:
        """Load optimization strategy templates."""
        return {
            'efficiency_focused': {
                'priority_weights': {
                    'efficiency': 0.5,
                    'energy_savings': 0.3,
                    'maintenance_risk': 0.2
                },
                'constraints': {
                    'max_energy_increase': 0.05,  # 5% max increase
                    'min_efficiency_gain': 0.02   # 2% min gain
                }
            },
            'energy_efficient': {
                'priority_weights': {
                    'efficiency': 0.2,
                    'energy_savings': 0.6,
                    'maintenance_risk': 0.2
                },
                'constraints': {
                    'max_efficiency_decrease': 0.01,  # 1% max decrease
                    'min_energy_savings': 50          # 50 kWh min savings
                }
            },
            'maintenance_prioritized': {
                'priority_weights': {
                    'efficiency': 0.2,
                    'energy_savings': 0.2,
                    'maintenance_risk': 0.6
                },
                'constraints': {
                    'max_maintenance_risk': 0.3,  # 30% max risk
                    'maintenance_window_days': 30
                }
            },
            'balanced': {
                'priority_weights': {
                    'efficiency': 0.33,
                    'energy_savings': 0.33,
                    'maintenance_risk': 0.34
                },
                'constraints': {
                    'balanced_tradeoff': True
                }
            }
        }

    async def optimize_unit_comprehensive(self,
                                       unit_id: str,
                                       sensor_data: Dict[str, Any],
                                       optimization_strategy: str = 'balanced',
                                       time_horizon_hours: int = 24) -> Dict[str, Any]:
        """
        Perform comprehensive optimization for a carbon capture unit.

        Args:
            unit_id: Unit identifier
            sensor_data: Current sensor readings
            optimization_strategy: Optimization strategy to use
            time_horizon_hours: Time horizon for optimization

        Returns:
            Comprehensive optimization results
        """
        start_time = time.time()
        self.logger.info(f"Starting comprehensive optimization for unit {unit_id}")

        try:
            # Validate inputs
            self._validate_optimization_inputs(unit_id, sensor_data, optimization_strategy)

            # Get predictions concurrently
            efficiency_task = self.prediction_service.predict_efficiency(sensor_data)
            maintenance_task = self.prediction_service.predict_maintenance(sensor_data)

            efficiency_result, maintenance_result = await asyncio.gather(
                efficiency_task, maintenance_task
            )

            # Get energy optimization
            energy_data = self._extract_energy_data(sensor_data)
            energy_result = await self.prediction_service.optimize_energy(energy_data)

            # Generate comprehensive optimization plan
            optimization_plan = await self._generate_optimization_plan(
                unit_id, sensor_data, efficiency_result, maintenance_result,
                energy_result, optimization_strategy, time_horizon_hours
            )

            # Calculate implementation timeline
            timeline = self._calculate_implementation_timeline(optimization_plan, time_horizon_hours)

            # Assess risks and trade-offs
            risk_assessment = self._assess_optimization_risks(
                optimization_plan, sensor_data, maintenance_result
            )

            result = {
                'unit_id': unit_id,
                'optimization_strategy': optimization_strategy,
                'timestamp': datetime.now().isoformat(),
                'predictions': {
                    'efficiency': efficiency_result,
                    'maintenance': maintenance_result,
                    'energy': energy_result
                },
                'optimization_plan': optimization_plan,
                'implementation_timeline': timeline,
                'risk_assessment': risk_assessment,
                'performance_metrics': {
                    'processing_time_ms': (time.time() - start_time) * 1000,
                    'optimization_score': self._calculate_optimization_score(optimization_plan),
                    'confidence_level': self._calculate_overall_confidence([
                        efficiency_result, maintenance_result, energy_result
                    ])
                }
            }

            self.logger.info(f"Comprehensive optimization completed for unit {unit_id} in {(time.time() - start_time)*1000:.1f}ms")
            return result

        except Exception as e:
            self.logger.error(f"Comprehensive optimization failed for unit {unit_id}: {e}")
            raise

    def _validate_optimization_inputs(self,
                                    unit_id: str,
                                    sensor_data: Dict[str, Any],
                                    strategy: str) -> None:
        """Validate optimization inputs."""
        if not unit_id or not isinstance(unit_id, str):
            raise ValueError("Valid unit_id is required")

        if not sensor_data or not isinstance(sensor_data, dict):
            raise ValueError("Valid sensor_data dictionary is required")

        if strategy not in self.optimization_templates:
            raise ValueError(f"Unknown optimization strategy: {strategy}. Available: {list(self.optimization_templates.keys())}")

        required_sensors = ['temperature', 'pressure', 'flow_rate', 'energy_consumption']
        missing_sensors = [s for s in required_sensors if s not in sensor_data]
        if missing_sensors:
            raise ValueError(f"Missing required sensor data: {missing_sensors}")

    def _extract_energy_data(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract energy-related data for optimization."""
        energy_fields = [
            'energy_consumption', 'renewable_capacity', 'grid_cost_per_kwh',
            'renewable_cost_per_kwh', 'peak_hours', 'current_hour'
        ]

        energy_data = {}
        for field in energy_fields:
            if field in sensor_data:
                energy_data[field] = sensor_data[field]
            else:
                # Set defaults for missing fields
                defaults = {
                    'renewable_capacity': 300,
                    'grid_cost_per_kwh': 0.12,
                    'renewable_cost_per_kwh': 0.08,
                    'peak_hours': [9, 10, 11, 17, 18, 19],
                    'current_hour': datetime.now().hour
                }
                energy_data[field] = defaults.get(field, 0)

        return energy_data

    async def _generate_optimization_plan(self,
                                        unit_id: str,
                                        sensor_data: Dict[str, Any],
                                        efficiency_result: Dict[str, Any],
                                        maintenance_result: Dict[str, Any],
                                        energy_result: Dict[str, Any],
                                        strategy: str,
                                        time_horizon: int) -> Dict[str, Any]:
        """Generate comprehensive optimization plan."""

        template = self.optimization_templates[strategy]
        weights = template['priority_weights']

        # Analyze current state
        current_efficiency = sensor_data.get('efficiency_current', 80)
        predicted_efficiency = efficiency_result['predicted_efficiency']
        maintenance_score = maintenance_result['maintenance_score']
        energy_savings = energy_result['energy_savings']

        # Generate prioritized recommendations
        recommendations = []

        # Efficiency-focused recommendations
        if weights['efficiency'] > 0.3:
            efficiency_recs = self._generate_efficiency_recommendations(
                sensor_data, efficiency_result, current_efficiency
            )
            recommendations.extend(efficiency_recs)

        # Energy-focused recommendations
        if weights['energy_savings'] > 0.3:
            energy_recs = self._generate_energy_recommendations(
                sensor_data, energy_result
            )
            recommendations.extend(energy_recs)

        # Maintenance-focused recommendations
        if weights['maintenance_risk'] > 0.3:
            maintenance_recs = self._generate_maintenance_recommendations(
                sensor_data, maintenance_result
            )
            recommendations.extend(maintenance_recs)

        # Apply strategy constraints and prioritize
        filtered_recommendations = self._apply_strategy_constraints(
            recommendations, template['constraints'], sensor_data
        )

        prioritized_recommendations = self._prioritize_recommendations(
            filtered_recommendations, weights
        )

        # Calculate expected outcomes
        expected_outcomes = self._calculate_expected_outcomes(
            prioritized_recommendations, sensor_data, time_horizon
        )

        return {
            'strategy_applied': strategy,
            'recommendations': prioritized_recommendations,
            'expected_outcomes': expected_outcomes,
            'implementation_priority': self._calculate_implementation_priority(
                prioritized_recommendations, maintenance_score
            ),
            'monitoring_requirements': self._define_monitoring_requirements(
                prioritized_recommendations
            )
        }

    def _generate_efficiency_recommendations(self,
                                           sensor_data: Dict[str, Any],
                                           efficiency_result: Dict[str, Any],
                                           current_efficiency: float) -> List[Dict[str, Any]]:
        """Generate efficiency-focused recommendations."""
        recommendations = []

        # Temperature optimization
        temperature = sensor_data.get('temperature', 25)
        if temperature > 28:
            recommendations.append({
                'id': 'temp_optimization',
                'category': 'efficiency',
                'title': 'Temperature Optimization',
                'description': f'Reduce operating temperature from {temperature}°C to 25°C',
                'impact': {
                    'efficiency_gain': 2.5,
                    'energy_savings': 35,
                    'co2_reduction': 12
                },
                'difficulty': 'medium',
                'time_to_implement': 2,  # hours
                'cost': 0,
                'risk_level': 'low'
            })

        # Pressure optimization
        pressure = sensor_data.get('pressure', 50)
        if pressure > 55:
            recommendations.append({
                'id': 'pressure_optimization',
                'category': 'efficiency',
                'title': 'Pressure Optimization',
                'description': f'Optimize pressure from {pressure} psi to 45-50 psi range',
                'impact': {
                    'efficiency_gain': 1.8,
                    'energy_savings': 25,
                    'co2_reduction': 8
                },
                'difficulty': 'medium',
                'time_to_implement': 4,
                'cost': 0,
                'risk_level': 'low'
            })

        # Flow rate optimization
        flow_rate = sensor_data.get('flow_rate', 1000)
        if flow_rate > 1300:
            recommendations.append({
                'id': 'flow_optimization',
                'category': 'efficiency',
                'title': 'Flow Rate Optimization',
                'description': f'Optimize flow rate from {flow_rate} L/min to efficient range',
                'impact': {
                    'efficiency_gain': 1.2,
                    'energy_savings': 20,
                    'co2_reduction': 6
                },
                'difficulty': 'low',
                'time_to_implement': 1,
                'cost': 0,
                'risk_level': 'low'
            })

        return recommendations

    def _generate_energy_recommendations(self,
                                       sensor_data: Dict[str, Any],
                                       energy_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate energy-focused recommendations."""
        recommendations = []

        energy_savings = energy_result.get('energy_savings', 0)
        renewable_usage = energy_result.get('renewable_usage', 0)

        if renewable_usage < 70:
            recommendations.append({
                'id': 'renewable_shift',
                'category': 'energy',
                'title': 'Increase Renewable Energy Usage',
                'description': f'Increase renewable energy usage to {renewable_usage + 10}%',
                'impact': {
                    'efficiency_gain': 0.5,
                    'energy_savings': energy_savings * 0.3,
                    'co2_reduction': energy_savings * 0.4
                },
                'difficulty': 'medium',
                'time_to_implement': 8,
                'cost': 500,
                'risk_level': 'low'
            })

        # Peak shaving
        current_hour = datetime.now().hour
        if current_hour in [9, 10, 11, 17, 18, 19]:  # Peak hours
            recommendations.append({
                'id': 'peak_shaving',
                'category': 'energy',
                'title': 'Peak Demand Management',
                'description': 'Implement peak shaving during high-demand hours',
                'impact': {
                    'efficiency_gain': 0.8,
                    'energy_savings': 45,
                    'co2_reduction': 18
                },
                'difficulty': 'high',
                'time_to_implement': 24,
                'cost': 2000,
                'risk_level': 'medium'
            })

        return recommendations

    def _generate_maintenance_recommendations(self,
                                            sensor_data: Dict[str, Any],
                                            maintenance_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate maintenance-focused recommendations."""
        recommendations = []

        alerts = maintenance_result.get('alerts', [])

        for alert in alerts:
            if alert['alertType'] == 'warning':
                if 'vibration' in alert['message'].lower():
                    recommendations.append({
                        'id': 'vibration_maintenance',
                        'category': 'maintenance',
                        'title': 'Vibration Analysis and Bearing Check',
                        'description': 'Schedule vibration analysis and bearing inspection',
                        'impact': {
                            'efficiency_gain': 1.5,
                            'energy_savings': 30,
                            'co2_reduction': 10,
                            'maintenance_risk_reduction': 0.4
                        },
                        'difficulty': 'medium',
                        'time_to_implement': 16,
                        'cost': 1500,
                        'risk_level': 'medium'
                    })

                elif 'current' in alert['message'].lower():
                    recommendations.append({
                        'id': 'electrical_maintenance',
                        'category': 'maintenance',
                        'title': 'Electrical System Inspection',
                        'description': 'Inspect electrical components and motor systems',
                        'impact': {
                            'efficiency_gain': 1.2,
                            'energy_savings': 25,
                            'co2_reduction': 8,
                            'maintenance_risk_reduction': 0.35
                        },
                        'difficulty': 'high',
                        'time_to_implement': 20,
                        'cost': 2500,
                        'risk_level': 'high'
                    })

        # Preventive maintenance
        days_since_maintenance = sensor_data.get('maintenance_days_since', 0)
        if days_since_maintenance > 180:  # 6 months
            recommendations.append({
                'id': 'preventive_maintenance',
                'category': 'maintenance',
                'title': 'Comprehensive Preventive Maintenance',
                'description': 'Schedule full preventive maintenance inspection',
                'impact': {
                    'efficiency_gain': 2.0,
                    'energy_savings': 50,
                    'co2_reduction': 15,
                    'maintenance_risk_reduction': 0.6
                },
                'difficulty': 'high',
                'time_to_implement': 48,
                'cost': 5000,
                'risk_level': 'low'
            })

        return recommendations

    def _apply_strategy_constraints(self,
                                  recommendations: List[Dict[str, Any]],
                                  constraints: Dict[str, Any],
                                  sensor_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Apply strategy-specific constraints to filter recommendations."""
        filtered = []

        for rec in recommendations:
            valid = True

            # Check efficiency constraints
            if 'max_energy_increase' in constraints:
                energy_impact = rec['impact'].get('energy_savings', 0)
                if energy_impact < 0 and abs(energy_impact) > constraints['max_energy_increase'] * 100:
                    valid = False

            if 'min_efficiency_gain' in constraints:
                efficiency_gain = rec['impact'].get('efficiency_gain', 0)
                if efficiency_gain < constraints['min_efficiency_gain']:
                    valid = False

            # Check energy constraints
            if 'max_efficiency_decrease' in constraints:
                efficiency_impact = rec['impact'].get('efficiency_gain', 0)
                if efficiency_impact < -constraints['max_efficiency_decrease']:
                    valid = False

            if 'min_energy_savings' in constraints:
                energy_savings = rec['impact'].get('energy_savings', 0)
                if energy_savings < constraints['min_energy_savings']:
                    valid = False

            # Check maintenance constraints
            if 'max_maintenance_risk' in constraints:
                risk_reduction = rec['impact'].get('maintenance_risk_reduction', 0)
                # Only include if it reduces risk below threshold
                # (This is a simplified check)

            if valid:
                filtered.append(rec)

        return filtered

    def _prioritize_recommendations(self,
                                  recommendations: List[Dict[str, Any]],
                                  weights: Dict[str, float]) -> List[Dict[str, Any]]:
        """Prioritize recommendations based on strategy weights."""

        def calculate_priority_score(rec: Dict[str, Any]) -> float:
            score = 0

            # Impact score
            efficiency_gain = rec['impact'].get('efficiency_gain', 0) * weights['efficiency']
            energy_savings = rec['impact'].get('energy_savings', 0) * weights['energy_savings'] / 10  # Normalize
            risk_reduction = rec['impact'].get('maintenance_risk_reduction', 0) * weights['maintenance_risk'] * 100

            score += efficiency_gain + energy_savings + risk_reduction

            # Difficulty penalty
            difficulty_penalty = {'low': 0, 'medium': 0.1, 'high': 0.2}
            score -= score * difficulty_penalty.get(rec['difficulty'], 0)

            # Risk penalty
            risk_penalty = {'low': 0, 'medium': 0.15, 'high': 0.3}
            score -= score * risk_penalty.get(rec['risk_level'], 0)

            return score

        # Sort by priority score descending
        prioritized = sorted(recommendations,
                           key=calculate_priority_score,
                           reverse=True)

        # Add priority ranking
        for i, rec in enumerate(prioritized):
            rec['priority_rank'] = i + 1
            rec['priority_score'] = calculate_priority_score(rec)

        return prioritized

    def _calculate_expected_outcomes(self,
                                   recommendations: List[Dict[str, Any]],
                                   sensor_data: Dict[str, Any],
                                   time_horizon: int) -> Dict[str, Any]:
        """Calculate expected outcomes of implementing recommendations."""

        # Take top 3 recommendations for calculation
        top_recs = recommendations[:3]

        total_efficiency_gain = sum(rec['impact'].get('efficiency_gain', 0) for rec in top_recs)
        total_energy_savings = sum(rec['impact'].get('energy_savings', 0) for rec in top_recs)
        total_co2_reduction = sum(rec['impact'].get('co2_reduction', 0) for rec in top_recs)
        total_cost = sum(rec.get('cost', 0) for rec in top_recs)

        current_efficiency = sensor_data.get('efficiency_current', 80)
        projected_efficiency = current_efficiency + total_efficiency_gain

        # Calculate ROI
        annual_energy_cost_savings = total_energy_savings * 365 * 0.12  # Assuming $0.12/kWh
        roi = (annual_energy_cost_savings - total_cost) / total_cost if total_cost > 0 else float('inf')

        return {
            'time_horizon_hours': time_horizon,
            'projected_efficiency': projected_efficiency,
            'total_efficiency_gain': total_efficiency_gain,
            'total_energy_savings_kwh': total_energy_savings,
            'total_co2_reduction_tons': total_co2_reduction,
            'total_implementation_cost': total_cost,
            'estimated_roi': roi,
            'break_even_months': total_cost / (annual_energy_cost_savings / 12) if annual_energy_cost_savings > 0 else float('inf'),
            'recommendations_implemented': len(top_recs)
        }

    def _calculate_implementation_timeline(self,
                                         optimization_plan: Dict[str, Any],
                                         time_horizon: int) -> List[Dict[str, Any]]:
        """Calculate implementation timeline for recommendations."""
        timeline = []
        current_time = datetime.now()

        recommendations = optimization_plan['recommendations'][:5]  # Top 5

        for rec in recommendations:
            implementation_time = rec['time_to_implement']
            start_time = current_time
            end_time = current_time + timedelta(hours=implementation_time)

            timeline.append({
                'recommendation_id': rec['id'],
                'title': rec['title'],
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'duration_hours': implementation_time,
                'difficulty': rec['difficulty'],
                'dependencies': []  # Could be enhanced with dependency analysis
            })

            current_time = end_time

        return timeline

    def _assess_optimization_risks(self,
                                 optimization_plan: Dict[str, Any],
                                 sensor_data: Dict[str, Any],
                                 maintenance_result: Dict[str, Any]) -> Dict[str, Any]:
        """Assess risks associated with optimization recommendations."""

        recommendations = optimization_plan['recommendations']
        maintenance_score = maintenance_result['maintenance_score']

        # Risk factors
        high_risk_count = sum(1 for rec in recommendations if rec['risk_level'] == 'high')
        total_cost = sum(rec.get('cost', 0) for rec in recommendations)
        implementation_time = sum(rec['time_to_implement'] for rec in recommendations)

        # Risk assessment
        risk_score = 0

        # Maintenance risk
        if maintenance_score > 0.7:
            risk_score += 0.3

        # Implementation complexity
        if high_risk_count > 2:
            risk_score += 0.2

        # Cost risk
        if total_cost > 10000:
            risk_score += 0.2

        # Time risk
        if implementation_time > 72:  # More than 3 days
            risk_score += 0.1

        # Operational stability risk
        unit_age = sensor_data.get('unit_age_days', 0)
        if unit_age > 2000:  # Older units
            risk_score += 0.2

        risk_level = 'low' if risk_score < 0.3 else 'medium' if risk_score < 0.6 else 'high'

        mitigation_strategies = []
        if risk_score > 0.3:
            mitigation_strategies.append("Implement changes gradually with monitoring")
        if maintenance_score > 0.5:
            mitigation_strategies.append("Schedule maintenance before optimization")
        if high_risk_count > 0:
            mitigation_strategies.append("Have rollback procedures ready")
        if total_cost > 5000:
            mitigation_strategies.append("Phase implementation to spread costs")

        return {
            'overall_risk_level': risk_level,
            'risk_score': risk_score,
            'risk_factors': {
                'maintenance_risk': maintenance_score > 0.7,
                'implementation_complexity': high_risk_count > 2,
                'high_cost': total_cost > 10000,
                'long_implementation': implementation_time > 72,
                'old_equipment': unit_age > 2000
            },
            'mitigation_strategies': mitigation_strategies,
            'monitoring_recommendations': [
                "Monitor efficiency metrics every 15 minutes during implementation",
                "Track energy consumption in real-time",
                "Monitor for any error conditions or alerts",
                "Have engineering team on standby during critical changes"
            ]
        }

    def _calculate_optimization_score(self, optimization_plan: Dict[str, Any]) -> float:
        """Calculate overall optimization score."""
        outcomes = optimization_plan.get('expected_outcomes', {})

        efficiency_gain = outcomes.get('total_efficiency_gain', 0)
        energy_savings = outcomes.get('total_energy_savings_kwh', 0) / 100  # Normalize
        co2_reduction = outcomes.get('total_co2_reduction_tons', 0) * 10  # Weight CO2 reduction

        # Weighted score
        score = (
            efficiency_gain * 0.4 +
            energy_savings * 0.3 +
            co2_reduction * 0.3
        )

        return min(score, 100)  # Cap at 100

    def _calculate_overall_confidence(self, predictions: List[Dict[str, Any]]) -> str:
        """Calculate overall confidence level across all predictions."""
        confidences = []

        for pred in predictions:
            if 'confidence_score' in pred:
                confidences.append(pred['confidence_score'])
            elif 'model_version' in pred:
                confidences.append(0.85)  # Default confidence for model predictions

        if not confidences:
            return 'unknown'

        avg_confidence = sum(confidences) / len(confidences)

        if avg_confidence > 0.9:
            return 'high'
        elif avg_confidence > 0.7:
            return 'medium'
        else:
            return 'low'

    def _calculate_implementation_priority(self,
                                        recommendations: List[Dict[str, Any]],
                                        maintenance_score: float) -> str:
        """Calculate implementation priority level."""
        if maintenance_score > 0.8:
            return 'critical'
        elif maintenance_score > 0.6 or len(recommendations) > 3:
            return 'high'
        elif maintenance_score > 0.4:
            return 'medium'
        else:
            return 'low'

    def _define_monitoring_requirements(self,
                                      recommendations: List[Dict[str, Any]]) -> List[str]:
        """Define monitoring requirements for implementation."""
        requirements = [
            "Continuous monitoring of efficiency metrics",
            "Real-time energy consumption tracking",
            "Alert monitoring for any anomalies"
        ]

        # Add specific monitoring based on recommendations
        for rec in recommendations[:3]:  # Top 3 recommendations
            if 'temperature' in rec['title'].lower():
                requirements.append("Temperature monitoring every 5 minutes")
            if 'pressure' in rec['title'].lower():
                requirements.append("Pressure monitoring every 5 minutes")
            if 'vibration' in rec['title'].lower():
                requirements.append("Vibration analysis every 15 minutes")
            if 'maintenance' in rec['category']:
                requirements.append("Increased maintenance monitoring")

        return list(set(requirements))  # Remove duplicates

    async def optimize_network(self,
                             network_data: List[Dict[str, Any]],
                             optimization_strategy: str = 'balanced') -> Dict[str, Any]:
        """
        Optimize entire carbon capture network.

        Args:
            network_data: List of unit data for network optimization
            optimization_strategy: Network-wide optimization strategy

        Returns:
            Network optimization results
        """
        self.logger.info(f"Starting network optimization for {len(network_data)} units")

        start_time = time.time()

        # Create optimization tasks for each unit
        tasks = []
        for unit_data in network_data:
            task = self.optimize_unit_comprehensive(
                unit_data['unit_id'],
                unit_data['sensor_data'],
                optimization_strategy
            )
            tasks.append(task)

        # Execute optimizations concurrently (with limit)
        semaphore = asyncio.Semaphore(self.max_concurrent)
        async def limited_optimize(task):
            async with semaphore:
                return await task

        limited_tasks = [limited_optimize(task) for task in tasks]
        results = await asyncio.gather(*limited_tasks, return_exceptions=True)

        # Process results
        successful_optimizations = []
        failed_optimizations = []

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failed_optimizations.append({
                    'unit_id': network_data[i]['unit_id'],
                    'error': str(result)
                })
            else:
                successful_optimizations.append(result)

        # Aggregate network results
        network_summary = self._aggregate_network_results(successful_optimizations)

        return {
            'network_optimization': {
                'total_units': len(network_data),
                'successful_optimizations': len(successful_optimizations),
                'failed_optimizations': len(failed_optimizations),
                'optimization_strategy': optimization_strategy,
                'processing_time_ms': (time.time() - start_time) * 1000
            },
            'results': successful_optimizations,
            'failures': failed_optimizations,
            'network_summary': network_summary,
            'timestamp': datetime.now().isoformat()
        }

    def _aggregate_network_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate results across network units."""
        if not results:
            return {}

        total_efficiency_gain = sum(r['optimization_plan']['expected_outcomes']['total_efficiency_gain'] for r in results)
        total_energy_savings = sum(r['optimization_plan']['expected_outcomes']['total_energy_savings_kwh'] for r in results)
        total_co2_reduction = sum(r['optimization_plan']['expected_outcomes']['total_co2_reduction_tons'] for r in results)
        total_cost = sum(r['optimization_plan']['expected_outcomes']['total_implementation_cost'] for r in results)

        avg_optimization_score = sum(r['performance_metrics']['optimization_score'] for r in results) / len(results)

        # Network efficiency metrics
        high_priority_count = sum(1 for r in results if r['optimization_plan']['implementation_priority'] == 'high')
        critical_priority_count = sum(1 for r in results if r['optimization_plan']['implementation_priority'] == 'critical')

        return {
            'total_efficiency_gain': total_efficiency_gain,
            'total_energy_savings_kwh': total_energy_savings,
            'total_co2_reduction_tons': total_co2_reduction,
            'total_implementation_cost': total_cost,
            'average_optimization_score': avg_optimization_score,
            'priority_distribution': {
                'high_priority_units': high_priority_count,
                'critical_priority_units': critical_priority_count,
                'normal_priority_units': len(results) - high_priority_count - critical_priority_count
            },
            'network_roi': (total_energy_savings * 365 * 0.12 - total_cost) / total_cost if total_cost > 0 else float('inf'),
            'efficiency_improvement_percentage': (total_efficiency_gain / len(results)) if results else 0
        }

    def shutdown(self) -> None:
        """Shutdown the optimization service."""
        self.logger.info("Shutting down optimization service...")

        if self.executor:
            self.executor.shutdown(wait=True)

        if self.prediction_service:
            self.prediction_service.shutdown()

        self.logger.info("Optimization service shutdown complete")

# Standalone optimization function
async def optimize_unit(unit_id: str,
                       sensor_data: Dict[str, Any],
                       strategy: str = 'balanced') -> Dict[str, Any]:
    """Standalone unit optimization function."""
    service = OptimizationService()
    try:
        return await service.optimize_unit_comprehensive(unit_id, sensor_data, strategy)
    finally:
        service.shutdown()

if __name__ == '__main__':
    # Example usage
    async def main():
        service = OptimizationService()

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
            # Test comprehensive optimization
            result = await service.optimize_unit_comprehensive(
                'CC-001', sensor_data, 'balanced'
            )

            print("Comprehensive Optimization Result:")
            print(json.dumps(result, indent=2, default=str))

        finally:
            service.shutdown()

    asyncio.run(main())
