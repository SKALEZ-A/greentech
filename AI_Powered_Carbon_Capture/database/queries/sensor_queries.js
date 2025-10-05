/**
 * Sensor Data Queries
 * Predefined queries for sensor data operations
 */

const sensorQueries = {
  // Get latest readings for all sensors
  getLatestSensorReadings: () => ({
    pipeline: [
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: "$sensor_id",
          latestReading: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$latestReading" }
      }
    ]
  }),

  // Get sensor readings within time range
  getSensorReadingsInRange: (sensorId, startTime, endTime) => ({
    sensor_id: sensorId,
    timestamp: {
      $gte: new Date(startTime),
      $lte: new Date(endTime)
    }
  }),

  // Get sensor statistics
  getSensorStatistics: (sensorId, hours = 24) => ({
    pipeline: [
      {
        $match: {
          sensor_id: sensorId,
          timestamp: {
            $gte: new Date(Date.now() - hours * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: "$sensor_id",
          count: { $sum: 1 },
          avg_value: { $avg: "$value" },
          min_value: { $min: "$value" },
          max_value: { $max: "$value" },
          std_dev: { $stdDevPop: "$value" },
          latest_reading: { $max: "$timestamp" },
          readings: { $push: "$value" }
        }
      },
      {
        $project: {
          sensor_id: "$_id",
          count: 1,
          avg_value: { $round: ["$avg_value", 3] },
          min_value: { $round: ["$min_value", 3] },
          max_value: { $round: ["$max_value", 3] },
          std_dev: { $round: ["$std_dev", 3] },
          latest_reading: 1,
          range: { $subtract: ["$max_value", "$min_value"] },
          quality_distribution: {
            good: { $size: { $filter: { input: "$readings", cond: { $eq: ["$$this.quality", "good"] } } } },
            fair: { $size: { $filter: { input: "$readings", cond: { $eq: ["$$this.quality", "fair"] } } } },
            poor: { $size: { $filter: { input: "$readings", cond: { $eq: ["$$this.quality", "poor"] } } } }
          }
        }
      }
    ]
  }),

  // Get sensors by unit
  getSensorsByUnit: (unitId) => ({
    unit_id: unitId
  }),

  // Get sensors with alerts
  getSensorsWithAlerts: (hours = 1) => ({
    pipeline: [
      {
        $match: {
          timestamp: {
            $gte: new Date(Date.now() - hours * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: "$sensor_id",
          unit_id: { $first: "$unit_id" },
          sensor_type: { $first: "$sensor_type" },
          latest_value: { $last: "$value" },
          latest_timestamp: { $last: "$timestamp" },
          avg_value: { $avg: "$value" },
          reading_count: { $sum: 1 },
          anomaly_count: {
            $sum: { $cond: ["$metadata.is_anomaly", 1, 0] }
          },
          quality_counts: {
            good: { $sum: { $cond: [{ $eq: ["$quality", "good"] }, 1, 0] } },
            fair: { $sum: { $cond: [{ $eq: ["$quality", "fair"] }, 1, 0] } },
            poor: { $sum: { $cond: [{ $eq: ["$quality", "poor"] }, 1, 0] } }
          }
        }
      },
      {
        $project: {
          sensor_id: "$_id",
          unit_id: 1,
          sensor_type: 1,
          latest_value: 1,
          latest_timestamp: 1,
          avg_value: { $round: ["$avg_value", 3] },
          reading_count: 1,
          anomaly_rate: {
            $round: [{ $divide: ["$anomaly_count", "$reading_count"] }, 3]
          },
          quality_distribution: "$quality_counts",
          has_alerts: {
            $or: [
              { $gt: ["$anomaly_rate", 0.1] },
              { $gt: ["$quality_counts.poor", 0] }
            ]
          }
        }
      },
      {
        $match: {
          has_alerts: true
        }
      }
    ]
  }),

  // Get sensor data for AI model training
  getSensorDataForTraining: (sensorId, days = 30) => ({
    sensor_id: sensorId,
    timestamp: {
      $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    },
    quality: { $ne: "poor" } // Exclude poor quality data
  }),

  // Get hourly aggregations
  getHourlyAggregations: (sensorId, days = 7) => ({
    pipeline: [
      {
        $match: {
          sensor_id: sensorId,
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" }
          },
          avg_value: { $avg: "$value" },
          min_value: { $min: "$value" },
          max_value: { $max: "$value" },
          count: { $sum: 1 },
          anomaly_count: {
            $sum: { $cond: ["$metadata.is_anomaly", 1, 0] }
          }
        }
      },
      {
        $sort: { "_id": 1 }
      },
      {
        $project: {
          timestamp: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
              hour: "$_id.hour"
            }
          },
          avg_value: { $round: ["$avg_value", 3] },
          min_value: { $round: ["$min_value", 3] },
          max_value: { $round: ["$max_value", 3] },
          count: 1,
          anomaly_rate: {
            $round: [{ $divide: ["$anomaly_count", "$count"] }, 3]
          }
        }
      }
    ]
  }),

  // Get sensor correlations
  getSensorCorrelations: (unitId, sensorTypes, hours = 24) => ({
    pipeline: [
      {
        $match: {
          unit_id: unitId,
          sensor_type: { $in: sensorTypes },
          timestamp: {
            $gte: new Date(Date.now() - hours * 60 * 60 * 1000)
          }
        }
      },
      {
        $sort: { timestamp: 1 }
      },
      {
        $group: {
          _id: {
            sensor_type: "$sensor_type",
            time_bucket: {
              $dateTrunc: {
                date: "$timestamp",
                unit: "minute",
                binSize: 5
              }
            }
          },
          avg_value: { $avg: "$value" }
        }
      },
      {
        $sort: { "_id.time_bucket": 1, "_id.sensor_type": 1 }
      },
      {
        $group: {
          _id: "$_id.time_bucket",
          sensor_values: {
            $push: {
              type: "$_id.sensor_type",
              value: "$avg_value"
            }
          }
        }
      }
    ]
  }),

  // Get sensor health report
  getSensorHealthReport: (unitId = null, days = 7) => ({
    pipeline: [
      {
        $match: {
          ...(unitId && { unit_id: unitId }),
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            unit_id: "$unit_id",
            sensor_id: "$sensor_id",
            sensor_type: "$sensor_type"
          },
          total_readings: { $sum: 1 },
          anomaly_count: {
            $sum: { $cond: ["$metadata.is_anomaly", 1, 0] }
          },
          quality_counts: {
            good: { $sum: { $cond: [{ $eq: ["$quality", "good"] }, 1, 0] } },
            fair: { $sum: { $cond: [{ $eq: ["$quality", "fair"] }, 1, 0] } },
            poor: { $sum: { $cond: [{ $eq: ["$quality", "poor"] }, 1, 0] } }
          },
          avg_calibration_drift: { $avg: "$metadata.calibration_drift" },
          latest_timestamp: { $max: "$timestamp" }
        }
      },
      {
        $project: {
          unit_id: "$_id.unit_id",
          sensor_id: "$_id.sensor_id",
          sensor_type: "$_id.sensor_type",
          total_readings: 1,
          anomaly_rate: {
            $round: [{ $divide: ["$anomaly_count", "$total_readings"] }, 4]
          },
          quality_distribution: "$quality_counts",
          avg_calibration_drift: { $round: ["$avg_calibration_drift", 4] },
          latest_timestamp: 1,
          health_score: {
            $round: [
              {
                $multiply: [
                  {
                    $subtract: [
                      100,
                      {
                        $add: [
                          { $multiply: [{ $divide: ["$anomaly_count", "$total_readings"] }, 50] },
                          { $multiply: [{ $divide: ["$quality_counts.poor", "$total_readings"] }, 30] },
                          { $multiply: ["$avg_calibration_drift", 20] }
                        ]
                      }
                    ]
                  },
                  0.01
                ]
              },
              1
            ]
          }
        }
      },
      {
        $sort: { health_score: 1 } // Sort by health score ascending (worse health first)
      }
    ]
  })
};

module.exports = sensorQueries;
