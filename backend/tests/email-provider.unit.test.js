describe('email provider configuration', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; jest.resetModules(); });

  test('supports a non-Gmail SMTP host through configuration', () => {
    process.env.SMTP_HOST = 'smtp.custom.test';
    process.env.SMTP_USER = 'mailer@custom.test';
    process.env.SMTP_PASS = 'secret';
    expect(require('../src/services/email/smtp.provider').isConfigured()).toBe(true);
  });
});
