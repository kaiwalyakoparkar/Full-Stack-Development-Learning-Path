const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err
  });
}

const sendErrorProd = (err, res) => {
  //If operational then send the alloted error message
  if(err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });

  //If not operational then don't leak the error message instead send a generic error message
  } else {
    //1) Log the error in the console so that you can get a report of the error
    console.error('Error 💥 :',err);

    //2) Send generic message to the user.
    res.status(500).json({
      status: 'error',
      message: 'This error seems to be non-operational. You can join the support channels on discord to ask your questions'
    })
  }
  
}

module.exports = (err, req, res, next) => {

  // console.log(err.stack);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'err';

  if(process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if(process.env.NODE_ENV === 'production') {
    sendErrorProd(err, res);
  }
  
}