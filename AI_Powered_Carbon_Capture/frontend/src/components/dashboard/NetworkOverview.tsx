import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Eco as EcoIcon,
  Flash as FlashIcon,
  MonetizationOn as MonetizationOnIcon,
} from '@mui/icons-material';
import { NetworkStatistics } from '../../types';

interface NetworkOverviewProps {
  data: NetworkStatistics;
}

const NetworkOverview: React.FC<NetworkOverviewProps> = ({ data }) => {
  const efficiencyColor = data.currentEfficiency >= 85 ? 'success' : data.currentEfficiency >= 75 ? 'warning' : 'error';
  const uptimeColor = data.performanceMetrics.averageUptime >= 95 ? 'success' : data.performanceMetrics.averageUptime >= 90 ? 'warning' : 'error';

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Network Overview
        </Typography>

        <Grid container spacing={3}>
          {/* Total Units */}
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <BusinessIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h4" color="primary.main">
                {data.totalUnits}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Total Units
            </Typography>
            <Box display="flex" alignItems="center" mt={1}>
              <CheckCircleIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
              <Typography variant="caption" color="success.main">
                {data.activeUnits} Active
              </Typography>
            </Box>
          </Grid>

          {/* Total Capacity */}
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <EcoIcon color="secondary" sx={{ mr: 1 }} />
              <Typography variant="h4" color="secondary.main">
                {data.totalCapacity.toLocaleString()}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Tons CO₂/Day Capacity
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {data.totalCarbonCaptured.toLocaleString()} tons captured total
            </Typography>
          </Grid>

          {/* Current Efficiency */}
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <TrendingUpIcon color={efficiencyColor} sx={{ mr: 1 }} />
              <Typography variant="h4" color={`${efficiencyColor}.main`}>
                {data.currentEfficiency.toFixed(1)}%
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Average Efficiency
            </Typography>
            <Box mt={1}>
              <LinearProgress
                variant="determinate"
                value={data.currentEfficiency}
                color={efficiencyColor}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          </Grid>

          {/* Revenue Generated */}
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <MonetizationOnIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h4" color="success.main">
                ${(data.revenueGenerated / 1000000).toFixed(1)}M
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Revenue Generated
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ${data.performanceMetrics.costPerTon}/ton CO₂ cost
            </Typography>
          </Grid>

          {/* Performance Metrics */}
          <Grid item xs={12}>
            <Box mt={2}>
              <Typography variant="subtitle1" gutterBottom>
                Performance Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                    <Typography variant="h6" color={`${uptimeColor}.main`}>
                      {data.performanceMetrics.averageUptime.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Average Uptime
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                    <Typography variant="h6">
                      {data.performanceMetrics.energyIntensity}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      kWh/Ton CO₂
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                    <Typography variant="h6" color="success.main">
                      {data.performanceMetrics.roi.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ROI
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                    <Typography variant="h6">
                      {data.performanceMetrics.maintenanceFrequency}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Days Between Maintenance
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Geographic Distribution */}
          <Grid item xs={12}>
            <Box mt={2}>
              <Typography variant="subtitle1" gutterBottom>
                Geographic Distribution
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {data.geographicDistribution.map((country) => (
                  <Chip
                    key={country.country}
                    label={`${country.country}: ${country.units} units`}
                    variant="outlined"
                    size="small"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default NetworkOverview;
