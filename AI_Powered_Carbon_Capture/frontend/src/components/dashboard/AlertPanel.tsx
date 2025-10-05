import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Done as DoneIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Alert as AlertType } from '../../types';

interface AlertPanelProps {
  alerts: AlertType[];
}

const AlertPanel: React.FC<AlertPanelProps> = ({ alerts }) => {
  const [selectedAlert, setSelectedAlert] = useState<AlertType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getSeverityIcon = (severity: AlertType['severity']) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getSeverityColor = (severity: AlertType['severity']) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleAlertClick = (alert: AlertType) => {
    setSelectedAlert(alert);
    setDialogOpen(true);
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    // In a real app, this would call an API
    console.log('Acknowledging alert:', alertId);
    // For now, just close the dialog
    setDialogOpen(false);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedAlert(null);
  };

  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              System Alerts
            </Typography>
            <Chip
              label={`${activeAlerts.length} active`}
              color={activeAlerts.length > 0 ? 'warning' : 'success'}
              size="small"
            />
          </Box>

          {activeAlerts.length === 0 ? (
            <Box textAlign="center" py={4}>
              <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" color="success.main">
                All Clear
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No active alerts at this time
              </Typography>
            </Box>
          ) : (
            <List dense>
              {activeAlerts.slice(0, 5).map((alert) => (
                <ListItem
                  key={alert.id}
                  button
                  onClick={() => handleAlertClick(alert)}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon>
                    {getSeverityIcon(alert.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight="medium">
                        {alert.title}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {alert.message.length > 50
                            ? `${alert.message.substring(0, 50)}...`
                            : alert.message
                          }
                        </Typography>
                        <Box display="flex" alignItems="center" mt={0.5}>
                          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                            {formatTimeAgo(alert.createdAt)}
                          </Typography>
                          <Chip
                            label={alert.severity}
                            size="small"
                            color={getSeverityColor(alert.severity)}
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcknowledgeAlert(alert.id);
                      }}
                    >
                      <DoneIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}

              {activeAlerts.length > 5 && (
                <Box textAlign="center" mt={2}>
                  <Typography variant="caption" color="text.secondary">
                    And {activeAlerts.length - 5} more alerts...
                  </Typography>
                </Box>
              )}
            </List>
          )}

          {acknowledgedAlerts.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Recently Acknowledged ({acknowledgedAlerts.length})
              </Typography>
              <List dense>
                {acknowledgedAlerts.slice(0, 3).map((alert) => (
                  <ListItem key={alert.id} sx={{ opacity: 0.7 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="caption" sx={{ textDecoration: 'line-through' }}>
                          {alert.title}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          Acknowledged {formatTimeAgo(alert.acknowledgedAt!)}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Alert Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            {selectedAlert && getSeverityIcon(selectedAlert.severity)}
            <Typography variant="h6" sx={{ ml: 1 }}>
              {selectedAlert?.title}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedAlert?.message}
          </DialogContentText>

          {selectedAlert && (
            <Box mt={2}>
              <Box display="flex" gap={1} mb={2}>
                <Chip
                  label={`Severity: ${selectedAlert.severity}`}
                  color={getSeverityColor(selectedAlert.severity)}
                  size="small"
                />
                <Chip
                  label={`Type: ${selectedAlert.type}`}
                  variant="outlined"
                  size="small"
                />
                {selectedAlert.unitId && (
                  <Chip
                    label={`Unit: ${selectedAlert.unitId}`}
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>

              <Typography variant="body2" color="text.secondary">
                Created: {selectedAlert.createdAt.toLocaleString()}
              </Typography>

              {selectedAlert.acknowledged && selectedAlert.acknowledgedBy && (
                <Typography variant="body2" color="text.secondary">
                  Acknowledged by: {selectedAlert.acknowledgedBy} at {selectedAlert.acknowledgedAt?.toLocaleString()}
                </Typography>
              )}

              {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Additional Details
                  </Typography>
                  <Box component="pre" sx={{ fontSize: '0.75rem', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                    {JSON.stringify(selectedAlert.metadata, null, 2)}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          {selectedAlert && !selectedAlert.acknowledged && (
            <Button
              onClick={() => handleAcknowledgeAlert(selectedAlert.id)}
              variant="contained"
              color="primary"
            >
              Acknowledge Alert
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AlertPanel;
