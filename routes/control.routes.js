const express = require('express');

const router = express.Router();

[
  require('./dashboard.routes'),
  require('./athletes.routes'),
  require('./groups.routes'),
  require('./trainings.routes'),
  require('./payments.routes'),
  require('./personal.routes'),
  require('./calendar.routes'),
  require('./tasks.routes'),
  require('./expenses.routes'),
  require('./statistics.routes'),
  require('./settings.routes'),
].forEach((domainRouter) => router.use(domainRouter));

module.exports = router;
