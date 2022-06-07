/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

const stripe = Stripe(
  'pk_test_51L7am7SAkQhFOH5vOgjMnY48VWqHnYlmId8qQ9x3MXl1gSkvVyBSwwgqWspHitD068FWK5LP2A9lunZWtJVjpkLi00OJ4DJxsi'
);

export const bookTour = async (tourId) => {
  try {
    // get checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    showAlert('error', err);
  }
};
