const path = require('path');
const express = require('express');
const morgan = require('morgan');
const app = express();

const tourRoute = require(path.join(__dirname, './routes/tourRoutes.js'));
const userRoute = require(path.join(__dirname, './routes/userRoutes.js'));

//My custom middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

//External Middleware
app.use(express.json());

if(process.env.NODE_ENV === 'development'){
  app.use(morgan('dev'));
}

app.use(express.static(path.join(__dirname+'/public')));

//Routes Mounting.
app.use('/api/v1/tours', tourRoute);
app.use('/api/v1/users', userRoute);

//Error handling if no route is catched (This block of code should be always at last of route handling else it will throw this error for each and every request we make)
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `${req.originalUrl} was not found on the server. Please check the Url :)`
  });
  next();
});

//================= Starting the server==============
module.exports = app;