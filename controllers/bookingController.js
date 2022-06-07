const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.getCheckoutSession = catchAsync(async (request, response, next) => {
  // get currently booked tour
  const tour = await Tour.findById(request.params.tourID);

  // create checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],

    success_url: `${request.protocol}://${request.get('host')}/?tour=${
      request.params.tourID
    }&user=${request.user.id}&price=${tour.price}`,

    cancel_url: `${request.protocol}://${request.get('host')}/tour/${
      tour.slug
    }`,

    customer_email: request.user.email,
    client_reference_id: request.params.tourID,
    line_items: [
      {
        name: `${tour.name} Tour`,
        description: tour.summary,
        images: [`https://www.natours.dev/img/tours/${tour.imageCover}`],
        amount: tour.price * 100,
        currency: 'usd',
        quantity: 1,
      },
    ],
  });

  // create session as response
  response.status(200).json({
    status: 'success',
    session,
  });
});

exports.createBookingCheckout = catchAsync(async (request, response, next) => {
  const { tour, user, price } = request.query;
  if (!tour || !user || !price) return next();

  await Booking.create({ tour, user, price });
  response.redirect(request.originalUrl.split('?')[0]);
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
