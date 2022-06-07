const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getOverview = catchAsync(async (request, response, next) => {
  const tours = await Tour.find();

  response.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = catchAsync(async (request, response, next) => {
  const tour = await Tour.findOne({ slug: request.params.slug }).populate({
    path: 'reviews',
    select: 'review rating user',
  });

  if (!tour) {
    return next(new AppError('There is no tour with that name', 404));
  }

  response.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
  });
});

exports.getSignupForm = (request, response) => {
  response.status(200).render('signup', {
    title: 'Sign up!',
  });
};

exports.getLoginForm = (request, response) => {
  response.status(200).render('login', {
    title: 'Log into your account',
  });
};

exports.getAccount = (request, response) => {
  response.status(200).render('account', {
    title: 'Your account',
  });
};

exports.getMyTours = catchAsync(async (request, response, next) => {
  // find all bookings
  const bookings = await Booking.find({ user: request.user.id });

  // find tours with the returned IDs
  const tourIDs = bookings.map((el) => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIDs } });

  response.status(200).render('overview', {
    title: 'My Tours',
    tours,
  });
});

exports.updateUserData = catchAsync(async (request, response, next) => {
  const user = await User.findByIdAndUpdate(
    request.user.id,
    {
      name: request.body.name,
      email: request.body.email,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  response.status(200).render('account', {
    title: 'Your account',
    user,
  });
});
