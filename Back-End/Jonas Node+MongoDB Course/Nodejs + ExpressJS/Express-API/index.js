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


// ================== ERROR HANDLING ===============

//error handling if no route is catched (This block of code should be always at last of route handling else it will throw this error for each and every request we make)
app.all('*', (req, res, next) => {

  //Earlier error handler
  // res.status(404).json({
  //   status: 'fail',
  //   message: `${req.originalUrl} was not found on the server. Please check the Url :)`
  // });

  //Passing the error to new global error handler
  const err = new Error(`${req.originalUrl} was not found on the server. Please check the Url :)`);
  err.statusCode = 404;
  err.status = 'fail';
  //whenever something is passed in next in any middleware then it is always considered as error and then sent to global error handling middleware.
  next(err);
});

//error handling middleware
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'err';

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message
  });
  next();
});

//================= Starting the server==============
module.exports = app;