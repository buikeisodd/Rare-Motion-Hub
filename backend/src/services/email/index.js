const smtpProvider = require('./smtp.provider');

const provider = () => smtpProvider;
const send = (message) => provider().send(message);

module.exports = { provider, send, isConfigured: () => provider().isConfigured() };
