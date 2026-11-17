const { AsyncLocalStorage } = require('node:async_hooks');
const config = require('./config.js');

const requestContext = new AsyncLocalStorage();

class Logger {
  httpLogger = (req, res, next) => {
    const send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        user: this.getUserInfo(req.user),
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: typeof resBody === 'string' ? resBody : JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    requestContext.run({ req }, next);
  };

  dbLogger(sql) {
    const store = requestContext.getStore();
    const user = this.getUserInfo(store?.req?.user);
    this.log('info', 'db', { sql, ...(user ? { user } : {}) });
  }

  factoryLogger(user, reqBody, resBody, statusCode) {
    const level = this.statusToLogLevel(statusCode);
    this.log(level, 'factory', {
      user: this.getUserInfo(user),
      statusCode,
      reqBody: JSON.stringify(reqBody),
      resBody: typeof resBody === 'string' ? resBody : JSON.stringify(resBody),
    });
  }

  unhandledErrorLogger(err, req) {
    this.log('error', 'unhandledError', {
      message: err?.message,
      stack: err?.stack,
      path: req?.originalUrl,
      method: req?.method,
      user: this.getUserInfo(req?.user),
    });
  }

  getUserInfo(user) {
    if (!user) return undefined;
    return { id: user.id, name: user.name, email: user.email };
  }

  log(level, type, logData) {
    const labels = { component: config.logging?.source || 'jwt-pizza-service', level, type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    let str = JSON.stringify(logData);
    str = str.replace(/\\"(password|token|jwt|apiKey|secret)\\"\s*:\s*\\"[^"]*\\"/gi, '\\"$1\\": \\"*****\\"');
    str = str.replace(/"(password|token|jwt|apiKey|secret)"\s*:\s*"[^"]*"/gi, '"$1": "*****"');
    return str;
  }

  sendLogToGrafana(event) {
    const { endpointUrl, accountId, apiKey } = config.logging || {};
    if (!endpointUrl || !accountId || !apiKey) return;

    const body = JSON.stringify(event);
    fetch(endpointUrl, {
      method: 'post',
      body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountId}:${apiKey}`,
      },
    })
      .then((res) => {
        if (!res.ok) console.log('Failed to send log to Grafana');
      })
      .catch(() => {});
  }
}

module.exports = new Logger();
