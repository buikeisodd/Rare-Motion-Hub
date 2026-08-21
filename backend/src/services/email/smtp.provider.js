const nodemailer = require('nodemailer');

const getSmtpPassword = () => process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && getSmtpPassword());

const send = async (message) => {
  if (!isConfigured()) return { sent: false, reason: 'not_configured' };
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: { user: process.env.SMTP_USER, pass: getSmtpPassword() }
  });
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...message });
    return { sent: true };
  } catch (error) {
    console.error('Email delivery failed:', error.message);
    return { sent: false, reason: 'delivery_failed' };
  } finally {
    transport.close();
  }
};

module.exports = { isConfigured, send };
