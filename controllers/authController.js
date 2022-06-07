const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, request, response) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: request.secure || request.headers('x-forwarded-proto') === 'https',
  };

  // Remove password from output
  user.password = undefined;

  response.cookie('jwt', token, cookieOptions).status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (request, response, next) => {
  const newUser = await User.create({
    name: request.body.name,
    email: request.body.email,
    password: request.body.password,
    passwordConfirm: request.body.passwordConfirm,
  });

  const url = `${request.protocol}://${request.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, request, response);
});

exports.login = catchAsync(async (request, response, next) => {
  const { email, password } = request.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  createSendToken(user, 200, request, response);
});

exports.logout = (request, response) => {
  response.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  response.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (request, response, next) => {
  let token;
  if (
    request.headers.authorization &&
    request.headers.authorization.startsWith('Bearer')
  ) {
    // console.log('Bearer');
    token = request.headers.authorization.split(' ')[1];
  } else if (request.cookies.jwt) {
    token = request.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access', 401)
    );
  }

  // Verify token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // Check if user still exists
  const user = await User.findById(decoded.id);

  if (!user) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exists',
        401
      )
    );
  }

  // Check if user changed password after the token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again', 401)
    );
  }

  request.user = user;
  next();
});

// only for rendered pages, no errors!
exports.isLoggedIn = async (request, response, next) => {
  if (request.cookies.jwt) {
    try {
      const token = request.cookies.jwt;

      // Verify token
      const decoded = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
      );

      // Check if user still exists
      const user = await User.findById(decoded.id);

      if (!user) {
        return next();
      }

      // Check if user changed password after the token was issued
      if (user.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // there is a logged in user
      response.locals.user = user;
    } catch (err) {
      // do nothing
    }
  }

  next();
};

exports.restrictTo =
  (...roles) =>
  (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };

exports.forgotPassword = catchAsync(async (request, response, next) => {
  // get user based on POSTed email
  const user = await User.findOne({ email: request.body.email });

  if (!user) {
    return next(new AppError('There is no user with that email address', 404));
  }

  // generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // send it to user's email
  const resetURL = `${request.protocol}://${request.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  try {
    await new Email(user, resetURL).sendPasswordReset();

    response.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (request, response, next) => {
  // get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(request.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // set new password if user exists and token has not expired
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.password = request.body.password;
  user.passwordConfirm = request.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // log user in and send JWT
  createSendToken(user, 200, request, response);
});

exports.updatePassword = catchAsync(async (request, response, next) => {
  // get user
  const user = await User.findById(request.user.id).select('+password');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // check if POSTed password is correct
  if (!(await user.correctPassword(request.body.password, user.password))) {
    return next(new AppError('Incorrect password', 401));
  }

  // update password
  user.password = request.body.newPassword;
  user.passwordConfirm = request.body.newPasswordConfirm;
  await user.save();

  // log user in and send JWT
  createSendToken(user, 200, request, response);
});
