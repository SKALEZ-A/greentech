#!/usr/bin/env python3
"""
Efficiency Model Training Script

This script trains the carbon capture efficiency prediction model using historical data.
"""

import sys
import os
import json
import logging
import argparse
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import matplotlib.pyplot as plt
import seaborn as sns

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.optimization_model import CarbonCaptureOptimizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('efficiency_training.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class EfficiencyModelTrainer:
    """Trainer class for carbon capture efficiency models."""

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
            'output_dir': 'training_output/efficiency',
            'data_path': 'data/training/carbon_capture_training_data.json',
            'test_size': 0.2,
            'validation_size': 0.1,
            'epochs': 100,
            'batch_size': 32,
            'early_stopping_patience': 10,
            'hyperparameter_tuning': False,
            'cross_validation_folds': 5,
            'feature_selection': True,
            'save_plots': True,
            'save_models': True
        }

        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                user_config = json.load(f)
            default_config.update(user_config)

        return default_config

    def load_training_data(self) -> pd.DataFrame:
        """
        Load and preprocess training data.

        Returns:
            Preprocessed training dataframe
        """
        logger.info(f"Loading training data from {self.config['data_path']}")

        try:
            # Load data from JSON file
            with open(self.config['data_path'], 'r') as f:
                data = json.load(f)

            # Convert to DataFrame
            df = pd.DataFrame(data)

            logger.info(f"Loaded {len(df)} training samples")

            # Basic data validation
            required_columns = ['temperature', 'pressure', 'flow_rate', 'humidity',
                              'air_quality', 'energy_consumption', 'co2_concentration',
                              'unit_age_days', 'maintenance_days_since', 'efficiency_predicted']

            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")

            # Data quality checks
            logger.info("Performing data quality checks...")

            # Check for missing values
            missing_counts = df.isnull().sum()
            if missing_counts.sum() > 0:
                logger.warning(f"Found missing values:\n{missing_counts[missing_counts > 0]}")
                # Fill missing values
                df = df.fillna(df.mean())

            # Check for outliers (simple z-score based outlier detection)
            numeric_columns = df.select_dtypes(include=[np.number]).columns
            for col in numeric_columns:
                z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())
                outliers = (z_scores > 3).sum()
                if outliers > 0:
                    logger.warning(f"Column {col} has {outliers} outliers (z-score > 3)")

            # Data summary
            logger.info("Data summary:")
            logger.info(f"Shape: {df.shape}")
            logger.info(f"Columns: {list(df.columns)}")
            logger.info(f"Target distribution: {df['efficiency_predicted'].describe()}")

            return df

        except Exception as e:
            logger.error(f"Error loading training data: {e}")
            raise

    def preprocess_data(self, data: pd.DataFrame) -> tuple:
        """
        Preprocess data for training.

        Args:
            data: Raw training data

        Returns:
            Tuple of (X_train, X_test, y_train, y_test, feature_names)
        """
        logger.info("Preprocessing data...")

        # Separate features and target
        feature_columns = [col for col in data.columns if col != 'efficiency_predicted']
        X = data[feature_columns]
        y = data['efficiency_predicted']

        # First split: train + validation vs test
        X_temp, X_test, y_temp, y_test = train_test_split(
            X, y,
            test_size=self.config['test_size'],
            random_state=self.config['random_seed']
        )

        # Second split: train vs validation
        val_size = self.config['validation_size'] / (1 - self.config['test_size'])
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp,
            test_size=val_size,
            random_state=self.config['random_seed']
        )

        logger.info(f"Train set: {X_train.shape[0]} samples")
        logger.info(f"Validation set: {X_val.shape[0]} samples")
        logger.info(f"Test set: {X_test.shape[0]} samples")

        # For now, return train and test (validation handled in model training)
        return X_train, X_test, y_train, y_test, feature_columns

    def train_model(self, data: pd.DataFrame) -> dict:
        """
        Train the efficiency prediction model.

        Args:
            data: Training data

        Returns:
            Training results and metrics
        """
        logger.info("Starting model training...")

        try:
            # Train the model using the optimizer
            results = self.optimizer.train_efficiency_model(data)

            # Additional evaluation on test set
            X_train, X_test, y_train, y_test, feature_names = self.preprocess_data(data)

            # Get predictions on test set
            test_predictions = []
            for _, row in X_test.iterrows():
                pred = self.optimizer.predict_efficiency(row.to_dict())
                test_predictions.append(pred['predicted_efficiency'])

            # Calculate additional metrics
            test_mse = mean_squared_error(y_test, test_predictions)
            test_rmse = np.sqrt(test_mse)
            test_mae = mean_absolute_error(y_test, test_predictions)
            test_r2 = r2_score(y_test, test_predictions)

            # Add test metrics to results
            results['test_metrics'] = {
                'mse': float(test_mse),
                'rmse': float(test_rmse),
                'mae': float(test_mae),
                'r2_score': float(test_r2)
            }

            logger.info("Model training completed")
            logger.info(f"Test R²: {test_r2:.4f}")
            logger.info(f"Test RMSE: {test_rmse:.4f}")

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

            # 1. Feature correlation heatmap
            plt.figure(figsize=(12, 8))
            feature_cols = [col for col in data.columns if col != 'efficiency_predicted']
            correlation_matrix = data[feature_cols + ['efficiency_predicted']].corr()

            sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0,
                       fmt='.2f', square=True)
            plt.title('Feature Correlation Matrix')
            plt.tight_layout()
            plt.savefig(os.path.join(self.output_dir, 'plots', 'feature_correlation.png'),
                       dpi=300, bbox_inches='tight')
            plt.close()

            # 2. Target distribution
            plt.figure(figsize=(10, 6))
            sns.histplot(data['efficiency_predicted'], kde=True, bins=30)
            plt.title('Efficiency Distribution')
            plt.xlabel('Efficiency (%)')
            plt.ylabel('Frequency')
            plt.savefig(os.path.join(self.output_dir, 'plots', 'efficiency_distribution.png'),
                       dpi=300, bbox_inches='tight')
            plt.close()

            # 3. Feature importance plot (if available)
            if 'random_forest' in results.get('metrics', {}):
                rf_model = results['models']['random_forest']['model']
                feature_names = [col for col in data.columns if col != 'efficiency_predicted']
                importance_df = pd.DataFrame({
                    'feature': feature_names,
                    'importance': rf_model.feature_importances_
                }).sort_values('importance', ascending=False)

                plt.figure(figsize=(12, 6))
                sns.barplot(data=importance_df.head(10), x='importance', y='feature')
                plt.title('Top 10 Feature Importance (Random Forest)')
                plt.xlabel('Importance')
                plt.tight_layout()
                plt.savefig(os.path.join(self.output_dir, 'plots', 'feature_importance.png'),
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
                    'config': self.config
                },
                'data_summary': {
                    'shape': data.shape,
                    'columns': list(data.columns),
                    'target_stats': data['efficiency_predicted'].describe().to_dict(),
                    'missing_values': data.isnull().sum().to_dict()
                },
                'training_results': results,
                'performance_analysis': {
                    'best_model': results.get('best_model'),
                    'model_comparison': results.get('metrics', {}),
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

        if results.get('success', False):
            # Check model performance
            best_r2 = results.get('metrics', {}).get(results.get('best_model', ''), {}).get('r2_score', 0)

            if best_r2 > 0.9:
                recommendations.append("Excellent model performance - model is ready for production")
            elif best_r2 > 0.8:
                recommendations.append("Good model performance - consider additional feature engineering")
            elif best_r2 > 0.7:
                recommendations.append("Moderate performance - collect more diverse training data")
            else:
                recommendations.append("Poor performance - significant improvements needed")

            # Check for overfitting
            train_r2 = results.get('metrics', {}).get(results.get('best_model', ''), {}).get('r2_score', 0)
            test_r2 = results.get('test_metrics', {}).get('r2_score', 0)

            if abs(train_r2 - test_r2) > 0.1:
                recommendations.append("Potential overfitting detected - consider regularization or more data")

        else:
            recommendations.append("Training failed - check data quality and model configuration")

        return recommendations

    def run_training_pipeline(self) -> dict:
        """
        Run the complete training pipeline.

        Returns:
            Training results
        """
        logger.info("Starting efficiency model training pipeline...")

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
    parser = argparse.ArgumentParser(description='Train Carbon Capture Efficiency Model')
    parser.add_argument('--config', '-c', type=str, help='Path to training configuration file')
    parser.add_argument('--data', '-d', type=str, help='Path to training data file')
    parser.add_argument('--output', '-o', type=str, help='Output directory')

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
    trainer = EfficiencyModelTrainer(**config)
    results = trainer.run_training_pipeline()

    # Print summary
    print("\n" + "="*50)
    print("EFFICIENCY MODEL TRAINING COMPLETED")
    print("="*50)
    print(f"Best Model: {results.get('best_model', 'Unknown')}")
    print(".4f")
    print(f"Training Samples: {results.get('training_samples', 'Unknown')}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*50)

if __name__ == '__main__':
    main()