import { createTheme, ThemeOptions } from '@mui/material/styles';

// Color palette
export const colors = {
  primary: {
    main: '#1976d2',
    dark: '#1565c0',
    light: '#42a5f5',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#dc004e',
    dark: '#c2185b',
    light: '#ff5983',
    contrastText: '#ffffff',
  },
  success: {
    main: '#388e3c',
    dark: '#2e7d32',
    light: '#4caf50',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#f57c00',
    dark: '#ef6c00',
    light: '#ff9800',
    contrastText: '#000000',
  },
  error: {
    main: '#d32f2f',
    dark: '#c62828',
    light: '#ef5350',
    contrastText: '#ffffff',
  },
  info: {
    main: '#0288d1',
    dark: '#01579b',
    light: '#03dac6',
    contrastText: '#ffffff',
  },
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
};

// Light theme configuration
const lightThemeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: colors.primary,
    secondary: colors.secondary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    grey: colors.grey,
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
      disabled: '#9e9e9e',
    },
    divider: '#e0e0e0',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.25,
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.25,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.25,
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.25,
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.25,
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.25,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
          '&:hover': {
            boxShadow: '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
          border: '1px solid #e0e0e0',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: '12px 0 0 12px',
        },
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
};

// Dark theme configuration
const darkThemeOptions: ThemeOptions = {
  ...lightThemeOptions,
  palette: {
    mode: 'dark',
    primary: colors.primary,
    secondary: colors.secondary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    grey: colors.grey,
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
      disabled: '#666666',
    },
    divider: '#333333',
  },
  components: {
    ...lightThemeOptions.components,
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.4)',
          border: '1px solid #333333',
          backgroundColor: '#1e1e1e',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          backgroundImage: 'none',
        },
      },
    },
  },
};

// Create themes
export const lightTheme = createTheme(lightThemeOptions);
export const darkTheme = createTheme(darkThemeOptions);

// Default theme (can be switched based on user preference)
export const defaultTheme = lightTheme;

// Theme utilities
export const getTheme = (mode: 'light' | 'dark' = 'light') => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

// Custom color utilities for charts and data visualization
export const chartColors = {
  efficiency: colors.success.main,
  energy: colors.warning.main,
  carbon: colors.info.main,
  cost: colors.grey[600],
  temperature: colors.error.main,
  pressure: colors.primary.main,
  flow: colors.secondary.main,
  quality: colors.success.light,
};

// Status color mapping
export const statusColors = {
  active: colors.success.main,
  inactive: colors.grey[500],
  maintenance: colors.warning.main,
  offline: colors.error.main,
  pending: colors.warning.light,
  approved: colors.success.main,
  rejected: colors.error.main,
  good: colors.success.main,
  warning: colors.warning.main,
  critical: colors.error.main,
};

// Severity color mapping
export const severityColors = {
  low: colors.info.main,
  medium: colors.warning.main,
  high: colors.warning.dark,
  critical: colors.error.main,
};

export default defaultTheme;
