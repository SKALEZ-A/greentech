/**
 * Carbon Capture Unit Queries
 * Predefined queries for unit operations and analytics
 */

const unitQueries = {
  // Get units with latest sensor data
  getUnitsWithLatestData: () => ({
    pipeline: [
      {
        $lookup: {
          from: "sensordata",
          let: { unitId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$unit_id", "$$unitId"] }
              }
            },
            {
              $sort: { timestamp: -1 }
            },
            {
              $group: {
                _id: "$sensor_type",
                latestReading: { $first: "$$ROOT" }
              }
            },
            {
              $replaceRoot: { newRoot: "$latestReading" }
            }
          ],
          as: "latest_sensor_data"
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          type: 1,
          capacity_tons_per_day: 1,
          location: 1,
          status: 1,
          efficiency: 1,
          last_maintenance: 1,
          next_maintenance: 1,
          sensor_count: { $size: "$sensors" },
          active_sensors: {
            $size: {
              $filter: {
                input: "$latest_sensor_data",
                cond: {
                  $and: [
                    { $gte: ["$$this.timestamp", { $dateSubtract: { startDate: "$$NOW", unit: "hour", amount: 1 } }] },
                    { $ne: ["$$this.quality", "poor"] }
                  ]
                }
              }
            }
          },
          latest_readings: {
            $arrayToObject: {
              $map: {
                input: "$latest_sensor_data",
                as: "reading",
                in: {
                  k: "$$reading.sensor_type",
                  v: {
                    value: "$$reading.value",
                    timestamp: "$$reading.timestamp",
                    quality: "$$reading.quality",
                    unit: "$$reading.unit"
                  }
                }
              }
            }
          }
        }
      }
    ]
  }),

  // Get unit performance metrics
  getUnitPerformanceMetrics: (unitId, days = 30) => ({
    pipeline: [
      {
        $match: {
          _id: unitId
        }
      },
      {
        $lookup: {
          from: "sensordata",
          let: { unitId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$unit_id", "$$unitId"] },
                timestamp: {
                  $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                }
              }
            },
            {
              $group: {
                _id: {
                  sensor_type: "$sensor_type",
                  date: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: "$timestamp"
                    }
                  }
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
              $group: {
                _id: "$_id.sensor_type",
                daily_stats: {
                  $push: {
                    date: "$_id.date",
                    avg_value: "$avg_value",
                    min_value: "$min_value",
                    max_value: "$max_value",
                    count: "$count",
                    anomaly_rate: { $divide: ["$anomaly_count", "$count"] }
                  }
                },
                total_readings: { $sum: "$count" },
                avg_anomaly_rate: { $avg: { $divide: ["$anomaly_count", "$count"] } }
              }
            }
          ],
          as: "sensor_analytics"
        }
      },
      {
        $project: {
          unit_id: "$_id",
          unit_name: "$name",
          unit_type: "$type",
          capacity: "$capacity_tons_per_day",
          sensor_analytics: 1,
          overall_health: {
            $round: [
              {
                $multiply: [
                  {
                    $subtract: [
                      100,
                      {
                        $avg: {
                          $map: {
                            input: "$sensor_analytics",
                            as: "sensor",
                            in: { $multiply: ["$$sensor.avg_anomaly_rate", 50] }
                          }
                        }
                      }
                    ]
                  },
                  0.01
                ]
              },
              1
            ]
          },
          total_sensor_readings: {
            $sum: "$sensor_analytics.total_readings"
          }
        }
      }
    ]
  }),

  // Get units requiring maintenance
  getUnitsRequiringMaintenance: () => ({
    pipeline: [
      {
        $match: {
          $or: [
            { next_maintenance: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
            { efficiency: { $lt: 70 } },
            { status: "warning" }
          ]
        }
      },
      {
        $lookup: {
          from: "sensordata",
          let: { unitId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$unit_id", "$$unitId"] },
                timestamp: {
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                }
              }
            },
            {
              $group: {
                _id: "$sensor_type",
                anomaly_count: {
                  $sum: { $cond: ["$metadata.is_anomaly", 1, 0] }
                },
                total_count: { $sum: 1 }
              }
            },
            {
              $project: {
                sensor_type: "$_id",
                anomaly_rate: { $divide: ["$anomaly_count", "$total_count"] }
              }
            }
          ],
          as: "recent_sensor_health"
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          type: 1,
          status: 1,
          efficiency: 1,
          last_maintenance: 1,
          next_maintenance: 1,
          days_until_maintenance: {
            $round: [
              {
                $divide: [
                  {
                    $subtract: ["$next_maintenance", new Date()]
                  },
                  1000 * 60 * 60 * 24
                ]
              },
              0
            ]
          },
          high_anomaly_sensors: {
            $size: {
              $filter: {
                input: "$recent_sensor_health",
                cond: { $gt: ["$$this.anomaly_rate", 0.1] }
              }
            }
          },
          maintenance_priority: {
            $add: [
              {
                $cond: {
                  if: { $lt: ["$efficiency", 70] },
                  then: 3,
                  else: 0
                }
              },
              {
                $cond: {
                  if: { $lte: ["$next_maintenance", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] },
                  then: 2,
                  else: 0
                }
              },
              {
                $cond: {
                  if: { $gt: ["$status", "normal"] },
                  then: 1,
                  else: 0
                }
              }
            ]
          }
        }
      },
      {
        $sort: { maintenance_priority: -1, days_until_maintenance: 1 }
      }
    ]
  }),

  // Get units by efficiency ranking
  getUnitsByEfficiency: (limit = 10) => ({
    pipeline: [
      {
        $match: {
          efficiency: { $exists: true }
        }
      },
      {
        $sort: { efficiency: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 1,
          name: 1,
          type: 1,
          efficiency: 1,
          capacity_tons_per_day: 1,
          location: 1,
          status: 1,
          last_updated: 1
        }
      }
    ]
  }),

  // Get unit carbon capture statistics
  getUnitCarbonStats: (unitId, days = 30) => ({
    pipeline: [
      {
        $match: {
          _id: unitId
        }
      },
      {
        $lookup: {
          from: "sensordata",
          let: { unitId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$unit_id", "$$unitId"] },
                sensor_type: "co2_concentration",
                timestamp: {
                  $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                }
              }
            },
            {
              $sort: { timestamp: 1 }
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$timestamp"
                  }
                },
                readings: {
                  $push: {
                    timestamp: "$timestamp",
                    inlet_co2: "$value",
                    outlet_co2: "$value" // Assuming we have inlet/outlet sensors
                  }
                },
                avg_inlet_co2: { $avg: "$value" },
                min_inlet_co2: { $min: "$value" },
                max_inlet_co2: { $max: "$value" }
              }
            },
            {
              $project: {
                date: "$_id",
                avg_inlet_co2: { $round: ["$avg_inlet_co2", 2] },
                co2_capture_efficiency: {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            { $subtract: ["$avg_inlet_co2", 350] }, // Assuming outlet CO2 is 350 ppm
                            "$avg_inlet_co2"
                          ]
                        },
                        100
                      ]
                    },
                    2
                  ]
                },
                total_carbon_captured_kg: {
                  $round: [
                    {
                      $multiply: [
                        {
                          $subtract: ["$avg_inlet_co2", 350]
                        },
                        0.001 * 24 * 3600 // Rough estimation
                      ]
                    },
                    0
                  ]
                }
              }
            }
          ],
          as: "carbon_stats"
        }
      },
      {
        $project: {
          unit_id: "$_id",
          unit_name: "$name",
          carbon_stats: 1,
          total_carbon_captured: {
            $sum: "$carbon_stats.total_carbon_captured_kg"
          },
          avg_capture_efficiency: {
            $round: [{ $avg: "$carbon_stats.co2_capture_efficiency" }, 2]
          },
          best_day: {
            $first: {
              $sortArray: {
                input: "$carbon_stats",
                sortBy: { co2_capture_efficiency: -1 }
              }
            }
          },
          worst_day: {
            $first: {
              $sortArray: {
                input: "$carbon_stats",
                sortBy: { co2_capture_efficiency: 1 }
              }
            }
          }
        }
      }
    ]
  }),

  // Get units by location/geography
  getUnitsByLocation: (lat, lng, radiusKm = 100) => ({
    pipeline: [
      {
        $match: {
          "location.latitude": { $exists: true },
          "location.longitude": { $exists: true }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          type: 1,
          location: 1,
          status: 1,
          efficiency: 1,
          capacity_tons_per_day: 1,
          distance: {
            $round: [
              {
                $multiply: [
                  6371, // Earth's radius in km
                  {
                    $acos: {
                      $add: [
                        {
                          $multiply: [
                            { $sin: { $multiply: ["$location.latitude", Math.PI / 180] } },
                            { $sin: { $multiply: [lat, Math.PI / 180] } }
                          ]
                        },
                        {
                          $multiply: [
                            { $cos: { $multiply: ["$location.latitude", Math.PI / 180] } },
                            { $cos: { $multiply: [lat, Math.PI / 180] } },
                            { $cos: { $multiply: [{ $subtract: ["$location.longitude", lng] }, Math.PI / 180] } }
                          ]
                        }
                      ]
                    }
                  }
                ]
              },
              2
            ]
          }
        }
      },
      {
        $match: {
          distance: { $lte: radiusKm }
        }
      },
      {
        $sort: { distance: 1 }
      }
    ]
  }),

  // Get unit operational summary
  getUnitOperationalSummary: () => ({
    pipeline: [
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total_capacity: { $sum: "$capacity_tons_per_day" },
          avg_efficiency: { $avg: "$efficiency" },
          units: { $push: { _id: "$_id", name: "$name", efficiency: "$efficiency" } }
        }
      },
      {
        $project: {
          status: "$_id",
          count: 1,
          total_capacity: { $round: ["$total_capacity", 0] },
          avg_efficiency: { $round: ["$avg_efficiency", 2] },
          efficiency_distribution: {
            excellent: {
              $size: {
                $filter: { input: "$units", cond: { $gte: ["$$this.efficiency", 90] } }
              }
            },
            good: {
              $size: {
                $filter: {
                  input: "$units",
                  cond: {
                    $and: [
                      { $gte: ["$$this.efficiency", 75] },
                      { $lt: ["$$this.efficiency", 90] }
                    ]
                  }
                }
              }
            },
            fair: {
              $size: {
                $filter: {
                  input: "$units",
                  cond: {
                    $and: [
                      { $gte: ["$$this.efficiency", 60] },
                      { $lt: ["$$this.efficiency", 75] }
                    ]
                  }
                }
              }
            },
            poor: {
              $size: {
                $filter: { input: "$units", cond: { $lt: ["$$this.efficiency", 60] } }
              }
            }
          }
        }
      },
      {
        $sort: { status: 1 }
      }
    ]
  })
};

module.exports = unitQueries;
