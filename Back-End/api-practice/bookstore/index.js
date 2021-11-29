//External library imports
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');

//File imports
const booksRoute = require('./routes/booksRoute.js');
const userRoute = require('./routes/userRoute.js');
const globalErrorHandler = require('./controllers/errorController.js');
const appError = require('./util/appError.js');

//Variable assignments
const app = express();

app.use(cors());
app.options('*', cors());

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

app.use(helmet());

if(process.env.NODE_ENV === 'development') {
	app.use(morgan('dev'));
}

const limiter = rateLimit({
  max: 100,
  windowMs: 60*60*1000,
  message: 'Too many request from this IP please try again later after an hour'
});
app.use('/api', limiter);

app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp({
  whitelist: [
    'duration',
    'ratingQuantity',
    'ratingAverage',
    'maxGroupSize',
    'difficulty',
    'price'
  ]
}));

app.use(compression());

app.use('/api/v1/books', booksRoute);
app.use('/api/v1/users', userRoute);

app.use(globalErrorHandler);

app.all('*', (req, res, next) => {
	next(new appError(`${req.originalUrl} was not found on the server. Please check the Url :D`));
});

module.exports = app;
