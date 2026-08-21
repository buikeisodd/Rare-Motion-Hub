const emailService = require('../services/email');
const hasSmtpConfig = emailService.isConfigured();
const sendMailSafely = async (message) => (await emailService.send(message)).sent;

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

// Security alert email — sent only for significant events (lockout,
// suspected credential stuffing, password reset completion) to avoid
// notification spam from individual failed attempts.
// Audit events (SecurityEvent model) are always written regardless; this
// email is a separate, user-facing notification for actionable events only.
const sendSecurityAlertEmail = async ({ to, name, subject, headline, body, ctaText, ctaUrl }) => {
  if (!hasSmtpConfig) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Security alert] ${subject} → ${to}: ${body}`);
    }
    return { sent: false };
  }
  const sent = await sendMailSafely({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text: `Hi ${name || 'there'}, ${body}${ctaText && ctaUrl ? ` ${ctaText}: ${ctaUrl}` : ''}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#f8f8f8;padding:24px">
        <h1 style="margin:0 0 16px;color:#f8f8f8">${headline}</h1>
        <p style="color:#b7b7b7;line-height:1.6">${body}</p>
        ${ctaText && ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;padding:12px 18px;border-radius:999px;background:#f8f8f8;color:#050505;text-decoration:none;font-weight:700">${ctaText}</a>` : ''}
        <p style="margin-top:24px;color:#555;font-size:12px">If you did not take this action, please reset your password immediately.</p>
      </div>
    `
  });
  return { sent };
};

module.exports = { hasSmtpConfig, sendVerificationEmail, sendPasswordResetEmail, sendSecurityAlertEmail };
