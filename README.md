# Rare-Motion-Hub

## Authentication configuration

Core email/password authentication is handled by the application. New accounts must verify their email before signing in, and password-reset links expire after 30 minutes.

Set these backend variables locally and in Render:

```env
JWT_SECRET=use-a-long-random-secret
FRONTEND_URL=https://your-frontend-domain.example
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=Rare Motion Hub <no-reply@example.com>
```

SMTP is required in production for verification and reset emails. Without SMTP, development logs generated links to the backend console for testing; production intentionally does not expose them.

Google, Apple, and phone sign-in still require their respective OAuth or SMS provider credentials and approved redirect/application configuration.
