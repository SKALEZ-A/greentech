import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

// Import types
import { DashboardData, Alert as AlertType, NetworkStatistics } from '../types';

// Import components
import Layout from '../components/layout/Layout';
import NetworkOverview from '../components/dashboard/NetworkOverview';
import PerformanceChart from '../components/dashboard/PerformanceChart';
import AlertPanel from '../components/dashboard/AlertPanel';
import CarbonCreditMarket from '../components/dashboard/CarbonCreditMarket';
import EnvironmentalImpact from '../components/dashboard/EnvironmentalImpact';
import QuickActions from '../components/dashboard/QuickActions';

// Mock data for development
const mockDashboardData: DashboardData = {
  summary: {
    totalUnits: 45,
    activeUnits: 42,
    totalCapacity: 1250,
    currentEfficiency: 87.5,
    totalCarbonCaptured: 45600,
    energyConsumption: 8900,
    carbonCreditsIssued: 45200,
    revenueGenerated: 2150000,
    geographicDistribution: [
      { country: 'United States', units: 28, capacity: 780, efficiency: 89.2, carbonCaptured: 28900 },
      { country: 'Germany', units: 8, capacity: 240, efficiency: 85.1, carbonCaptured: 8900 },
      { country: 'Canada', units: 6, capacity: 180, efficiency: 88.7, carbonCaptured: 6700 },
      { country: 'Japan', units: 3, capacity: 50, efficiency: 82.3, carbonCaptured: 1100 },
    ],
    performanceMetrics: {
      averageUptime: 96.8,
      averageEfficiency: 87.5,
      maintenanceFrequency: 45,
      energyIntensity: 195,
      costPerTon: 47.25,
      roi: 28.5,
    },
  },
  alerts: [
    {
      id: 'alert-1',
      type: 'maintenance',
      severity: 'warning',
      title: 'Maintenance Due',
      message: 'Unit CCU-001 requires scheduled maintenance within 7 days',
      unitId: 'CCU-001',
      acknowledged: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: 'alert-2',
      type: 'performance',
      severity: 'info',
      title: 'Efficiency Optimization Available',
      message: 'AI suggests 3.2% efficiency improvement for Unit CCU-015',
      unitId: 'CCU-015',
      acknowledged: false,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    },
    {
      id: 'alert-3',
      type: 'system',
      severity: 'critical',
      title: 'Sensor Offline',
      message: 'CO2 sensor in Unit CCU-023 is offline',
      unitId: 'CCU-023',
      acknowledged: true,
      acknowledgedBy: 'john.doe@example.com',
      acknowledgedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    },
  ],
  recentActivity: [
    {
      id: 'activity-1',
      type: 'credit_transaction',
      title: 'Carbon Credits Sold',
      description: '100 tons of carbon credits sold for $4,250',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: 'activity-2',
      type: 'optimization',
      title: 'AI Optimization Applied',
      description: 'Efficiency improved by 2.1% across 5 units',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'activity-3',
      type: 'maintenance',
      title: 'Maintenance Completed',
      description: 'Unit CCU-012 maintenance completed successfully',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
  ],
  performanceTrends: [
    { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), efficiency: 85.2, energyConsumption: 9200, carbonCaptured: 4200, cost: 198000, uptime: 95.8 },
    { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), efficiency: 86.1, energyConsumption: 9100, carbonCaptured: 4350, cost: 195000, uptime: 96.2 },
    { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), efficiency: 87.3, energyConsumption: 8950, carbonCaptured: 4520, cost: 192000, uptime: 97.1 },
    { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), efficiency: 86.8, energyConsumption: 9000, carbonCaptured: 4480, cost: 193500, uptime: 96.5 },
    { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), efficiency: 87.9, energyConsumption: 8820, carbonCaptured: 4650, cost: 190000, uptime: 97.3 },
    { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), efficiency: 88.2, energyConsumption: 8750, carbonCaptured: 4720, cost: 188500, uptime: 97.8 },
    { date: new Date(), efficiency: 87.5, energyConsumption: 8900, carbonCaptured: 4610, cost: 191000, uptime: 96.8 },
  ],
  carbonCreditMarket: {
    currentPrice: 42.50,
    priceChange24h: 2.3,
    volume24h: 1250,
    marketCap: 1920000,
    recentTransactions: [
      {
        id: 'tx-1',
        buyer: 'GreenCorp Industries',
        seller: 'CarbonTech Solutions',
        amount: 100,
        price: 42.50,
        total: 4250,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        txHash: '0x1234567890abcdef',
      },
      {
        id: 'tx-2',
        buyer: 'EcoEnergy Corp',
        seller: 'ClimateCapture Ltd',
        amount: 250,
        price: 42.30,
        total: 10575,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        txHash: '0xabcdef1234567890',
      },
    ],
  },
  environmentalImpact: {
    totalCO2Captured: 45600,
    equivalentCarsRemoved: 892000,
    equivalentTreesPlanted: 1140000,
    carbonFootprintReduction: 23.5,
    renewableEnergyUsage: 67.8,
    sustainabilityMetrics: [
      { name: 'Air Quality Index', value: 45, unit: 'AQI', target: 50, trend: 'improving' },
      { name: 'Water Usage Efficiency', value: 89.2, unit: '%', target: 85, trend: 'improving' },
      { name: 'Waste Reduction', value: 94.1, unit: '%', target: 90, trend: 'stable' },
      { name: 'Biodiversity Impact', value: 7.8, unit: 'score', target: 8, trend: 'improving' },
    ],
  },
};

