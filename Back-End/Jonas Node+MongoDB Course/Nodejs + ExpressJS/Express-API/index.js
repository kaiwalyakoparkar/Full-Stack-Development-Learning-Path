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
app.use(morgan('dev'));

//Routs Mounting.
app.use('/api/v1/tours', tourRoute);
app.use('/api/v1/users', userRoute);

//================= Starting the server==============
const port = 5000;

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
