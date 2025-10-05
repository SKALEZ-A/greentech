import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  Box,
} from '@mui/material';
import {
  KeyboardArrowDown as ArrowDownIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Analytics as AnalyticsIcon,
  Report as ReportIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

const QuickActions: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>('');

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleActionClick = (action: string) => {
    setDialogType(action);
    setDialogOpen(true);
    handleClose();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogType('');
  };

  const handleActionSubmit = () => {
    // Handle the action submission
    console.log(`Executing action: ${dialogType}`);
    // In a real app, this would call an API
    handleDialogClose();
  };

  const actions = [
    {
      label: 'Refresh Dashboard',
      icon: <RefreshIcon />,
      action: 'refresh',
      description: 'Refresh all dashboard data',
    },
    {
      label: 'Add New Unit',
      icon: <AddIcon />,
      action: 'add_unit',
      description: 'Register a new carbon capture unit',
    },
    {
      label: 'Run AI Analysis',
      icon: <AnalyticsIcon />,
      action: 'ai_analysis',
      description: 'Trigger AI optimization analysis',
    },
    {
      label: 'Generate Report',
      icon: <ReportIcon />,
      action: 'generate_report',
      description: 'Create a performance report',
    },
    {
      label: 'System Settings',
      icon: <SettingsIcon />,
      action: 'settings',
      description: 'Configure system settings',
    },
  ];

  return (
    <>
      <Button
        variant="contained"
        endIcon={<ArrowDownIcon />}
        onClick={handleClick}
      >
        Quick Actions
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {actions.map((action) => (
          <MenuItem
            key={action.action}
            onClick={() => handleActionClick(action.action)}
          >
            <ListItemIcon>
              {action.icon}
            </ListItemIcon>
            <ListItemText
              primary={action.label}
              secondary={action.description}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Action Dialogs */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        {dialogType === 'refresh' && (
          <>
            <DialogTitle>Refresh Dashboard</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Refresh all dashboard data with the latest information from the network?
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDialogClose}>Cancel</Button>
              <Button onClick={handleActionSubmit} variant="contained">
                Refresh
              </Button>
            </DialogActions>
          </>
        )}

        {dialogType === 'add_unit' && (
          <>
            <DialogTitle>Add New Unit</DialogTitle>
            <DialogContent>
              <DialogContentText mb={2}>
                Register a new carbon capture unit to the network.
              </DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                label="Unit Name"
                fullWidth
                variant="outlined"
              />
              <TextField
                margin="dense"
                label="Location"
                fullWidth
                variant="outlined"
              />
              <TextField
                margin="dense"
                label="Capacity (tons CO₂/day)"
                type="number"
                fullWidth
                variant="outlined"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDialogClose}>Cancel</Button>
              <Button onClick={handleActionSubmit} variant="contained">
                Add Unit
              </Button>
            </DialogActions>
          </>
        )}

        {dialogType === 'ai_analysis' && (
          <>
            <DialogTitle>Run AI Analysis</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Trigger AI optimization analysis across all units in the network.
                This may take several minutes to complete.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDialogClose}>Cancel</Button>
              <Button onClick={handleActionSubmit} variant="contained">
                Start Analysis
              </Button>
            </DialogActions>
          </>
        )}

        {dialogType === 'generate_report' && (
          <>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogContent>
              <DialogContentText mb={2}>
                Generate a comprehensive performance report.
              </DialogContentText>
              <TextField
                select
                fullWidth
                label="Report Type"
                defaultValue="performance"
                variant="outlined"
              >
                <MenuItem value="performance">Performance Report</MenuItem>
                <MenuItem value="environmental">Environmental Impact</MenuItem>
                <MenuItem value="financial">Financial Summary</MenuItem>
              </TextField>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDialogClose}>Cancel</Button>
              <Button onClick={handleActionSubmit} variant="contained">
                Generate
              </Button>
            </DialogActions>
          </>
        )}

        {dialogType === 'settings' && (
          <>
            <DialogTitle>System Settings</DialogTitle>
            <DialogContent>
              <DialogContentText mb={2}>
                Configure system-wide settings and preferences.
              </DialogContentText>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="AI Analysis Frequency"
                  select
                  defaultValue="daily"
                  fullWidth
                >
                  <MenuItem value="hourly">Every Hour</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                </TextField>
                <TextField
                  label="Alert Threshold - Efficiency (%)"
                  type="number"
                  defaultValue={85}
                  fullWidth
                />
                <TextField
                  label="Maintenance Reminder (days)"
                  type="number"
                  defaultValue={30}
                  fullWidth
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDialogClose}>Cancel</Button>
              <Button onClick={handleActionSubmit} variant="contained">
                Save Settings
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default QuickActions;
