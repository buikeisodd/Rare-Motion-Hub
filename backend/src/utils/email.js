const nodemailer = require('nodemailer');

const smtpPassword = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
const hasSmtpConfig = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && smtpPassword);

const getTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 10000,
  auth: {
    user: process.env.SMTP_USER,
    pass: smtpPassword
  }
});

const sendMailSafely = async (message) => {
  try {
    await getTransport().sendMail(message);
    return true;
  } catch (error) {
    console.error('SMTP email delivery failed:', error.message);
    return false;
  }
};

const sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  if (!hasSmtpConfig) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Email verification link for ${to}: ${verificationUrl}`);
    }
    return { sent: false };
  }

  const sent = await sendMailSafely({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Verify your Starlight Station email',
    text: `Hi ${name || 'there'}, verify your email to finish setting up Starlight Station: ${verificationUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#f8f8f8;padding:24px">
        <h1 style="margin:0 0 16px">Verify your email</h1>
        <p style="color:#b7b7b7">Hi ${name || 'there'}, confirm this email address to finish setting up Starlight Station.</p>
        <a href="${verificationUrl}" style="display:inline-block;margin-top:16px;padding:12px 18px;border-radius:999px;background:#f8f8f8;color:#050505;text-decoration:none;font-weight:700">Verify email</a>
      </div>
    `
  });

  return { sent };
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  if (!hasSmtpConfig) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Password reset link for ${to}: ${resetUrl}`);
    }
    return { sent: false };
  }

  const sent = await sendMailSafely({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Reset your Starlight Station password',
    text: `Hi ${name || 'there'}, reset your Starlight Station password here: ${resetUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#f8f8f8;padding:24px">
        <h1 style="margin:0 0 16px">Reset your password</h1>
        <p style="color:#b7b7b7">Hi ${name || 'there'}, use this link to set a new Starlight Station password.</p>
        <a href="${resetUrl}" style="display:inline-block;margin-top:16px;padding:12px 18px;border-radius:999px;background:#f8f8f8;color:#050505;text-decoration:none;font-weight:700">Reset password</a>
      </div>
    `
  });

  return { sent };
};

module.exports = { hasSmtpConfig, sendVerificationEmail, sendPasswordResetEmail };
