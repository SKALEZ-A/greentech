#!/usr/bin/env python3
"""
Maintenance Model Training Script

This script trains the predictive maintenance model for carbon capture units.
"""

import sys
import os
import json
import logging
import argparse
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, roc_curve
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Any, Tuple

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.optimization_model import CarbonCaptureOptimizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('maintenance_training.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class MaintenanceModelTrainer:
    """Trainer class for predictive maintenance models."""

    def __init__(self, config_path: str = None):
        """
        Initialize the trainer.

        Args:
            config_path: Path to training configuration file
        """
        self.config = self._load_config(config_path)
        self.optimizer = CarbonCaptureOptimizer(model_version=self.config['model_version'])

        # Set random seed for reproducibility
        np.random.seed(self.config['random_seed'])

        # Setup output directories
        self.output_dir = self.config['output_dir']
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, 'plots'), exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, 'models'), exist_ok=True)

    def _load_config(self, config_path: str = None) -> dict:
        """Load training configuration."""
        default_config = {
            'model_version': '1.0.0',
            'random_seed': 42,
            'output_dir': 'training_output/maintenance',
            'data_path': 'data/training/maintenance_training_data.json',
            'test_size': 0.2,
            'validation_size': 0.1,
            'handle_imbalance': True,
            'smote_sampling_strategy': 'auto',
            'cross_validation_folds': 5,
            'feature_selection': True,
            'save_plots': True,
            'save_models': True,
            'early_stopping': True
        }

        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                user_config = json.load(f)
            default_config.update(user_config)

        return default_config

    def generate_synthetic_maintenance_data(self, num_samples: int = 10000) -> pd.DataFrame:
        """
        Generate synthetic maintenance training data for demonstration.

        Args:
            num_samples: Number of samples to generate

        Returns:
            Synthetic training dataframe
        """
        logger.info(f"Generating {num_samples} synthetic maintenance training samples")

        np.random.seed(self.config['random_seed'])

        # Base parameters for different unit conditions
        conditions = {
            'normal': {
                'temp_range': (20, 40),
                'pressure_range': (40, 60),
                'vibration_range': (0.1, 1.0),
                'current_range': (8, 12),
                'bearing_temp_range': (25, 45),
                'maintenance_prob': 0.05
            },
            'warning': {
                'temp_range': (35, 55),
                'pressure_range': (35, 65),
                'vibration_range': (0.8, 2.5),
                'current_range': (10, 15),
                'bearing_temp_range': (40, 60),
                'maintenance_prob': 0.25
            },
            'critical': {
                'temp_range': (50, 70),
                'pressure_range': (30, 70),
                'vibration_range': (2.0, 5.0),
                'current_range': (12, 18),
                'bearing_temp_range': (55, 75),
                'maintenance_prob': 0.70
            }
        }

        data = []

        for _ in range(num_samples):
            # Randomly select condition (weighted)
            condition_weights = [0.7, 0.2, 0.1]  # 70% normal, 20% warning, 10% critical
            condition = np.random.choice(['normal', 'warning', 'critical'],
                                       p=condition_weights)

            params = conditions[condition]

            # Generate sensor readings with some noise
            sample = {
                'temperature': np.random.uniform(*params['temp_range']) + np.random.normal(0, 2),
                'pressure': np.random.uniform(*params['pressure_range']) + np.random.normal(0, 3),
                'vibration': np.random.uniform(*params['vibration_range']) + np.random.normal(0, 0.2),
                'motor_current': np.random.uniform(*params['current_range']) + np.random.normal(0, 0.5),
                'bearing_temp': np.random.uniform(*params['bearing_temp_range']) + np.random.normal(0, 2),
                'unit_age_days': np.random.uniform(1, 2000),  # 1 day to ~5.5 years
                'maintenance_days_since': np.random.uniform(1, 365),  # 1 day to 1 year
                'operating_hours': np.random.uniform(1, 8760),  # 1 hour to 1 year
                'maintenance_needed': np.random.random() < params['maintenance_prob']
            }

            # Add some derived features
            sample['temp_pressure_ratio'] = sample['temperature'] / (sample['pressure'] + 1)
            sample['vibration_current_ratio'] = sample['vibration'] / (sample['motor_current'] + 0.1)
            sample['age_maintenance_ratio'] = sample['unit_age_days'] / (sample['maintenance_days_since'] + 1)

            data.append(sample)

        df = pd.DataFrame(data)

        # Ensure proper data types
        df['maintenance_needed'] = df['maintenance_needed'].astype(int)

        logger.info(f"Generated synthetic data with class distribution:")
        logger.info(df['maintenance_needed'].value_counts(normalize=True))

        return df

    def load_training_data(self) -> pd.DataFrame:
        """
        Load and preprocess training data.

        Returns:
            Preprocessed training dataframe
        """
        data_path = self.config['data_path']

        if os.path.exists(data_path):
            logger.info(f"Loading training data from {data_path}")

            try:
                with open(data_path, 'r') as f:
                    data = json.load(f)

                df = pd.DataFrame(data)
                logger.info(f"Loaded {len(df)} training samples from file")

            except Exception as e:
                logger.error(f"Error loading data from file: {e}")
                logger.info("Falling back to synthetic data generation")
                df = self.generate_synthetic_maintenance_data(5000)
        else:
            logger.info(f"Data file {data_path} not found, generating synthetic data")
            df = self.generate_synthetic_maintenance_data(5000)

        # Data validation
        required_columns = [
            'temperature', 'pressure', 'vibration', 'motor_current',
            'bearing_temp', 'unit_age_days', 'maintenance_days_since',
            'maintenance_needed'
        ]

        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

        # Handle missing values
        if df.isnull().sum().sum() > 0:
            logger.warning("Found missing values, filling with median/mode")
            for col in df.columns:
                if df[col].dtype in ['int64', 'float64']:
                    df[col] = df[col].fillna(df[col].median())
                else:
                    df[col] = df[col].fillna(df[col].mode().iloc[0] if not df[col].mode().empty else 0)

        # Ensure target is integer
        df['maintenance_needed'] = df['maintenance_needed'].astype(int)

        # Data summary
        logger.info("Data summary:")
        logger.info(f"Shape: {df.shape}")
        logger.info(f"Class distribution: {df['maintenance_needed'].value_counts().to_dict()}")
        logger.info(".1f")

        return df

    def preprocess_data(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
        """
        Preprocess data for training.

        Args:
            data: Raw training data

        Returns:
            Tuple of (X_train, X_test, y_train, y_test)
        """
        logger.info("Preprocessing data...")

        # Separate features and target
        feature_columns = [col for col in data.columns if col != 'maintenance_needed']
        X = data[feature_columns]
        y = data['maintenance_needed']

        # Split data with stratification
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=self.config['test_size'],
            random_state=self.config['random_seed'],
            stratify=y
        )

        logger.info(f"Train set: {X_train.shape[0]} samples ({y_train.sum()} positive)")
        logger.info(f"Test set: {X_test.shape[0]} samples ({y_test.sum()} positive)")

        return X_train, X_test, y_train, y_test

    def handle_class_imbalance(self, X_train: pd.DataFrame, y_train: pd.Series) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Handle class imbalance using SMOTE.

        Args:
            X_train: Training features
            y_train: Training target

        Returns:
            Balanced training data
        """
        if not self.config['handle_imbalance']:
            return X_train, y_train

        logger.info("Handling class imbalance with SMOTE...")

        try:
            # Scale features first
            scaler = StandardScaler()
            X_train_scaled = pd.DataFrame(
                scaler.fit_transform(X_train),
                columns=X_train.columns,
                index=X_train.index
            )

            # Apply SMOTE
            smote = SMOTE(
                sampling_strategy=self.config['smote_sampling_strategy'],
                random_state=self.config['random_seed']
            )

            X_resampled, y_resampled = smote.fit_resample(X_train_scaled, y_train)

            # Convert back to DataFrame
            X_resampled = pd.DataFrame(X_resampled, columns=X_train.columns)

            logger.info(f"SMOTE applied: {len(X_train)} -> {len(X_resampled)} samples")
            logger.info(f"New class distribution: {y_resampled.value_counts().to_dict()}")

            return X_resampled, y_resampled

        except Exception as e:
            logger.error(f"Error applying SMOTE: {e}")
            logger.info("Continuing without SMOTE")
            return X_train, y_train

    def train_model(self, data: pd.DataFrame) -> dict:
        """
        Train the predictive maintenance model.

        Args:
            data: Training data

        Returns:
            Training results and metrics
        """
        logger.info("Starting predictive maintenance model training...")

        try:
            # Preprocess data
            X_train, X_test, y_train, y_test = self.preprocess_data(data)

            # Handle class imbalance
            X_train_balanced, y_train_balanced = self.handle_class_imbalance(X_train, y_train)

            # Create a temporary dataframe for the optimizer
            training_data = X_train_balanced.copy()
            training_data['maintenance_needed'] = y_train_balanced

            # Add required columns that the optimizer expects
            required_cols = ['vibration', 'motor_current', 'bearing_temp']
            for col in required_cols:
                if col not in training_data.columns:
                    # Map existing columns to required ones
                    if col == 'vibration':
                        training_data[col] = training_data.get('vibration', training_data.get('temperature', 0) * 0.1)
                    elif col == 'motor_current':
                        training_data[col] = training_data.get('motor_current', training_data.get('energy_consumption', 10))
                    elif col == 'bearing_temp':
                        training_data[col] = training_data.get('bearing_temp', training_data.get('temperature', 30))

            # Train using optimizer
            results = self.optimizer.train_predictive_maintenance(training_data)

            # Additional evaluation
            test_predictions = []
            test_probabilities = []

            for _, row in X_test.iterrows():
                # Prepare row data for prediction
                row_dict = row.to_dict()
                # Add required columns for prediction
                row_dict.update({
                    'vibration': row_dict.get('vibration', row_dict.get('temperature', 0) * 0.1),
                    'motor_current': row_dict.get('motor_current', row_dict.get('energy_consumption', 10)),
                    'bearing_temp': row_dict.get('bearing_temp', row_dict.get('temperature', 30))
                })

                pred = self.optimizer.predict_maintenance(row_dict)
                test_predictions.append(pred['maintenance_score'] > 0.5)  # Binary prediction
                test_probabilities.append(pred['maintenance_score'])

            # Calculate additional metrics
            from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

            test_accuracy = accuracy_score(y_test, test_predictions)
            test_precision = precision_score(y_test, test_predictions, zero_division=0)
            test_recall = recall_score(y_test, test_predictions, zero_division=0)
            test_f1 = f1_score(y_test, test_predictions, zero_division=0)

            # ROC AUC if probabilities are available
            try:
                test_auc = roc_auc_score(y_test, test_probabilities)
            except:
                test_auc = None

            # Add test metrics to results
            results['test_metrics'] = {
                'accuracy': float(test_accuracy),
                'precision': float(test_precision),
                'recall': float(test_recall),
                'f1_score': float(test_f1),
                'auc': float(test_auc) if test_auc else None,
                'confusion_matrix': confusion_matrix(y_test, test_predictions).tolist()
            }

            logger.info("Predictive maintenance model training completed")
            logger.info(".4f")
            logger.info(".4f")

            return results

        except Exception as e:
            logger.error(f"Error during model training: {e}")
            raise

    def create_visualizations(self, data: pd.DataFrame, results: dict):
        """Create training visualizations."""
        if not self.config['save_plots']:
            return

        logger.info("Creating training visualizations...")

        try:
            # Set style
            plt.style.use('default')
            sns.set_palette("husl")

            # 1. Class distribution
            plt.figure(figsize=(8, 6))
            class_counts = data['maintenance_needed'].value_counts()
            sns.barplot(x=class_counts.index.astype(str), y=class_counts.values)
            plt.title('Maintenance Need Class Distribution')
            plt.xlabel('Maintenance Needed (0=No, 1=Yes)')
            plt.ylabel('Count')
            plt.savefig(os.path.join(self.output_dir, 'plots', 'class_distribution.png'),
                       dpi=300, bbox_inches='tight')
            plt.close()

            # 2. Feature distributions by class
            feature_cols = ['temperature', 'pressure', 'vibration', 'motor_current']
            fig, axes = plt.subplots(2, 2, figsize=(15, 10))
            axes = axes.ravel()

            for i, col in enumerate(feature_cols):
                if col in data.columns:
                    sns.boxplot(data=data, x='maintenance_needed', y=col, ax=axes[i])
                    axes[i].set_title(f'{col.title()} by Maintenance Need')

            plt.tight_layout()
            plt.savefig(os.path.join(self.output_dir, 'plots', 'feature_distributions.png'),
                       dpi=300, bbox_inches='tight')
            plt.close()

            # 3. Correlation heatmap
            plt.figure(figsize=(12, 8))
            numeric_cols = data.select_dtypes(include=[np.number]).columns
            correlation_matrix = data[numeric_cols].corr()

            sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0,
                       fmt='.2f', square=True)
            plt.title('Feature Correlation Matrix')
            plt.tight_layout()
            plt.savefig(os.path.join(self.output_dir, 'plots', 'feature_correlation.png'),
                       dpi=300, bbox_inches='tight')
            plt.close()

            # 4. Confusion Matrix (if available)
            if 'test_metrics' in results and 'confusion_matrix' in results['test_metrics']:
                cm = np.array(results['test_metrics']['confusion_matrix'])

                plt.figure(figsize=(8, 6))
                sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                           xticklabels=['No Maintenance', 'Maintenance Needed'],
                           yticklabels=['No Maintenance', 'Maintenance Needed'])
                plt.title('Confusion Matrix')
                plt.ylabel('True Label')
                plt.xlabel('Predicted Label')
                plt.savefig(os.path.join(self.output_dir, 'plots', 'confusion_matrix.png'),
                           dpi=300, bbox_inches='tight')
                plt.close()

            logger.info("Visualizations created successfully")

        except Exception as e:
            logger.error(f"Error creating visualizations: {e}")

    def save_training_report(self, data: pd.DataFrame, results: dict):
        """Save comprehensive training report."""
        logger.info("Saving training report...")

        try:
            report = {
                'training_metadata': {
                    'timestamp': datetime.now().isoformat(),
                    'model_version': self.config['model_version'],
                    'data_samples': len(data),
                    'config': self.config,
                    'data_source': 'synthetic' if not os.path.exists(self.config['data_path']) else 'file'
                },
                'data_summary': {
                    'shape': data.shape,
                    'columns': list(data.columns),
                    'class_distribution': data['maintenance_needed'].value_counts().to_dict(),
                    'class_balance_ratio': data['maintenance_needed'].value_counts().min() / data['maintenance_needed'].value_counts().max(),
                    'missing_values': data.isnull().sum().to_dict()
                },
                'training_results': results,
                'performance_analysis': {
                    'test_accuracy': results.get('test_metrics', {}).get('accuracy'),
                    'test_f1_score': results.get('test_metrics', {}).get('f1_score'),
                    'recommendations': self._generate_training_recommendations(results)
                }
            }

            # Save report
            report_path = os.path.join(self.output_dir, 'training_report.json')
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2, default=str)

            logger.info(f"Training report saved to {report_path}")

        except Exception as e:
            logger.error(f"Error saving training report: {e}")

    def _generate_training_recommendations(self, results: dict) -> list:
        """Generate training recommendations based on results."""
        recommendations = []

        test_metrics = results.get('test_metrics', {})

        if results.get('success', False):
            accuracy = test_metrics.get('accuracy', 0)
            f1_score = test_metrics.get('f1_score', 0)

            if accuracy > 0.9 and f1_score > 0.85:
                recommendations.append("Excellent model performance - model is ready for production")
            elif accuracy > 0.8 and f1_score > 0.75:
                recommendations.append("Good model performance - monitor for improvements with more data")
            elif accuracy > 0.7 and f1_score > 0.6:
                recommendations.append("Moderate performance - consider feature engineering or more data")
            else:
                recommendations.append("Poor performance - significant improvements needed")

            # Check for class imbalance issues
            precision = test_metrics.get('precision', 0)
            recall = test_metrics.get('recall', 0)

            if precision < 0.5 and recall > 0.8:
                recommendations.append("High recall but low precision - model may be too sensitive")
            elif precision > 0.8 and recall < 0.5:
                recommendations.append("High precision but low recall - model may miss maintenance needs")

        else:
            recommendations.append("Training failed - check data quality and model configuration")

        return recommendations

    def run_training_pipeline(self) -> dict:
        """
        Run the complete training pipeline.

        Returns:
            Training results
        """
        logger.info("Starting maintenance model training pipeline...")

        try:
            # Load data
            data = self.load_training_data()

            # Train model
            results = self.train_model(data)

            # Create visualizations
            self.create_visualizations(data, results)

            # Save models
            if self.config['save_models']:
                self.optimizer.save_models(os.path.join(self.output_dir, 'models'))

            # Save training report
            self.save_training_report(data, results)

            logger.info("Training pipeline completed successfully")
            return results

        except Exception as e:
            logger.error(f"Training pipeline failed: {e}")
            raise

def main():
    """Main training function."""
    parser = argparse.ArgumentParser(description='Train Predictive Maintenance Model')
    parser.add_argument('--config', '-c', type=str, help='Path to training configuration file')
    parser.add_argument('--data', '-d', type=str, help='Path to training data file')
    parser.add_argument('--output', '-o', type=str, help='Output directory')
    parser.add_argument('--samples', '-n', type=int, default=5000,
                       help='Number of synthetic samples to generate')

    args = parser.parse_args()

    # Override config with command line arguments
    config = {}
    if args.config:
        config['config_path'] = args.config
    if args.data:
        config['data_path'] = args.data
    if args.output:
        config['output_dir'] = args.output

    # Create trainer and run training
    trainer = MaintenanceModelTrainer(**config)

    # Generate synthetic data if needed
    if args.samples and not os.path.exists(trainer.config['data_path']):
        trainer.generate_synthetic_maintenance_data(args.samples)

    results = trainer.run_training_pipeline()

    # Print summary
    print("\n" + "="*50)
    print("MAINTENANCE MODEL TRAINING COMPLETED")
    print("="*50)
    print(f"Training Samples: {results.get('training_samples', 'Unknown')}")
    test_metrics = results.get('test_metrics', {})
    print(".4f")
    print(".4f")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*50)

if __name__ == '__main__':
    main()