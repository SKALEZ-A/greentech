import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  IconButton,
  Divider
} from '@mui/material';
import { Close, Add, Delete } from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { CarbonCaptureUnit } from '../../types';

interface UnitConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (unit: Partial<CarbonCaptureUnit>) => void;
  unit?: CarbonCaptureUnit | null;
  loading?: boolean;
}

const unitTypes = [
  'direct_air_capture',
  'flue_gas_capture',
  'industrial_process',
  'biomass_capture'
];

const validationSchema = Yup.object({
  name: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be less than 100 characters')
    .required('Name is required'),
  type: Yup.string()
    .oneOf(unitTypes, 'Invalid unit type')
    .required('Type is required'),
  capacity_tons_per_day: Yup.number()
    .min(1, 'Capacity must be at least 1 ton per day')
    .max(10000, 'Capacity cannot exceed 10,000 tons per day')
    .required('Capacity is required'),
  location: Yup.object({
    latitude: Yup.number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .required('Latitude is required'),
    longitude: Yup.number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .required('Longitude is required'),
    address: Yup.string()
      .max(500, 'Address must be less than 500 characters')
  }),
  description: Yup.string()
    .max(1000, 'Description must be less than 1000 characters'),
  operating_hours_per_year: Yup.number()
    .min(1, 'Operating hours must be at least 1')
    .max(8760, 'Operating hours cannot exceed 8760 (24/7 operation)'),
  maintenance_schedule: Yup.string()
    .max(500, 'Maintenance schedule must be less than 500 characters')
});

export const UnitConfigModal: React.FC<UnitConfigModalProps> = ({
  open,
  onClose,
  onSave,
  unit,
  loading = false
}) => {
  const [operatorEmails, setOperatorEmails] = useState<string[]>([]);
  const [newOperatorEmail, setNewOperatorEmail] = useState('');

  const formik = useFormik({
    initialValues: {
      name: unit?.name || '',
      type: unit?.type || '',
      capacity_tons_per_day: unit?.capacity_tons_per_day || '',
      location: {
        latitude: unit?.location?.latitude || '',
        longitude: unit?.location?.longitude || '',
        address: unit?.location?.address || ''
      },
      description: unit?.description || '',
      operating_hours_per_year: unit?.operating_hours_per_year || 8760,
      maintenance_schedule: unit?.maintenance_schedule || 'Monthly inspection, quarterly maintenance'
    },
    validationSchema,
    onSubmit: async (values) => {
      const unitData: Partial<CarbonCaptureUnit> = {
        ...values,
        capacity_tons_per_day: Number(values.capacity_tons_per_day),
        location: {
          ...values.location,
          latitude: Number(values.location.latitude),
          longitude: Number(values.location.longitude)
        },
        operating_hours_per_year: Number(values.operating_hours_per_year),
        operator_emails: operatorEmails
      };

      onSave(unitData);
    },
    enableReinitialize: true
  });

  useEffect(() => {
    if (unit?.operator_emails) {
      setOperatorEmails(unit.operator_emails);
    } else {
      setOperatorEmails([]);
    }
  }, [unit]);

  const handleAddOperator = () => {
    if (newOperatorEmail && !operatorEmails.includes(newOperatorEmail)) {
      setOperatorEmails([...operatorEmails, newOperatorEmail]);
      setNewOperatorEmail('');
    }
  };

  const handleRemoveOperator = (email: string) => {
    setOperatorEmails(operatorEmails.filter(e => e !== email));
  };

  const handleClose = () => {
    if (!loading) {
      formik.resetForm();
      setOperatorEmails([]);
      setNewOperatorEmail('');
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="unit-config-dialog-title"
    >
      <DialogTitle id="unit-config-dialog-title" sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {unit ? 'Edit Carbon Capture Unit' : 'Add New Carbon Capture Unit'}
          </Typography>
          <IconButton onClick={handleClose} disabled={loading}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box component="form" onSubmit={formik.handleSubmit}>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                id="name"
                name="name"
                label="Unit Name"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.name && Boolean(formik.errors.name)}
                helperText={formik.touched.name && formik.errors.name}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel id="type-label">Unit Type</InputLabel>
                <Select
                  labelId="type-label"
                  id="type"
                  name="type"
                  value={formik.values.type}
                  label="Unit Type"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.type && Boolean(formik.errors.type)}
                >
                  {unitTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                id="capacity_tons_per_day"
                name="capacity_tons_per_day"
                label="Capacity (tons/day)"
                type="number"
                value={formik.values.capacity_tons_per_day}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.capacity_tons_per_day && Boolean(formik.errors.capacity_tons_per_day)}
                helperText={formik.touched.capacity_tons_per_day && formik.errors.capacity_tons_per_day}
                required
                inputProps={{ min: 1, max: 10000 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                id="operating_hours_per_year"
                name="operating_hours_per_year"
                label="Operating Hours/Year"
                type="number"
                value={formik.values.operating_hours_per_year}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.operating_hours_per_year && Boolean(formik.errors.operating_hours_per_year)}
                helperText={formik.touched.operating_hours_per_year && formik.errors.operating_hours_per_year}
                inputProps={{ min: 1, max: 8760 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                id="location.latitude"
                name="location.latitude"
                label="Latitude"
                type="number"
                value={formik.values.location.latitude}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.location?.latitude && Boolean(formik.errors.location?.latitude)}
                helperText={formik.touched.location?.latitude && formik.errors.location?.latitude}
                required
                inputProps={{ min: -90, max: 90, step: 0.000001 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                id="location.longitude"
                name="location.longitude"
                label="Longitude"
                type="number"
                value={formik.values.location.longitude}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.location?.longitude && Boolean(formik.errors.location?.longitude)}
                helperText={formik.touched.location?.longitude && formik.errors.location?.longitude}
                required
                inputProps={{ min: -180, max: 180, step: 0.000001 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                id="location.address"
                name="location.address"
                label="Address (Optional)"
                value={formik.values.location.address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.location?.address && Boolean(formik.errors.location?.address)}
                helperText={formik.touched.location?.address && formik.errors.location?.address}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                id="description"
                name="description"
                label="Description (Optional)"
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.description && Boolean(formik.errors.description)}
                helperText={formik.touched.description && formik.errors.description}
                multiline
                rows={3}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                id="maintenance_schedule"
                name="maintenance_schedule"
                label="Maintenance Schedule"
                value={formik.values.maintenance_schedule}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.maintenance_schedule && Boolean(formik.errors.maintenance_schedule)}
                helperText={formik.touched.maintenance_schedule && formik.errors.maintenance_schedule}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Unit Operators
              </Typography>

              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Add Operator Email"
                  value={newOperatorEmail}
                  onChange={(e) => setNewOperatorEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOperator();
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleAddOperator} disabled={!newOperatorEmail}>
                        <Add />
                      </IconButton>
                    ),
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {operatorEmails.map((email) => (
                  <Chip
                    key={email}
                    label={email}
                    onDelete={() => handleRemoveOperator(email)}
                    deleteIcon={<Delete />}
                    variant="outlined"
                  />
                ))}
              </Box>

              {operatorEmails.length === 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  No operators assigned. Add operator emails to grant access to this unit.
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : (unit ? 'Update Unit' : 'Create Unit')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