interface HomeProps {
  initialData?: DashboardData;
}

const Home: React.FC<HomeProps> = ({ initialData }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData>(initialData || mockDashboardData);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // In a real app, this would be an API call
      // const response = await fetch('/api/dashboard');
      // const data = await response.json();

      // For now, simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update with slightly modified data to simulate real-time updates
      const updatedData = {
        ...dashboardData,
        summary: {
          ...dashboardData.summary,
          currentEfficiency: dashboardData.summary.currentEfficiency + (Math.random() - 0.5) * 0.5,
        },
      };

      setDashboardData(updatedData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchDashboardData();
  };

  return (
    <Layout>
      <Head>
        <title>Carbon Capture Network - Dashboard</title>
        <meta name="description" content="AI-powered carbon capture network dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Container maxWidth="xl">
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
          Carbon Capture Network Dashboard
        </Typography>
            <Typography variant="body2" color="text.secondary">
              Last updated: {lastUpdate.toLocaleString()}
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
            <QuickActions />
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Main Dashboard Grid */}
        <Grid container spacing={3}>
          {/* Network Overview */}
          <Grid item xs={12} lg={8}>
            <NetworkOverview data={dashboardData.summary} />
          </Grid>

          {/* Key Metrics Cards */}
          <Grid item xs={12} lg={4}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} lg={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="h6" color="primary">
                          ${dashboardData.summary.revenueGenerated.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Revenue Generated
                        </Typography>
                      </Box>
                      <TrendingUpIcon color="primary" />
                    </Box>
                  </CardContent>
                </Card>
          </Grid>

              <Grid item xs={12} sm={6} lg={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="h6" color="secondary">
                          {dashboardData.summary.totalCarbonCaptured.toLocaleString()} tons
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          CO₂ Captured
                        </Typography>
                      </Box>
                      <CheckCircleIcon color="secondary" />
                    </Box>
                  </CardContent>
                </Card>
          </Grid>
        </Grid>
          </Grid>

          {/* Performance Chart */}
          <Grid item xs={12} lg={8}>
            <PerformanceChart data={dashboardData.performanceTrends} />
          </Grid>

          {/* Alerts Panel */}
          <Grid item xs={12} lg={4}>
            <AlertPanel alerts={dashboardData.alerts} />
          </Grid>

          {/* Carbon Credit Market */}
          <Grid item xs={12} lg={6}>
            <CarbonCreditMarket data={dashboardData.carbonCreditMarket} />
        </Grid>

          {/* Environmental Impact */}
          <Grid item xs={12} lg={6}>
            <EnvironmentalImpact data={dashboardData.environmentalImpact} />
          </Grid>

          {/* Recent Activity */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                <Box>
                  {dashboardData.recentActivity.map((activity) => (
                    <Box
                      key={activity.id}
                      display="flex"
                      alignItems="center"
                      py={1}
                      borderBottom={1}
                      borderColor="divider"
                    >
                      <Box flexGrow={1}>
                        <Typography variant="body1" fontWeight="medium">
                        {activity.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activity.description}
                      </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {activity.timestamp.toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
};

// Server-side rendering for initial data
export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // In a real app, fetch data from API
    // const response = await fetch(`${process.env.API_URL}/api/dashboard`);
    // const initialData = await response.json();

    return {
      props: {
        initialData: mockDashboardData,
      },
    };
  } catch (error) {
    console.error('Failed to fetch initial dashboard data:', error);
    return {
      props: {
        initialData: mockDashboardData,
      },
    };
  }
};

export default Home;