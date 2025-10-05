import moment from 'moment-timezone';

/**
 * Format date to ISO string
 * @param {Date|string} date - Date to format
 * @returns {string} ISO formatted date
 */
export const toISOString = (date) => {
  return new Date(date).toISOString();
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Moment format string
 * @param {string} timezone - Timezone
 * @returns {string} Formatted date
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss', timezone = 'UTC') => {
  return moment(date).tz(timezone).format(format);
};

/**
 * Get start of day
 * @param {Date|string} date - Date
 * @param {string} timezone - Timezone
 * @returns {Date} Start of day
 */
export const startOfDay = (date, timezone = 'UTC') => {
  return moment(date).tz(timezone).startOf('day').toDate();
};

/**
 * Get end of day
 * @param {Date|string} date - Date
 * @param {string} timezone - Timezone
 * @returns {Date} End of day
 */
export const endOfDay = (date, timezone = 'UTC') => {
  return moment(date).tz(timezone).endOf('day').toDate();
};

/**
 * Add time to date
 * @param {Date|string} date - Base date
 * @param {number} amount - Amount to add
 * @param {string} unit - Time unit (days, hours, minutes, etc.)
 * @returns {Date} New date
 */
export const addTime = (date, amount, unit) => {
  return moment(date).add(amount, unit).toDate();
};

/**
 * Subtract time from date
 * @param {Date|string} date - Base date
 * @param {number} amount - Amount to subtract
 * @param {string} unit - Time unit (days, hours, minutes, etc.)
 * @returns {Date} New date
 */
export const subtractTime = (date, amount, unit) => {
  return moment(date).subtract(amount, unit).toDate();
};

/**
 * Get difference between dates
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @param {string} unit - Unit for difference
 * @returns {number} Difference
 */
export const dateDifference = (date1, date2, unit = 'days') => {
  return moment(date1).diff(moment(date2), unit);
};

/**
 * Check if date is in the past
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if in past
 */
export const isPast = (date) => {
  return moment(date).isBefore(moment());
};

/**
 * Check if date is in the future
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if in future
 */
export const isFuture = (date) => {
  return moment(date).isAfter(moment());
};

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @param {string} timezone - Timezone
 * @returns {boolean} True if today
 */
export const isToday = (date, timezone = 'UTC') => {
  return moment(date).tz(timezone).isSame(moment().tz(timezone), 'day');
};

/**
 * Get business days between dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {number} Business days
 */
export const getBusinessDays = (startDate, endDate) => {
  let businessDays = 0;
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate, 'day')) {
    if (currentDate.day() !== 0 && currentDate.day() !== 6) { // Not Saturday or Sunday
      businessDays++;
    }
    currentDate.add(1, 'day');
  }

  return businessDays;
};

/**
 * Get next business day
 * @param {Date|string} date - Base date
 * @returns {Date} Next business day
 */
export const getNextBusinessDay = (date) => {
  let nextDay = moment(date).add(1, 'day');

  while (nextDay.day() === 0 || nextDay.day() === 6) { // Skip weekends
    nextDay.add(1, 'day');
  }

  return nextDay.toDate();
};

/**
 * Parse date string with multiple formats
 * @param {string} dateString - Date string
 * @param {Array} formats - Array of formats to try
 * @returns {Date|null} Parsed date or null
 */
export const parseDate = (dateString, formats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']) => {
  for (const format of formats) {
    const parsed = moment(dateString, format, true);
    if (parsed.isValid()) {
      return parsed.toDate();
    }
  }
  return null;
};

/**
 * Get quarter of year
 * @param {Date|string} date - Date
 * @returns {number} Quarter (1-4)
 */
export const getQuarter = (date) => {
  return moment(date).quarter();
};

/**
 * Get week of year
 * @param {Date|string} date - Date
 * @returns {number} Week number
 */
export const getWeekOfYear = (date) => {
  return moment(date).week();
};

/**
 * Check if date is within range
 * @param {Date|string} date - Date to check
 * @param {Date|string} startDate - Range start
 * @param {Date|string} endDate - Range end
 * @returns {boolean} True if within range
 */
export const isDateInRange = (date, startDate, endDate) => {
  const checkDate = moment(date);
  return checkDate.isBetween(startDate, endDate, null, '[]');
};

/**
 * Get relative time string
 * @param {Date|string} date - Date
 * @returns {string} Relative time
 */
export const getRelativeTime = (date) => {
  return moment(date).fromNow();
};

/**
 * Convert timezone
 * @param {Date|string} date - Date
 * @param {string} fromTimezone - Source timezone
 * @param {string} toTimezone - Target timezone
 * @returns {Date} Converted date
 */
export const convertTimezone = (date, fromTimezone, toTimezone) => {
  return moment.tz(date, fromTimezone).tz(toTimezone).toDate();
};

/**
 * Get date range for period
 * @param {string} period - Period ('week', 'month', 'quarter', 'year')
 * @param {Date|string} referenceDate - Reference date
 * @returns {Object} Start and end dates
 */
export const getDateRange = (period, referenceDate = new Date()) => {
  const date = moment(referenceDate);

  switch (period) {
    case 'week':
      return {
        start: date.startOf('week').toDate(),
        end: date.endOf('week').toDate()
      };
    case 'month':
      return {
        start: date.startOf('month').toDate(),
        end: date.endOf('month').toDate()
      };
    case 'quarter':
      return {
        start: date.startOf('quarter').toDate(),
        end: date.endOf('quarter').toDate()
      };
    case 'year':
      return {
        start: date.startOf('year').toDate(),
        end: date.endOf('year').toDate()
      };
    default:
      throw new Error(`Invalid period: ${period}`);
  }
};

/**
 * Validate date string
 * @param {string} dateString - Date string
 * @param {string} format - Expected format
 * @returns {boolean} True if valid
 */
export const isValidDate = (dateString, format = 'YYYY-MM-DD') => {
  return moment(dateString, format, true).isValid();
};

/**
 * Get age from birth date
 * @param {Date|string} birthDate - Birth date
 * @returns {number} Age in years
 */
export const getAge = (birthDate) => {
  return moment().diff(moment(birthDate), 'years');
};

/**
 * Get days until date
 * @param {Date|string} targetDate - Target date
 * @returns {number} Days until date
 */
export const daysUntil = (targetDate) => {
  return moment(targetDate).diff(moment(), 'days');
};

/**
 * Check if date is weekend
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if weekend
 */
export const isWeekend = (date) => {
  const day = moment(date).day();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

/**
 * Get first day of month
 * @param {Date|string} date - Date
 * @returns {Date} First day of month
 */
export const firstDayOfMonth = (date) => {
  return moment(date).startOf('month').toDate();
};

/**
 * Get last day of month
 * @param {Date|string} date - Date
 * @returns {Date} Last day of month
 */
export const lastDayOfMonth = (date) => {
  return moment(date).endOf('month').toDate();
};

/**
 * Format duration between dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {string} Formatted duration
 */
export const formatDateDuration = (startDate, endDate) => {
  const duration = moment.duration(moment(endDate).diff(moment(startDate)));

  const years = duration.years();
  const months = duration.months();
  const days = duration.days();

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);

  return parts.join(', ') || 'Less than a day';
};

/**
 * Get timestamp in milliseconds
 * @param {Date|string} date - Date
 * @returns {number} Timestamp
 */
export const getTimestamp = (date) => {
  return moment(date).valueOf();
};

/**
 * Create date from timestamp
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {Date} Date object
 */
export const fromTimestamp = (timestamp) => {
  return moment(timestamp).toDate();
};
