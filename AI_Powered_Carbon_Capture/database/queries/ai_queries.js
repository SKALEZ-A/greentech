/**
 * AI Analytics Queries
 * Predefined queries for AI model performance and optimization analytics
 */

const aiQueries = {
  // Get AI optimization recommendations
  getOptimizationRecommendations: (unitId = null, days = 7) => ({
    pipeline: [
      {
        $match: {
          ...(unitId && { unit_id: unitId }),
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          },
          "ai_optimization": { $exists: true }
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: unitId ? "$unit_id" : {
            unit_id: "$unit_id",
            optimization_type: "$ai_optimization.type"
          },
          latest_optimization: { $first: "$ai_optimization" },
          optimization_count: { $sum: 1 },
          avg_improvement: { $avg: "$ai_optimization.expected_improvement" },
          total_potential_savings: { $sum: "$ai_optimization.potential_savings" }
        }
      },
      {
        $project: {
          unit_id: unitId ? "$_id" : "$_id.unit_id",
          optimization_type: unitId ? null : "$_id.optimization_type",
          latest_optimization: 1,
          optimization_count: 1,
          avg_improvement: { $round: ["$avg_improvement", 2] },
          total_potential_savings: { $round: ["$total_potential_savings", 2] },
          priority_score: {
            $round: [
              {
                $add: [
                  { $multiply: ["$avg_improvement", 0.6] },
                  { $multiply: [{ $divide: ["$optimization_count", days] }, 0.4] }
                ]
              },
              2
            ]
          }
        }
      },
      {
        $sort: { priority_score: -1 }
      }
    ]
  }),

  // Get AI model performance metrics
  getAIModelPerformance: (modelType = null, days = 30) => ({
    pipeline: [
      {
        $match: {
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          },
          "ai_metrics": { $exists: true },
          ...(modelType && { "ai_metrics.model_type": modelType })
        }
      },
      {
        $group: {
          _id: {
            model_type: "$ai_metrics.model_type",
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp"
              }
            }
          },
          prediction_count: { $sum: 1 },
          avg_accuracy: { $avg: "$ai_metrics.accuracy" },
          avg_precision: { $avg: "$ai_metrics.precision" },
          avg_recall: { $avg: "$ai_metrics.recall" },
          avg_f1_score: { $avg: "$ai_metrics.f1_score" },
          total_predictions: { $sum: "$ai_metrics.prediction_count" },
          false_positives: { $sum: "$ai_metrics.false_positives" },
          false_negatives: { $sum: "$ai_metrics.false_negatives" }
        }
      },
      {
        $group: {
          _id: "$_id.model_type",
          daily_metrics: {
            $push: {
              date: "$_id.date",
              prediction_count: "$prediction_count",
              avg_accuracy: "$avg_accuracy",
              avg_precision: "$avg_precision",
              avg_recall: "$avg_recall",
              avg_f1_score: "$avg_f1_score"
            }
          },
          total_predictions: { $sum: "$total_predictions" },
          avg_accuracy: { $avg: "$avg_accuracy" },
          avg_precision: { $avg: "$avg_precision" },
          avg_recall: { $avg: "$avg_recall" },
          avg_f1_score: { $avg: "$avg_f1_score" },
          total_false_positives: { $sum: "$false_positives" },
          total_false_negatives: { $sum: "$false_negatives" }
        }
      },
      {
        $project: {
          model_type: "$_id",
          total_predictions: 1,
          avg_accuracy: { $round: ["$avg_accuracy", 4] },
          avg_precision: { $round: ["$avg_precision", 4] },
          avg_recall: { $round: ["$avg_recall", 4] },
          avg_f1_score: { $round: ["$avg_f1_score", 4] },
          overall_precision: {
            $round: [
              {
                $divide: [
                  { $subtract: ["$total_predictions", "$total_false_positives"] },
                  "$total_predictions"
                ]
              },
              4
            ]
          },
          performance_trend: {
            $map: {
              input: { $sortArray: { input: "$daily_metrics", sortBy: { date: 1 } } },
              as: "metric",
              in: {
                date: "$$metric.date",
                accuracy: { $round: ["$$metric.avg_accuracy", 4] },
                f1_score: { $round: ["$$metric.avg_f1_score", 4] }
              }
            }
          },
          daily_metrics: 1
        }
      },
      {
        $sort: { avg_f1_score: -1 }
      }
    ]
  }),

  // Get maintenance predictions
  getMaintenancePredictions: (unitId = null, days = 30) => ({
    pipeline: [
      {
        $match: {
          ...(unitId && { unit_id: unitId }),
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          },
          "maintenance_prediction": { $exists: true }
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: unitId ? "$unit_id" : {
            unit_id: "$unit_id",
            component: "$maintenance_prediction.component"
          },
          latest_prediction: { $first: "$maintenance_prediction" },
          prediction_count: { $sum: 1 },
          avg_confidence: { $avg: "$maintenance_prediction.confidence" },
          urgent_predictions: {
            $sum: {
              $cond: [
                { $gte: ["$maintenance_prediction.risk_level", "high"] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          unit_id: unitId ? "$_id" : "$_id.unit_id",
          component: unitId ? null : "$_id.component",
          latest_prediction: 1,
          prediction_count: 1,
          avg_confidence: { $round: ["$avg_confidence", 3] },
          urgent_predictions: 1,
          days_until_maintenance: {
            $round: [
              {
                $divide: [
                  {
                    $subtract: ["$latest_prediction.predicted_date", new Date()]
                  },
                  1000 * 60 * 60 * 24
                ]
              },
              0
            ]
          },
          maintenance_priority: {
            $add: [
              {
                $cond: {
                  if: { $eq: ["$latest_prediction.risk_level", "critical"] },
                  then: 5,
                  else: 0
                }
              },
              {
                $cond: {
                  if: { $eq: ["$latest_prediction.risk_level", "high"] },
                  then: 3,
                  else: 0
                }
              },
              {
                $cond: {
                  if: { $lte: ["$latest_prediction.predicted_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] },
                  then: 2,
                  else: 0
                }
              }
            ]
          }
        }
      },
      {
        $match: {
          days_until_maintenance: { $gte: 0 } // Only future predictions
        }
      },
      {
        $sort: { maintenance_priority: -1, days_until_maintenance: 1 }
      }
    ]
  }),

  // Get energy optimization opportunities
  getEnergyOptimizationOpportunities: (unitId = null, minSavings = 1000) => ({
    pipeline: [
      {
        $match: {
          ...(unitId && { unit_id: unitId }),
          "energy_optimization": { $exists: true },
          "energy_optimization.potential_savings_kwh": { $gte: minSavings }
        }
      },
      {
        $sort: { "energy_optimization.potential_savings_kwh": -1 }
      },
      {
        $group: {
          _id: unitId ? "$unit_id" : {
            unit_id: "$unit_id",
            optimization_type: "$energy_optimization.type"
          },
          latest_optimization: { $first: "$energy_optimization" },
          optimization_count: { $sum: 1 },
          total_potential_savings: { $sum: "$energy_optimization.potential_savings_kwh" },
          avg_payback_months: { $avg: "$energy_optimization.payback_months" },
          max_savings: { $max: "$energy_optimization.potential_savings_kwh" }
        }
      },
      {
        $project: {
          unit_id: unitId ? "$_id" : "$_id.unit_id",
          optimization_type: unitId ? null : "$_id.optimization_type",
          latest_optimization: 1,
          optimization_count: 1,
          total_potential_savings: { $round: ["$total_potential_savings", 0] },
          avg_payback_months: { $round: ["$avg_payback_months", 1] },
          max_savings: 1,
          roi_score: {
            $round: [
              {
                $divide: [
                  "$total_potential_savings",
                  { $multiply: ["$avg_payback_months", 730] } // Rough kWh cost
                ]
              },
              2
            ]
          }
        }
      },
      {
        $sort: { roi_score: -1, total_potential_savings: -1 }
      }
    ]
  }),

  // Get AI-driven efficiency improvements
  getEfficiencyImprovements: (unitId = null, days = 30) => ({
    pipeline: [
      {
        $match: {
          ...(unitId && { unit_id: unitId }),
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          },
          "efficiency_improvement": { $exists: true }
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: unitId ? "$unit_id" : {
            unit_id: "$unit_id",
            improvement_type: "$efficiency_improvement.type"
          },
          latest_improvement: { $first: "$efficiency_improvement" },
          improvement_count: { $sum: 1 },
          total_improvement_percent: { $sum: "$efficiency_improvement.improvement_percent" },
          avg_improvement_percent: { $avg: "$efficiency_improvement.improvement_percent" },
          max_improvement_percent: { $max: "$efficiency_improvement.improvement_percent" },
          implementation_count: {
            $sum: { $cond: ["$efficiency_improvement.implemented", 1, 0] }
          }
        }
      },
      {
        $project: {
          unit_id: unitId ? "$_id" : "$_id.unit_id",
          improvement_type: unitId ? null : "$_id.improvement_type",
          latest_improvement: 1,
          improvement_count: 1,
          total_improvement_percent: { $round: ["$total_improvement_percent", 2] },
          avg_improvement_percent: { $round: ["$avg_improvement_percent", 2] },
          max_improvement_percent: { $round: ["$max_improvement_percent", 2] },
          implementation_rate: {
            $round: [{ $divide: ["$implementation_count", "$improvement_count"] }, 3]
          },
          potential_impact: {
            $round: [
              {
                $multiply: ["$avg_improvement_percent", "$implementation_rate"]
              },
              2
            ]
          }
        }
      },
      {
        $sort: { potential_impact: -1, max_improvement_percent: -1 }
      }
    ]
  }),

  // Get AI model training metrics
  getModelTrainingMetrics: (modelType = null, limit = 20) => ({
    pipeline: [
      {
        $match: {
          "model_training": { $exists: true },
          ...(modelType && { "model_training.model_type": modelType })
        }
      },
      {
        $sort: { "model_training.training_date": -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          model_type: "$model_training.model_type",
          training_date: "$model_training.training_date",
          training_duration_seconds: "$model_training.training_duration_seconds",
          final_accuracy: "$model_training.final_accuracy",
          final_loss: "$model_training.final_loss",
          epochs: "$model_training.epochs",
          dataset_size: "$model_training.dataset_size",
          hyperparameters: "$model_training.hyperparameters",
          performance_metrics: "$model_training.performance_metrics",
          training_status: "$model_training.training_status",
          improvement_over_previous: {
            $round: [
              {
                $subtract: [
                  "$model_training.final_accuracy",
                  "$model_training.previous_accuracy"
                ]
              },
              4
            ]
          }
        }
      },
      {
        $sort: { training_date: -1 }
      }
    ]
  }),

  // Get predictive analytics summary
  getPredictiveAnalyticsSummary: (days = 30) => ({
    pipeline: [
      {
        $match: {
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          },
          $or: [
            { "ai_optimization": { $exists: true } },
            { "maintenance_prediction": { $exists: true } },
            { "energy_optimization": { $exists: true } },
            { "efficiency_improvement": { $exists: true } }
          ]
        }
      },
      {
        $group: {
          _id: {
            unit_id: "$unit_id",
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp"
              }
            }
          },
          optimization_count: {
            $sum: { $cond: [{ $ne: ["$ai_optimization", null] }, 1, 0] }
          },
          maintenance_predictions: {
            $sum: { $cond: [{ $ne: ["$maintenance_prediction", null] }, 1, 0] }
          },
          energy_optimizations: {
            $sum: { $cond: [{ $ne: ["$energy_optimization", null] }, 1, 0] }
          },
          efficiency_improvements: {
            $sum: { $cond: [{ $ne: ["$efficiency_improvement", null] }, 1, 0] }
          },
          total_predictions: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.unit_id",
          daily_activity: {
            $push: {
              date: "$_id.date",
              optimization_count: "$optimization_count",
              maintenance_predictions: "$maintenance_predictions",
              energy_optimizations: "$energy_optimizations",
              efficiency_improvements: "$efficiency_improvements",
              total_predictions: "$total_predictions"
            }
          },
          total_optimizations: { $sum: "$optimization_count" },
          total_maintenance_predictions: { $sum: "$maintenance_predictions" },
          total_energy_optimizations: { $sum: "$energy_optimizations" },
          total_efficiency_improvements: { $sum: "$efficiency_improvements" },
          total_predictions: { $sum: "$total_predictions" },
          active_days: { $sum: 1 }
        }
      },
      {
        $project: {
          unit_id: "$_id",
          total_predictions: 1,
          total_optimizations: 1,
          total_maintenance_predictions: 1,
          total_energy_optimizations: 1,
          total_efficiency_improvements: 1,
          active_days: 1,
          avg_predictions_per_day: {
            $round: [{ $divide: ["$total_predictions", "$active_days"] }, 1]
          },
          prediction_distribution: {
            optimizations: { $round: [{ $divide: ["$total_optimizations", "$total_predictions"] }, 3] },
            maintenance: { $round: [{ $divide: ["$total_maintenance_predictions", "$total_predictions"] }, 3] },
            energy: { $round: [{ $divide: ["$total_energy_optimizations", "$total_predictions"] }, 3] },
            efficiency: { $round: [{ $divide: ["$total_efficiency_improvements", "$total_predictions"] }, 3] }
          },
          daily_activity: 1
        }
      },
      {
        $sort: { total_predictions: -1 }
      }
    ]
  })
};

module.exports = aiQueries;
