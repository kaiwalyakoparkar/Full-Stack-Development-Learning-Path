//External library imports
const express = require('express');

//File imports
const booksRoute = require('./routes/booksRoute.js');

//Variable assignments
const app = express();

app.use('/api/v1/books', booksRoute);

module.exports = app;