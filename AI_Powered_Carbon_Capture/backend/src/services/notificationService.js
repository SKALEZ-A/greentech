import nodemailer from 'nodemailer';
import twilio from 'twilio';
import winston from 'winston';
import { ApiError } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import CarbonCaptureUnit from '../models/CarbonCaptureUnit.js';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'notification-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/notification-service.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

class NotificationService {
  constructor() {
    // Email configuration
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // SMS configuration
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    // Notification settings
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Send email notification
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email transporter not configured');
      }

      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Carbon Capture Network'}" <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        html,
        text,
        attachments
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Email sending failed:', {
        to,
        subject,
        error: error.message
      });

      throw new ApiError(
        'Email notification failed',
        500,
        'EMAIL_SEND_FAILED',
        { recipient: to, error: error.message }
      );
    }
  }

  /**
   * Send SMS notification
   * @param {Object} options - SMS options
   * @returns {Promise<Object>} Send result
   */
  async sendSMS({ to, message }) {
    try {
      if (!this.twilioClient) {
        throw new Error('Twilio client not configured');
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioPhoneNumber,
        to
      });

      logger.info('SMS sent successfully', {
        to,
        messageId: result.sid,
        status: result.status
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('SMS sending failed:', {
        to,
        error: error.message
      });

      throw new ApiError(
        'SMS notification failed',
        500,
        'SMS_SEND_FAILED',
        { recipient: to, error: error.message }
      );
    }
  }

  /**
   * Send maintenance alert notification
   * @param {string} unitId - Unit ID
   * @param {Object} alert - Alert details
   * @returns {Promise<Object>} Notification results
   */
  async sendMaintenanceAlert(unitId, alert) {
    try {
      // Get unit and owner information
      const unit = await CarbonCaptureUnit.findOne({ id: unitId }).populate('owner');
      if (!unit) {
        throw new Error(`Unit ${unitId} not found`);
      }

      const owner = unit.owner;
      if (!owner) {
        throw new Error(`Owner not found for unit ${unitId}`);
      }

      const alertMessage = this._formatMaintenanceAlert(unit, alert);

      // Send email notification
      const emailPromises = [];
      if (owner.preferences?.notifications?.email && owner.email) {
        emailPromises.push(
          this.sendEmail({
            to: owner.email,
            subject: `Maintenance Alert: ${unit.name}`,
            html: this._generateMaintenanceAlertEmail(unit, alert),
            text: alertMessage
          })
        );
      }

      // Send SMS notification for critical alerts
      const smsPromises = [];
      if (alert.severity === 'critical' &&
          owner.preferences?.notifications?.sms &&
          owner.phoneNumber) {
        smsPromises.push(
          this.sendSMS({
            to: owner.phoneNumber,
            message: alertMessage
          })
        );
      }

      // Execute all notifications
      const [emailResults, smsResults] = await Promise.allSettled([
        Promise.all(emailPromises),
        Promise.all(smsPromises)
      ]);

      const results = {
        unitId,
        alertId: alert.id,
        notifications: {
          email: emailResults.status === 'fulfilled' ? emailResults.value : null,
          sms: smsResults.status === 'fulfilled' ? smsResults.value : null
        },
        timestamp: new Date().toISOString()
      };

      logger.info('Maintenance alert notifications sent', {
        unitId,
        alertId: alert.id,
        emailCount: emailResults.status === 'fulfilled' ? emailResults.value.length : 0,
        smsCount: smsResults.status === 'fulfilled' ? smsResults.value.length : 0
      });

      return results;

    } catch (error) {
      logger.error('Maintenance alert notification failed:', {
        unitId,
        alertId: alert.id,
        error: error.message
      });

      throw new ApiError(
        'Maintenance alert notification failed',
        500,
        'MAINTENANCE_ALERT_FAILED',
        { unitId, alertId: alert.id, error: error.message }
      );
    }
  }

  /**
   * Send efficiency optimization notification
   * @param {string} unitId - Unit ID
   * @param {Object} optimization - Optimization details
   * @returns {Promise<Object>} Notification results
   */
  async sendOptimizationNotification(unitId, optimization) {
    try {
      const unit = await CarbonCaptureUnit.findOne({ id: unitId }).populate('owner');
      if (!unit) {
        throw new Error(`Unit ${unitId} not found`);
      }

      const owner = unit.owner;
      if (!owner) {
        return; // Skip if no owner (shouldn't happen)
      }

      const notificationMessage = this._formatOptimizationNotification(unit, optimization);

      // Send email notification
      if (owner.preferences?.notifications?.email && owner.email) {
        await this.sendEmail({
          to: owner.email,
          subject: `Efficiency Optimization Available: ${unit.name}`,
          html: this._generateOptimizationEmail(unit, optimization),
          text: notificationMessage
        });
      }

      logger.info('Optimization notification sent', { unitId });

      return {
        unitId,
        type: 'optimization',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Optimization notification failed:', {
        unitId,
        error: error.message
      });

      // Don't throw error for optimization notifications (less critical)
      return {
        unitId,
        type: 'optimization',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send carbon credit transaction notification
   * @param {string} userId - User ID
   * @param {Object} transaction - Transaction details
   * @returns {Promise<Object>} Notification results
   */
  async sendCreditTransactionNotification(userId, transaction) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const transactionMessage = this._formatCreditTransactionMessage(transaction);

      // Send email notification
      if (user.preferences?.notifications?.email && user.email) {
        await this.sendEmail({
          to: user.email,
          subject: `Carbon Credit Transaction: ${transaction.type}`,
          html: this._generateCreditTransactionEmail(user, transaction),
          text: transactionMessage
        });
      }

      logger.info('Credit transaction notification sent', {
        userId,
        transactionId: transaction.id,
        type: transaction.type
      });

      return {
        userId,
        transactionId: transaction.id,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Credit transaction notification failed:', {
        userId,
        transactionId: transaction.id,
        error: error.message
      });

      throw new ApiError(
        'Credit transaction notification failed',
        500,
        'CREDIT_NOTIFICATION_FAILED',
        { userId, transactionId: transaction.id, error: error.message }
      );
    }
  }

  /**
   * Send system alert to all administrators
   * @param {Object} alert - System alert details
   * @returns {Promise<Object>} Notification results
   */
  async sendSystemAlert(alert) {
    try {
      // Get all admin users
      const admins = await User.find({
        role: 'admin',
        isActive: true,
        'preferences.notifications.email': true
      });

      if (admins.length === 0) {
        logger.warn('No active administrators found for system alert');
        return { recipients: 0 };
      }

      const alertMessage = this._formatSystemAlert(alert);

      // Send email to all admins
      const emailPromises = admins.map(admin =>
        this.sendEmail({
          to: admin.email,
          subject: `System Alert: ${alert.title}`,
          html: this._generateSystemAlertEmail(alert),
          text: alertMessage
        })
      );

      await Promise.all(emailPromises);

      logger.info('System alert sent to administrators', {
        alertId: alert.id,
        adminCount: admins.length
      });

      return {
        alertId: alert.id,
        recipients: admins.length,
        type: 'system',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('System alert notification failed:', {
        alertId: alert.id,
        error: error.message
      });

      throw new ApiError(
        'System alert notification failed',
        500,
        'SYSTEM_ALERT_FAILED',
        { alertId: alert.id, error: error.message }
      );
    }
  }

  /**
   * Send weekly performance report
   * @param {string} userId - User ID
   * @param {Object} report - Performance report data
   * @returns {Promise<Object>} Notification results
   */
  async sendWeeklyReport(userId, report) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Send email notification
      if (user.preferences?.notifications?.email && user.email) {
        await this.sendEmail({
          to: user.email,
          subject: 'Weekly Carbon Capture Performance Report',
          html: this._generateWeeklyReportEmail(user, report),
          text: `Your weekly carbon capture performance report is ready. Check your dashboard for details.`
        });
      }

      logger.info('Weekly report sent', { userId });

      return {
        userId,
        type: 'weekly_report',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Weekly report notification failed:', {
        userId,
        error: error.message
      });

      return {
        userId,
        type: 'weekly_report',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Private helper methods

  _formatMaintenanceAlert(unit, alert) {
    return `Maintenance Alert for ${unit.name}:
Severity: ${alert.severity.toUpperCase()}
Message: ${alert.message}
Unit: ${unit.id} - ${unit.name}
Time: ${new Date().toLocaleString()}

Please check your dashboard for more details.`;
  }

  _formatOptimizationNotification(unit, optimization) {
    const improvement = optimization.predictedEfficiency - optimization.currentEfficiency;
    return `Efficiency Optimization Available for ${unit.name}:
Current Efficiency: ${optimization.currentEfficiency.toFixed(1)}%
Predicted Efficiency: ${optimization.predictedEfficiency.toFixed(1)}%
Potential Improvement: +${improvement.toFixed(1)}%

Check your dashboard for optimization recommendations.`;
  }

  _formatCreditTransactionMessage(transaction) {
    return `Carbon Credit Transaction Completed:
Type: ${transaction.type}
Amount: ${transaction.amount} credits
Value: $${transaction.value.toFixed(2)}

View details in your dashboard.`;
  }

  _formatSystemAlert(alert) {
    return `System Alert:
${alert.title}
${alert.message}
Severity: ${alert.severity}
Time: ${new Date().toLocaleString()}`;
  }

  _generateMaintenanceAlertEmail(unit, alert) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Maintenance Alert</h2>
        <div style="background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>${unit.name}</h3>
          <p><strong>Severity:</strong> <span style="color: ${alert.severity === 'critical' ? '#d32f2f' : '#f57c00'};">${alert.severity.toUpperCase()}</span></p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Unit ID:</strong> ${unit.id}</p>
          <p><strong>Location:</strong> ${unit.location.city}, ${unit.location.country}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/units/${unit.id}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Unit Details</a>
        </div>
        <p style="color: #666; font-size: 12px;">This is an automated notification from the Carbon Capture Network.</p>
      </div>
    `;
  }

  _generateOptimizationEmail(unit, optimization) {
    const improvement = optimization.predictedEfficiency - optimization.currentEfficiency;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">Efficiency Optimization Available</h2>
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>${unit.name}</h3>
          <div style="display: flex; justify-content: space-between; margin: 15px 0;">
            <div>
              <p><strong>Current Efficiency:</strong></p>
              <p style="font-size: 24px; color: #1976d2;">${optimization.currentEfficiency.toFixed(1)}%</p>
            </div>
            <div>
              <p><strong>Predicted Efficiency:</strong></p>
              <p style="font-size: 24px; color: #2e7d32;">${optimization.predictedEfficiency.toFixed(1)}%</p>
            </div>
          </div>
          <p><strong>Potential Improvement:</strong> <span style="color: #2e7d32; font-weight: bold;">+${improvement.toFixed(1)}%</span></p>
          <p><strong>Energy Savings:</strong> ${optimization.energySavings.toFixed(1)} kWh</p>
          <p><strong>Cost Savings:</strong> $${optimization.costSavings.toFixed(2)}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/units/${unit.id}/optimization" style="background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Optimization Details</a>
        </div>
        <p style="color: #666; font-size: 12px;">This is an automated notification from the Carbon Capture Network.</p>
      </div>
    `;
  }

  _generateCreditTransactionEmail(user, transaction) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Carbon Credit Transaction</h2>
        <div style="background-color: #f3f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Transaction Details</h3>
          <p><strong>Type:</strong> ${transaction.type}</p>
          <p><strong>Amount:</strong> ${transaction.amount} credits</p>
          <p><strong>Value:</strong> $${transaction.value.toFixed(2)}</p>
          <p><strong>Date:</strong> ${new Date(transaction.timestamp).toLocaleString()}</p>
          ${transaction.projectName ? `<p><strong>Project:</strong> ${transaction.projectName}</p>` : ''}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard/credits" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Credit Portfolio</a>
        </div>
        <p style="color: #666; font-size: 12px;">This is an automated notification from the Carbon Capture Network.</p>
      </div>
    `;
  }

  _generateSystemAlertEmail(alert) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">System Alert</h2>
        <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>${alert.title}</h3>
          <p><strong>Severity:</strong> <span style="color: ${alert.severity === 'critical' ? '#d32f2f' : '#f57c00'};">${alert.severity.toUpperCase()}</span></p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          ${alert.details ? `<p><strong>Details:</strong> ${alert.details}</p>` : ''}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/admin/dashboard" style="background-color: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Access Admin Dashboard</a>
        </div>
        <p style="color: #666; font-size: 12px;">This is an automated system notification from the Carbon Capture Network.</p>
      </div>
    `;
  }

  _generateWeeklyReportEmail(user, report) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Weekly Performance Report</h2>
        <div style="background-color: #f3f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Hello ${user.firstName},</h3>
          <p>Your weekly carbon capture performance report is ready.</p>

          <div style="margin: 20px 0;">
            <h4>Key Metrics:</h4>
            <ul>
              <li><strong>Total CO₂ Captured:</strong> ${report.totalCO2Captured?.toLocaleString() || 'N/A'} tons</li>
              <li><strong>Average Efficiency:</strong> ${report.averageEfficiency?.toFixed(1) || 'N/A'}%</li>
              <li><strong>Energy Consumption:</strong> ${report.totalEnergyConsumption?.toLocaleString() || 'N/A'} kWh</li>
              <li><strong>Carbon Credits Generated:</strong> ${report.creditsGenerated?.toLocaleString() || 'N/A'}</li>
              <li><strong>Cost Savings:</strong> $${report.costSavings?.toFixed(2) || 'N/A'}</li>
            </ul>
          </div>

          ${report.alerts?.length > 0 ? `
          <div style="background-color: #fff3e0; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <h4>⚠️ Active Alerts:</h4>
            <ul>
              ${report.alerts.map(alert => `<li>${alert.message}</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/dashboard/reports" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Full Report</a>
          </div>
        </div>
        <p style="color: #666; font-size: 12px;">This is an automated weekly report from the Carbon Capture Network.</p>
      </div>
    `;
  }
}

// Export singleton instance
export default new NotificationService();
