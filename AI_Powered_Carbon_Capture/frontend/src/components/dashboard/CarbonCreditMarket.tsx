import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  MonetizationOn as MonetizationOnIcon,
} from '@mui/icons-material';
import { MarketData } from '../../types';

interface CarbonCreditMarketProps {
  data: MarketData;
}

const CarbonCreditMarket: React.FC<CarbonCreditMarketProps> = ({ data }) => {
  const priceChangeColor = data.priceChange24h >= 0 ? 'success' : 'error';
  const priceChangeIcon = data.priceChange24h >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Carbon Credit Market
        </Typography>

        {/* Market Overview */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Box display="flex" alignItems="center" mb={1}>
              <MonetizationOnIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h4" color="primary.main">
                ${data.currentPrice.toFixed(2)}
              </Typography>
              <Box display="flex" alignItems="center" ml={1}>
                {priceChangeIcon}
                <Typography
                  variant="body2"
                  color={`${priceChangeColor}.main`}
                  sx={{ ml: 0.5 }}
                >
                  {data.priceChange24h >= 0 ? '+' : ''}{data.priceChange24h.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Current Price per Ton CO₂
            </Typography>
          </Box>

          <Box textAlign="right">
            <Typography variant="h6">
              ${(data.marketCap / 1000000).toFixed(1)}M
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Market Cap
            </Typography>
          </Box>
        </Box>

        {/* Market Stats */}
        <Box display="flex" justifyContent="space-around" mb={3}>
          <Box textAlign="center">
            <Typography variant="h6" color="success.main">
              {data.volume24h.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              24h Volume (tons)
            </Typography>
          </Box>

          <Box textAlign="center">
            <Typography variant="h6">
              {data.recentTransactions.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Recent Transactions
            </Typography>
          </Box>
        </Box>

        {/* Recent Transactions */}
        <Typography variant="subtitle1" gutterBottom>
          Recent Transactions
        </Typography>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Buyer</TableCell>
                <TableCell>Seller</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.recentTransactions.map((transaction) => (
                <TableRow key={transaction.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {transaction.buyer.length > 15
                        ? `${transaction.buyer.substring(0, 15)}...`
                        : transaction.buyer
                      }
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {transaction.seller.length > 15
                        ? `${transaction.seller.substring(0, 15)}...`
                        : transaction.seller
                      }
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${transaction.amount}t`}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      ${transaction.price.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      ${transaction.total.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {transaction.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {data.recentTransactions.length === 0 && (
          <Box textAlign="center" py={3}>
            <Typography variant="body2" color="text.secondary">
              No recent transactions
            </Typography>
          </Box>
        )}

        {/* Market Health Indicator */}
        <Box mt={2}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary">
              Market Activity
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {data.volume24h > 1000 ? 'High' : data.volume24h > 500 ? 'Medium' : 'Low'}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min((data.volume24h / 2000) * 100, 100)}
            color={data.volume24h > 1000 ? 'success' : data.volume24h > 500 ? 'warning' : 'error'}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default CarbonCreditMarket;
