const AppError = require('../utils/appError');

const handleCastErrorDB = (error) => {
  const message = `Invalid ${error.path}: ${error.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (error) => {
  const value = error.keyValue.name;
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (error) => {
  const errors = Object.values(error.errors).map((element) => element.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = (error) => {
  const message = 'Invalid token. Please log in again!';
  return new AppError(message, 401);
};

const handleJWTExpiredError = (error) => {
  const message = `Your token has expired! Please log in again!`;
  return new AppError(message, 401);
};

const sendErrorDev = (error, request, response) => {
  if (request.originalUrl.startsWith('/api')) {
    // API
    response.status(error.statusCode).json({
      status: error.status,
      error: error,
      message: error.message,
      stack: error.stack,
    });
  } else {
    // RENDERED WEBSITE
    console.error('ERROR', error);

    response.status(error.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: error.message,
    });
  }
};

const sendErrorProduction = (error, request, response) => {
  if (request.originalUrl.startsWith('/api')) {
    // API
    if (error.isOperational) {
      return response.status(error.statusCode).json({
        status: error.status,
        message: error.message,
      });
    }

    // log error to console
    console.error('ERROR', error);

    // don't leak error details
    return response.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }

  // RENDERED WEBSITE
  if (error.isOperational) {
    response.status(error.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: error.message,
    });
  } else {
    // log error to console
    console.error('ERROR', error);

    // don't leak error details
    response.status(500).render('error', {
      title: 'Something went very wrong!',
      msg: 'Please try again later.',
    });
  }
};

module.exports = (error, request, response, next) => {
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, request, response);
  } else {
    let err = { ...error };
    err.message = error.message;

    if (err.name === 'CastError') {
      err = handleCastErrorDB(err);
    }

    if (err.code === 11000) {
      err = handleDuplicateFieldsDB(err);
    }

    if (err._message === 'Tour validation failed') {
      err = handleValidationErrorDB(err);
    }

    if (err.name === 'JsonWebTokenError') {
      err = handleJWTError(err);
    }

    if (err.name === 'TokenExpiredError') {
      err = handleJWTExpiredError(err);
    }

    sendErrorProduction(err, request, response);
  }
};
