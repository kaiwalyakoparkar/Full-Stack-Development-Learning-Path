const express = require('express');
const trainRoute = require('./routes/trainRoutes');

const app = express();

app.use('/api/trains', trainRoute);

module.exports = app;