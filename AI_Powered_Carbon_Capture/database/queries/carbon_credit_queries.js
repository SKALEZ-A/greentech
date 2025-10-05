/**
 * Carbon Credit Queries
 * Predefined queries for carbon credit trading and analytics
 */

const carbonCreditQueries = {
  // Get active carbon credits for trading
  getActiveCarbonCredits: (issuer = null, minAmount = 0) => ({
    pipeline: [
      {
        $match: {
          ...(issuer && { issuer: issuer }),
          status: "active",
          amount_available: { $gte: minAmount }
        }
      },
      {
        $lookup: {
          from: "carboncreditransactions",
          localField: "_id",
          foreignField: "credit_id",
          as: "transactions"
        }
      },
      {
        $project: {
          _id: 1,
          token_id: 1,
          issuer: 1,
          project_id: 1,
          project_name: 1,
          vintage_year: 1,
          amount_total: 1,
          amount_available: 1,
          amount_retired: 1,
          methodology: 1,
          region: 1,
          price_per_ton: 1,
          last_transaction_price: {
            $ifNull: [
              { $max: "$transactions.price_per_ton" },
              "$price_per_ton"
            ]
          },
          transaction_count: { $size: "$transactions" },
          last_transaction_date: { $max: "$transactions.timestamp" },
          market_demand_score: {
            $round: [
              {
                $add: [
                  { $multiply: [{ $divide: ["$amount_available", "$amount_total"] }, 0.4] },
                  { $multiply: ["$transaction_count", 0.1] },
                  {
                    $multiply: [
                      {
                        $cond: {
                          if: { $gte: ["$vintage_year", 2020] },
                          then: 1,
                          else: 0.8
                        }
                      },
                      0.5
                    ]
                  }
                ]
              },
              2
            ]
          }
        }
      },
      {
        $sort: { market_demand_score: -1, last_transaction_date: -1 }
      }
    ]
  }),

  // Get carbon credit trading history
  getCarbonCreditTradingHistory: (creditId = null, days = 90) => ({
    pipeline: [
      {
        $match: {
          ...(creditId && { credit_id: creditId }),
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $lookup: {
          from: "carboncredits",
          localField: "credit_id",
          foreignField: "_id",
          as: "credit_info"
        }
      },
      {
        $unwind: {
          path: "$credit_info",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            credit_id: "$credit_id",
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp"
              }
            }
          },
          transactions: {
            $push: {
              transaction_id: "$_id",
              buyer: "$buyer",
              seller: "$seller",
              amount: "$amount",
              price_per_ton: "$price_per_ton",
              total_value: "$total_value",
              timestamp: "$timestamp"
            }
          },
          daily_volume: { $sum: "$amount" },
          daily_value: { $sum: "$total_value" },
          avg_price: { $avg: "$price_per_ton" },
          min_price: { $min: "$price_per_ton" },
          max_price: { $max: "$price_per_ton" },
          transaction_count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.credit_id",
          credit_info: {
            $first: {
              project_name: "$credit_info.project_name",
              issuer: "$credit_info.issuer",
              vintage_year: "$credit_info.vintage_year",
              methodology: "$credit_info.methodology"
            }
          },
          daily_stats: {
            $push: {
              date: "$_id.date",
              volume: "$daily_volume",
              value: "$daily_value",
              avg_price: "$avg_price",
              min_price: "$min_price",
              max_price: "$max_price",
              transaction_count: "$transaction_count",
              transactions: "$transactions"
            }
          },
          total_volume: { $sum: "$daily_volume" },
          total_value: { $sum: "$daily_value" },
          avg_price_overall: { $avg: "$avg_price" },
          price_volatility: {
            $stdDevPop: "$avg_price"
          },
          total_transactions: { $sum: "$transaction_count" }
        }
      },
      {
        $project: {
          credit_id: "$_id",
          credit_info: 1,
          total_volume: 1,
          total_value: { $round: ["$total_value", 2] },
          avg_price_overall: { $round: ["$avg_price_overall", 2] },
          price_volatility: { $round: ["$price_volatility", 2] },
          total_transactions: 1,
          price_trend: {
            $round: [
              {
                $divide: [
                  {
                    $subtract: [
                      { $last: "$daily_stats.avg_price" },
                      { $first: "$daily_stats.avg_price" }
                    ]
                  },
                  { $first: "$daily_stats.avg_price" }
                ]
              },
              4
            ]
          },
          daily_stats: {
            $sortArray: {
              input: "$daily_stats",
              sortBy: { date: -1 }
            }
          }
        }
      },
      {
        $sort: { total_volume: -1 }
      }
    ]
  }),

  // Get carbon credit market statistics
  getCarbonCreditMarketStats: (days = 30) => ({
    pipeline: [
      {
        $match: {
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp"
              }
            }
          },
          daily_volume: { $sum: "$amount" },
          daily_value: { $sum: "$total_value" },
          avg_price: { $avg: "$price_per_ton" },
          min_price: { $min: "$price_per_ton" },
          max_price: { $max: "$price_per_ton" },
          transaction_count: { $sum: 1 },
          unique_credits: { $addToSet: "$credit_id" }
        }
      },
      {
        $sort: { "_id.date": 1 }
      },
      {
        $group: {
          _id: null,
          daily_stats: {
            $push: {
              date: "$_id.date",
              volume: "$daily_volume",
              value: "$daily_value",
              avg_price: "$avg_price",
              min_price: "$min_price",
              max_price: "$max_price",
              transaction_count: "$transaction_count",
              unique_credits: { $size: "$unique_credits" }
            }
          },
          total_volume: { $sum: "$daily_volume" },
          total_value: { $sum: "$total_value" },
          avg_price_overall: { $avg: "$avg_price" },
          price_volatility: { $stdDevPop: "$avg_price" },
          total_transactions: { $sum: "$transaction_count" },
          active_trading_days: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          total_volume: 1,
          total_value: { $round: ["$total_value", 2] },
          avg_price_overall: { $round: ["$avg_price_overall", 2] },
          price_volatility: { $round: ["$price_volatility", 2] },
          total_transactions: 1,
          active_trading_days: 1,
          avg_daily_volume: { $round: [{ $divide: ["$total_volume", "$active_trading_days"] }, 0] },
          avg_daily_transactions: { $round: [{ $divide: ["$total_transactions", "$active_trading_days"] }, 1] },
          price_trend: {
            $round: [
              {
                $divide: [
                  {
                    $subtract: [
                      { $last: "$daily_stats.avg_price" },
                      { $first: "$daily_stats.avg_price" }
                    ]
                  },
                  { $first: "$daily_stats.avg_price" }
                ]
              },
              4
            ]
          },
          volume_trend: {
            $round: [
              {
                $divide: [
                  {
                    $subtract: [
                      { $last: "$daily_stats.volume" },
                      { $first: "$daily_stats.volume" }
                    ]
                  },
                  { $first: "$daily_stats.volume" }
                ]
              },
              4
            ]
          },
          market_summary: {
            highest_price_day: {
              $first: {
                $sortArray: {
                  input: "$daily_stats",
                  sortBy: { max_price: -1 }
                }
              }
            },
            highest_volume_day: {
              $first: {
                $sortArray: {
                  input: "$daily_stats",
                  sortBy: { volume: -1 }
                }
              }
            },
            most_active_day: {
              $first: {
                $sortArray: {
                  input: "$daily_stats",
                  sortBy: { transaction_count: -1 }
                }
              }
            }
          },
          daily_stats: 1
        }
      }
    ]
  }),

  // Get top carbon credit issuers
  getTopCarbonCreditIssuers: (limit = 10, days = 365) => ({
    pipeline: [
      {
        $match: {
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $lookup: {
          from: "carboncredits",
          localField: "credit_id",
          foreignField: "_id",
          as: "credit_info"
        }
      },
      {
        $unwind: "$credit_info"
      },
      {
        $group: {
          _id: "$credit_info.issuer",
          total_volume_traded: { $sum: "$amount" },
          total_value_traded: { $sum: "$total_value" },
          avg_price_per_ton: { $avg: "$price_per_ton" },
          transaction_count: { $sum: 1 },
          unique_credits: { $addToSet: "$credit_id" },
          vintages: { $addToSet: "$credit_info.vintage_year" },
          methodologies: { $addToSet: "$credit_info.methodology" }
        }
      },
      {
        $project: {
          issuer: "$_id",
          total_volume_traded: 1,
          total_value_traded: { $round: ["$total_value_traded", 2] },
          avg_price_per_ton: { $round: ["$avg_price_per_ton", 2] },
          transaction_count: 1,
          unique_credits_count: { $size: "$unique_credits" },
          vintage_range: {
            min: { $min: "$vintages" },
            max: { $max: "$vintages" }
          },
          methodologies_used: "$methodologies",
          market_share_percent: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      "$total_value_traded",
                      { $literal: 1000000 } // This would need to be calculated from total market
                    ]
                  },
                  100
                ]
              },
              2
            ]
          }
        }
      },
      {
        $sort: { total_value_traded: -1 }
      },
      {
        $limit: limit
      }
    ]
  }),

  // Get carbon credit retirement statistics
  getCarbonCreditRetirementStats: (issuer = null, days = 365) => ({
    pipeline: [
      {
        $match: {
          ...(issuer && { issuer: issuer }),
          status: "retired"
        }
      },
      {
        $lookup: {
          from: "carboncreditretirements",
          localField: "_id",
          foreignField: "credit_id",
          as: "retirements"
        }
      },
      {
        $unwind: {
          path: "$retirements",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            credit_id: "$_id",
            issuer: "$issuer"
          },
          credit_info: {
            $first: {
              project_name: "$project_name",
              vintage_year: "$vintage_year",
              methodology: "$methodology",
              amount_total: "$amount_total"
            }
          },
          total_retired: {
            $sum: {
              $ifNull: ["$retirements.amount", 0]
            }
          },
          retirement_count: {
            $sum: {
              $cond: [
                { $ne: ["$retirements", null] },
                1,
                0
              ]
            }
          },
          retirement_dates: {
            $addToSet: {
              $cond: [
                { $ne: ["$retirements", null] },
                "$retirements.timestamp",
                null
              ]
            }
          },
          retiree_types: {
            $addToSet: {
              $cond: [
                { $ne: ["$retirements", null] },
                "$retirements.retiree_type",
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          credit_id: "$_id.credit_id",
          issuer: "$_id.issuer",
          credit_info: 1,
          total_retired: 1,
          retirement_count: 1,
          retirement_rate: {
            $round: [
              {
                $divide: ["$total_retired", "$credit_info.amount_total"]
              },
              4
            ]
          },
          avg_retirement_amount: {
            $round: [
              {
                $divide: ["$total_retired", "$retirement_count"]
              },
              2
            ]
          },
          retiree_types: {
            $filter: {
              input: "$retiree_types",
              cond: { $ne: ["$$this", null] }
            }
          },
          last_retirement_date: { $max: "$retirement_dates" }
        }
      },
      {
        $match: {
          total_retired: { $gt: 0 }
        }
      },
      {
        $sort: { total_retired: -1 }
      }
    ]
  }),

  // Get carbon credit price correlations
  getCarbonCreditPriceCorrelations: (days = 90) => ({
    pipeline: [
      {
        $match: {
          timestamp: {
            $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $lookup: {
          from: "carboncredits",
          localField: "credit_id",
          foreignField: "_id",
          as: "credit_info"
        }
      },
      {
        $unwind: "$credit_info"
      },
      {
        $group: {
          _id: {
            vintage_year: "$credit_info.vintage_year",
            methodology: "$credit_info.methodology"
          },
          prices: { $push: "$price_per_ton" },
          avg_price: { $avg: "$price_per_ton" },
          transaction_count: { $sum: 1 }
        }
      },
      {
        $match: {
          transaction_count: { $gte: 10 } // Only include credits with sufficient trading history
        }
      },
      {
        $project: {
          vintage_year: "$_id.vintage_year",
          methodology: "$_id.methodology",
          avg_price: { $round: ["$avg_price", 2] },
          price_std_dev: { $round: [{ $stdDevPop: "$prices" }, 2] },
          transaction_count: 1,
          price_range: {
            min: { $min: "$prices" },
            max: { $max: "$prices" }
          }
        }
      },
      {
        $sort: { avg_price: -1 }
      }
    ]
  }),

  // Get carbon credit sustainability impact
  getCarbonCreditSustainabilityImpact: (days = 365) => ({
    pipeline: [
      {
        $match: {
          status: "retired"
        }
      },
      {
        $lookup: {
          from: "carboncreditretirements",
          localField: "_id",
          foreignField: "credit_id",
          as: "retirements"
        }
      },
      {
        $lookup: {
          from: "carboncredits",
          localField: "_id",
          foreignField: "_id",
          as: "credit_info"
        }
      },
      {
        $unwind: {
          path: "$retirements",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: "$credit_info",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: null,
          total_co2_offset_tons: { $sum: "$amount_retired" },
          credits_retired_count: {
            $addToSet: {
              $cond: [
                { $gt: ["$amount_retired", 0] },
                "$_id",
                null
              ]
            }
          },
          retirements_by_type: {
            $push: {
              retiree_type: "$retirements.retiree_type",
              amount: "$retirements.amount"
            }
          },
          methodology_distribution: {
            $addToSet: "$credit_info.methodology"
          },
          vintage_distribution: {
            $addToSet: "$credit_info.vintage_year"
          }
        }
      },
      {
        $project: {
          _id: 0,
          total_co2_offset_tons: 1,
          total_co2_offset_kg: { $multiply: ["$total_co2_offset_tons", 1000] },
          credits_retired_count: { $size: "$credits_retired_count" },
          avg_retirement_size: {
            $round: [
              {
                $divide: [
                  "$total_co2_offset_tons",
                  "$credits_retired_count"
                ]
              },
              2
            ]
          },
          retiree_type_distribution: {
            $arrayToObject: {
              $map: {
                input: {
                  $group: {
                    _id: "$retirements_by_type.retiree_type",
                    total_amount: { $sum: "$retirements_by_type.amount" }
                  }
                },
                as: "type_group",
                in: {
                  k: "$$type_group._id",
                  v: "$$type_group.total_amount"
                }
              }
            }
          },
          methodology_distribution: 1,
          vintage_range: {
            earliest: { $min: "$vintage_distribution" },
            latest: { $max: "$vintage_distribution" }
          },
          environmental_impact: {
            trees_equivalent: { $round: [{ $divide: ["$total_co2_offset_tons", 0.05] }, 0] }, // Rough estimate: 1 tree absorbs ~50kg CO2/year
            cars_off_road_year: { $round: [{ $divide: ["$total_co2_offset_tons", 4.6] }, 0] }, // Average car emits ~4.6 tons CO2/year
            homes_electricity_year: { $round: [{ $divide: ["$total_co2_offset_tons", 8.5] }, 0] } // Average home emits ~8.5 tons CO2/year
          }
        }
      }
    ]
  })
};

module.exports = carbonCreditQueries;
