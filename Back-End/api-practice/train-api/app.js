const express = require("express");
const trainRoute = require('./routes/trainRoutes');

const app = express();

app.use('/api/', trainRoute)

module.exports = app;