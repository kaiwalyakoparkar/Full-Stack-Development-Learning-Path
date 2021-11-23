//External library imports
const express = require('express');

//File imports
const booksRoute = require('./routes/booksRoute.js');
const userRoute = require('./routes/userRoute.js');
const globalErrorHandler = require('./controllers/errorController.js');
const appError = require('./util/appError.js');

//Variable assignments
const app = express();

app.use('/api/v1/books', booksRoute);
app.use('/api/v1/users', userRoute);
app.use(globalErrorHandler);

module.exports = app;
