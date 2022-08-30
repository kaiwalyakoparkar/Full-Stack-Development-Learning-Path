//Package and file imports
const express = require('express');
const guessRoute = require('./routes/guessRoutes')

//variable declarations
const app = express();

//Middlewares
app.use('/api/v1/', guessRoute);

//Exports
module.exports = app;