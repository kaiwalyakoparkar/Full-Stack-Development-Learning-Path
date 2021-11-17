const AppError = require('../util/appError.js');
require('dotenv').config();

//======================= Hadlind different opperational errors========

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
}

const handleDuplicateNameDB = (err) => {
  const message = `Tour with ${err.keyValue.name} name already exists in database`;
  return new AppError(message, 400);
}

const handleValidationErrorDB = (err) => {
  const errorMessage = Object.values(err.errors).map(el => el.message);
  const message = `${errorMessage.join('. ')}`;
  return new AppError(message, 400);
}

const handleIncorrectToken = (err) => {
  const message = 'Incorrect token please recheck or regenerate the token';
  return new AppError(message, 400);
}

const handleExpiredToken = (err) => {
  const message = 'Token has expired. Please loging again';
  return new AppError(message, 400);
}

//======================= Special functions according to env types ============
//Sending the error message if it is a dev environment
const sendErrorDev = (err, res) => {
	res.status(err.statusCode).json({
	    status: err.status,
	    message: err.message,
	    stack: err.stack,
	    error: err
  	});
}

//Sending the error message if it is a prod environment
const sendErrorProd = (err, res) => {
  if(err.isOperational) {
	    res.status(err.statusCode).json({
	      status: err.status,
	      message: err.message
    });

  //If not operational then don't leak the error message instead send a generic error message
  } else {
    res.json({
      err
    })
  }
}

//=========================== Exporting according to the env type================
//exporting the main error
module.exports = (err, req, res, next) => {

	//Setting the base information for the error response
	err.statusCode = err.statusCode || 500;
  	err.status = err.status || 'err';

  	//Now according to node environment (dev/prod) we will deside how would we show error message
  	if(process.env.NODE_ENV === 'dev') {
  		sendErrorDev(err, res);
  	} else if(process.env.NODE_ENV === 'prod') {
  		let error = err;

	    //If Invalid id provided as "/:id" argument
	    if(error.name === 'CastError') error = handleCastErrorDB(error);
	    
	    //If the tour name already exists in database
	    if(error.code === 11000) error = handleDuplicateNameDB(error);

	    //If the validation in mongoose model fails
	    if(error.name === 'ValidationError') error = handleValidationErrorDB(error);

	    //If the Token is incorrect
	    if(error.name === 'JsonWebTokenError') error = handleIncorrectToken(error);

	    //If the token is timedout
	    if(error.name === 'TokenExpiredError') error = handleExpiredToken(error);

	    sendErrorProd(error, res);
  	}
}