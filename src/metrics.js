const os = require('os');
const config = require('./config');

class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.requestsByMethod = {
      GET: 0,
      POST: 0,
      PUT: 0,
      DELETE: 0,
    };

    this.activeUsers = 0;

    this.authAttempts = {
      success: 0,
      failed: 0,
    };

    this.pizzaPurchases = {
      sold: 0,
      failures: 0,
      revenue: 0,
    };

    this.serviceLatencyTotal = 0;
    this.serviceLatencyCount = 0;

    this.pizzaCreationLatencyTotal = 0;
    this.pizzaCreationLatencyCount = 0;

    // Send metrics periodically if metrics config is available
    if (config.metrics && config.metrics.endpointUrl && config.metrics.apiKey) {
      this.timer = setInterval(() => {
        try {
          this.sendMetricsPeriodically();
        } catch (err) {
          console.error('Error sending metrics periodically:', err);
        }
      }, 10000);
      if (this.timer.unref) {
        this.timer.unref();
      }
    }
  }

  requestTracker = (req, res, next) => {
    const start = Date.now();
    this.totalRequests++;

    const method = req.method ? req.method.toUpperCase() : 'UNKNOWN';
    if (this.requestsByMethod[method] !== undefined) {
      this.requestsByMethod[method]++;
    }

    res.on('finish', () => {
      const duration = Date.now() - start;
      this.serviceLatencyTotal += duration;
      this.serviceLatencyCount++;
    });

    next();
  };

  recordAuth(success) {
    if (success) {
      this.authAttempts.success++;
    } else {
      this.authAttempts.failed++;
    }
  }

  recordActiveUser(delta) {
    this.activeUsers = Math.max(0, this.activeUsers + delta);
  }

  recordPizzaPurchase(success, count, price, latencyMs) {
    if (success) {
      this.pizzaPurchases.sold += count;
      this.pizzaPurchases.revenue += Number(price || 0);
    } else {
      this.pizzaPurchases.failures++;
    }

    if (latencyMs !== undefined && latencyMs >= 0) {
      this.pizzaCreationLatencyTotal += latencyMs;
      this.pizzaCreationLatencyCount++;
    }
  }

  getCpuUsagePercentage() {
    try {
      const cpus = os.cpus();
      const numCpus = cpus && cpus.length ? cpus.length : 1;
      const cpuUsage = os.loadavg()[0] / numCpus;
      return Math.round(cpuUsage * 100);
    } catch {
      return 0;
    }
  }

  getMemoryUsagePercentage() {
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsage = (usedMemory / totalMemory) * 100;
      return Math.round(memoryUsage);
    } catch {
      return 0;
    }
  }

  createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes = {}) {
    const source = config.metrics?.source || 'jwt-pizza-service';
    attributes = { ...attributes, source };

    const metric = {
      name: metricName,
      unit: metricUnit,
      [metricType]: {
        dataPoints: [
          {
            [valueType]: metricValue,
            timeUnixNano: Date.now() * 1000000,
            attributes: [],
          },
        ],
      },
    };

    Object.keys(attributes).forEach((key) => {
      metric[metricType].dataPoints[0].attributes.push({
        key: key,
        value: { stringValue: String(attributes[key]) },
      });
    });

    if (metricType === 'sum') {
      metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
      metric[metricType].isMonotonic = true;
    }

    return metric;
  }

  buildMetricsList() {
    const metrics = [];

    // 1. HTTP requests (total & by method)
    metrics.push(this.createMetric('request_total', this.totalRequests, '1', 'sum', 'asInt', {}));
    ['GET', 'POST', 'PUT', 'DELETE'].forEach((method) => {
      metrics.push(
        this.createMetric('request_by_method_total', this.requestsByMethod[method] || 0, '1', 'sum', 'asInt', { method })
      );
    });

    // 2. Active users
    metrics.push(this.createMetric('active_users', this.activeUsers, '1', 'gauge', 'asInt', {}));

    // 3. Auth attempts (success vs fail)
    metrics.push(this.createMetric('auth_attempts_total', this.authAttempts.success, '1', 'sum', 'asInt', { status: 'success' }));
    metrics.push(this.createMetric('auth_attempts_total', this.authAttempts.failed, '1', 'sum', 'asInt', { status: 'failed' }));

    // 4. System metrics (CPU and Memory)
    metrics.push(this.createMetric('cpu_usage_percent', this.getCpuUsagePercentage(), '%', 'gauge', 'asInt', {}));
    metrics.push(this.createMetric('memory_usage_percent', this.getMemoryUsagePercentage(), '%', 'gauge', 'asInt', {}));

    // 5. Pizza metrics (sold, failures, revenue)
    metrics.push(this.createMetric('pizzas_sold_total', this.pizzaPurchases.sold, '1', 'sum', 'asInt', {}));
    metrics.push(this.createMetric('pizza_failures_total', this.pizzaPurchases.failures, '1', 'sum', 'asInt', {}));
    metrics.push(this.createMetric('pizza_revenue_total', Math.round(this.pizzaPurchases.revenue * 100), 'cents', 'sum', 'asInt', {}));

    // 6. Latency metrics (service endpoint and pizza creation)
    metrics.push(this.createMetric('service_latency_ms_total', this.serviceLatencyTotal, 'ms', 'sum', 'asInt', {}));
    metrics.push(this.createMetric('pizza_creation_latency_ms_total', this.pizzaCreationLatencyTotal, 'ms', 'sum', 'asInt', {}));

    return metrics;
  }

  sendMetricsPeriodically() {
    if (!config.metrics || !config.metrics.endpointUrl) {
      return;
    }

    const metrics = this.buildMetricsList();
    const body = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics,
            },
          ],
        },
      ],
    };

    fetch(config.metrics.endpointUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
      .then((res) => {
        if (!res.ok) {
          res.text().then((text) => console.error(`Failed to push metrics to Grafana: ${res.status} ${text}`));
        }
      })
      .catch((err) => {
        console.error('Error sending metrics:', err.message);
      });
  }
}

const metricsInstance = new Metrics();
module.exports = metricsInstance;
