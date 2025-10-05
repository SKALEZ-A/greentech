import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  InputAdornment,
  IconButton,
  Link,
  Checkbox,
  FormControlLabel,
  Grid
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, Person, Business } from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
}

const validationSchema = Yup.object({
  firstName: Yup.string()
    .min(2, 'First name should be of minimum 2 characters length')
    .required('First name is required'),
  lastName: Yup.string()
    .min(2, 'Last name should be of minimum 2 characters length')
    .required('Last name is required'),
  email: Yup.string()
    .email('Enter a valid email')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password should be of minimum 8 characters length')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    )
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
  organization: Yup.string()
    .min(2, 'Organization name should be of minimum 2 characters length')
    .required('Organization is required'),
  acceptTerms: Yup.boolean()
    .oneOf([true], 'You must accept the terms and conditions')
    .required('You must accept the terms and conditions'),
  acceptPrivacy: Yup.boolean()
    .oneOf([true], 'You must accept the privacy policy')
    .required('You must accept the privacy policy')
});

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      organization: '',
      acceptTerms: false,
      acceptPrivacy: false
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      setError(null);

      try {
        // TODO: Implement registration API call
        console.log('Registration data:', values);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Handle success
        alert('Registration successful! Please check your email for verification.');
        if (onSwitchToLogin) {
          onSwitchToLogin();
        }
      } catch (err) {
        setError('Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  });

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleClickShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
      <Typography component="h1" variant="h4" align="center" gutterBottom>
        Create Account
      </Typography>

      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Join the Carbon Capture Network to start optimizing your operations.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={formik.handleSubmit} sx={{ mt: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="firstName"
              label="First Name"
              name="firstName"
              autoComplete="given-name"
              value={formik.values.firstName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.firstName && Boolean(formik.errors.firstName)}
              helperText={formik.touched.firstName && formik.errors.firstName}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="lastName"
              label="Last Name"
              name="lastName"
              autoComplete="family-name"
              value={formik.values.lastName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.lastName && Boolean(formik.errors.lastName)}
              helperText={formik.touched.lastName && formik.errors.lastName}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>

        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label="Email Address"
          name="email"
          autoComplete="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.email && Boolean(formik.errors.email)}
          helperText={formik.touched.email && formik.errors.email}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Email />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          margin="normal"
          required
          fullWidth
          id="organization"
          label="Organization"
          name="organization"
          autoComplete="organization"
          value={formik.values.organization}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.organization && Boolean(formik.errors.organization)}
          helperText={formik.touched.organization && formik.errors.organization}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Business />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          id="password"
          autoComplete="new-password"
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.password && Boolean(formik.errors.password)}
          helperText={formik.touched.password && formik.errors.password}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Lock />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={handleClickShowPassword}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          margin="normal"
          required
          fullWidth
          name="confirmPassword"
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          id="confirmPassword"
          autoComplete="new-password"
          value={formik.values.confirmPassword}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
          helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Lock />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle confirm password visibility"
                  onClick={handleClickShowConfirmPassword}
                  edge="end"
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <FormControlLabel
          control={
            <Checkbox
              name="acceptTerms"
              color="primary"
              checked={formik.values.acceptTerms}
              onChange={formik.handleChange}
            />
          }
          label={
            <Typography variant="body2">
              I accept the{' '}
              <Link href="/terms" target="_blank" rel="noopener">
                Terms and Conditions
              </Link>
            </Typography>
          }
        />
        {formik.touched.acceptTerms && formik.errors.acceptTerms && (
          <Typography variant="caption" color="error" sx={{ ml: 4 }}>
            {formik.errors.acceptTerms}
          </Typography>
        )}

        <FormControlLabel
          control={
            <Checkbox
              name="acceptPrivacy"
              color="primary"
              checked={formik.values.acceptPrivacy}
              onChange={formik.handleChange}
            />
          }
          label={
            <Typography variant="body2">
              I accept the{' '}
              <Link href="/privacy" target="_blank" rel="noopener">
                Privacy Policy
              </Link>
            </Typography>
          }
        />
        {formik.touched.acceptPrivacy && formik.errors.acceptPrivacy && (
          <Typography variant="caption" color="error" sx={{ ml: 4 }}>
            {formik.errors.acceptPrivacy}
          </Typography>
        )}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </Button>

        {onSwitchToLogin && (
          <Box sx={{ textAlign: 'center' }}>
            <Link
              component="button"
              variant="body2"
              onClick={onSwitchToLogin}
              sx={{ textDecoration: 'none' }}
            >
              Already have an account? Sign In
            </Link>
          </Box>
        )}
      </Box>
    </Paper>
  );
};
