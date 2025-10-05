import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Eco as EcoIcon,
  DriveEta as CarIcon,
  Nature as TreeIcon,
  TrendingUp as TrendingUpIcon,
  Flash as FlashIcon,
} from '@mui/icons-material';
import { EnvironmentalImpact as EnvironmentalImpactType } from '../../types';

interface EnvironmentalImpactProps {
  data: EnvironmentalImpactType;
}

const EnvironmentalImpact: React.FC<EnvironmentalImpactProps> = ({ data }) => {
  const getTrendIcon = (trend: string) => {
    return trend === 'improving' ? '↗️' : trend === 'declining' ? '↘️' : '➡️';
  };

  const getTrendColor = (trend: string) => {
    return trend === 'improving' ? 'success' : trend === 'declining' ? 'error' : 'warning';
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Environmental Impact
        </Typography>

        {/* Key Impact Metrics */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6}>
            <Box display="flex" alignItems="center" mb={1}>
              <EcoIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h5" color="success.main">
                {data.totalCO2Captured.toLocaleString()}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Tons of CO₂ Captured
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box display="flex" alignItems="center" mb={1}>
              <FlashIcon color="warning" sx={{ mr: 1 }} />
              <Typography variant="h5" color="warning.main">
                {data.renewableEnergyUsage.toFixed(1)}%
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Renewable Energy Usage
            </Typography>
          </Grid>
        </Grid>

        {/* Equivalent Impact */}
        <Box mb={3}>
          <Typography variant="subtitle1" gutterBottom>
            Equivalent Impact
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                <CarIcon color="action" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6">
                  {data.equivalentCarsRemoved.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cars removed from roads for 1 year
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6}>
              <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                <TreeIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h6">
                  {data.equivalentTreesPlanted.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Trees planted for 10 years
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Carbon Footprint Reduction */}
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">
              Carbon Footprint Reduction
            </Typography>
            <Typography variant="body2" color="success.main">
              {data.carbonFootprintReduction.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={data.carbonFootprintReduction}
            color="success"
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Sustainability Metrics */}
        <Typography variant="subtitle1" gutterBottom>
          Sustainability Metrics
        </Typography>

        <Box>
          {data.sustainabilityMetrics.map((metric, index) => (
            <Box key={index} mb={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2">
                  {metric.name}
                </Typography>
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" fontWeight="medium" sx={{ mr: 1 }}>
                    {metric.value}{metric.unit}
                  </Typography>
                  <Chip
                    label={`${getTrendIcon(metric.trend)} ${metric.trend}`}
                    size="small"
                    color={getTrendColor(metric.trend)}
                    variant="outlined"
                  />
                </Box>
              </Box>

              {metric.target && (
                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={(metric.value / metric.target) * 100}
                    color={metric.value >= metric.target ? 'success' : 'warning'}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Target: {metric.target}{metric.unit}
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {/* Impact Summary */}
        <Box mt={3} p={2} bgcolor="success.light" borderRadius={1}>
          <Typography variant="body2" color="success.contrastText">
            <strong>Impact Summary:</strong> This network has captured enough CO₂ to offset the annual emissions
            of {Math.floor(data.equivalentCarsRemoved / 1000)}K passenger vehicles or provide clean air
            equivalent to {Math.floor(data.equivalentTreesPlanted / 1000000)} million mature trees.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EnvironmentalImpact;
