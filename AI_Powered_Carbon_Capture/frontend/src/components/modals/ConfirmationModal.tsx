import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert
} from '@mui/material';
import { Warning, Info, Error, CheckCircle } from '@mui/icons-material';

export type ConfirmationSeverity = 'info' | 'warning' | 'error' | 'success';

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: ConfirmationSeverity;
  loading?: boolean;
  additionalContent?: React.ReactNode;
}

const getSeverityIcon = (severity: ConfirmationSeverity) => {
  switch (severity) {
    case 'warning':
      return <Warning color="warning" />;
    case 'error':
      return <Error color="error" />;
    case 'success':
      return <CheckCircle color="success" />;
    case 'info':
    default:
      return <Info color="info" />;
  }
};

const getSeverityColor = (severity: ConfirmationSeverity) => {
  switch (severity) {
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'success':
      return 'success';
    case 'info':
    default:
      return 'primary';
  }
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
  loading = false,
  additionalContent
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="confirmation-dialog-title" sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getSeverityIcon(severity)}
          <Typography variant="h6" component="span">
            {title}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <DialogContentText id="confirmation-dialog-description" sx={{ mb: 2 }}>
          {message}
        </DialogContentText>

        {additionalContent && (
          <Box sx={{ mt: 2 }}>
            {additionalContent}
          </Box>
        )}

        {severity === 'error' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            This action cannot be undone.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          variant="outlined"
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={loading}
          variant="contained"
          color={getSeverityColor(severity)}
          autoFocus
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
