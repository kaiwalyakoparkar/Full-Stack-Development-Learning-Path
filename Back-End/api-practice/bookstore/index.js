//External library imports
const express = require('express');

//File imports
const booksRoute = require('./routes/booksRoute.js');
const userRoute = require('./routes/userRoute.js');

//Variable assignments
const app = express();

app.use('/api/v1/books', booksRoute);
app.use('/api/v1/users', userRoute);

module.exports = app;
