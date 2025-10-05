import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { PerformanceTrend } from '../../types';

interface PerformanceChartProps {
  data: PerformanceTrend[];
}

type ChartType = 'efficiency' | 'energy' | 'carbon' | 'cost';

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  const theme = useTheme();
  const [chartType, setChartType] = useState<ChartType>('efficiency');

  const handleChartTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newChartType: ChartType | null,
  ) => {
    if (newChartType !== null) {
      setChartType(newChartType);
    }
  };

  // Format data for the selected chart type
  const getChartData = () => {
    return data.map((item) => ({
      date: item.date.toLocaleDateString(),
      efficiency: item.efficiency,
      energy: item.energyConsumption,
      carbon: item.carbonCaptured,
      cost: item.cost,
      uptime: item.uptime,
    }));
  };

  const chartData = getChartData();

  const getChartConfig = () => {
    switch (chartType) {
      case 'efficiency':
        return {
          dataKey: 'efficiency',
          name: 'Efficiency (%)',
          color: theme.palette.primary.main,
          domain: [80, 95],
        };
      case 'energy':
        return {
          dataKey: 'energy',
          name: 'Energy Consumption (kWh)',
          color: theme.palette.warning.main,
          domain: [8000, 10000],
        };
      case 'carbon':
        return {
          dataKey: 'carbon',
          name: 'CO₂ Captured (tons)',
          color: theme.palette.success.main,
          domain: [4000, 5000],
        };
      case 'cost':
        return {
          dataKey: 'cost',
          name: 'Cost ($)',
          color: theme.palette.secondary.main,
          domain: [180000, 200000],
        };
      default:
        return {
          dataKey: 'efficiency',
          name: 'Efficiency (%)',
          color: theme.palette.primary.main,
          domain: [80, 95],
        };
    }
  };

  const chartConfig = getChartConfig();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            p: 1,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body1" color={chartConfig.color}>
            {chartConfig.name}: {payload[0].value?.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Uptime: {data.uptime}%
          </Typography>
        </Box>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Performance Trends
          </Typography>

          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={handleChartTypeChange}
            size="small"
          >
            <ToggleButton value="efficiency">Efficiency</ToggleButton>
            <ToggleButton value="energy">Energy</ToggleButton>
            <ToggleButton value="carbon">Carbon</ToggleButton>
            <ToggleButton value="cost">Cost</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box height={300}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={chartConfig.domain}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={chartConfig.dataKey}
                stroke={chartConfig.color}
                strokeWidth={3}
                dot={{ fill: chartConfig.color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: chartConfig.color, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>

        {/* Summary Statistics */}
        <Box mt={2} display="flex" justifyContent="space-around">
          <Box textAlign="center">
            <Typography variant="h6" color={chartConfig.color}>
              {chartType === 'efficiency' && `${data[data.length - 1]?.efficiency.toFixed(1)}%`}
              {chartType === 'energy' && `${(data[data.length - 1]?.energyConsumption / 1000).toFixed(1)}M kWh`}
              {chartType === 'carbon' && `${(data[data.length - 1]?.carbonCaptured / 1000).toFixed(1)}K tons`}
              {chartType === 'cost' && `$${(data[data.length - 1]?.cost / 1000).toFixed(0)}K`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Current
            </Typography>
          </Box>

          <Box textAlign="center">
            <Typography variant="h6" color="success.main">
              {(() => {
                if (data.length < 2) return '0%';
                const latest = data[data.length - 1];
                const previous = data[data.length - 2];
                let current, prev;

                switch (chartType) {
                  case 'efficiency':
                    current = latest.efficiency;
                    prev = previous.efficiency;
                    break;
                  case 'energy':
                    current = latest.energyConsumption;
                    prev = previous.energyConsumption;
                    break;
                  case 'carbon':
                    current = latest.carbonCaptured;
                    prev = previous.carbonCaptured;
                    break;
                  case 'cost':
                    current = latest.cost;
                    prev = previous.cost;
                    break;
                  default:
                    return '0%';
                }

                const change = ((current - prev) / prev) * 100;
                return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
              })()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Change (24h)
            </Typography>
          </Box>

          <Box textAlign="center">
            <Typography variant="h6">
              {(() => {
                if (data.length === 0) return '0';
                const values = data.map(d => {
                  switch (chartType) {
                    case 'efficiency': return d.efficiency;
                    case 'energy': return d.energyConsumption;
                    case 'carbon': return d.carbonCaptured;
                    case 'cost': return d.cost;
                    default: return 0;
                  }
                });
                const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                return chartType === 'cost' ? `$${(avg / 1000).toFixed(0)}K` : avg.toFixed(1);
              })()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              7-Day Average
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;
