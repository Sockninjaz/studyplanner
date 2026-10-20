import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('STRIPE_SECRET_KEY is missing from environment variables.');
  }
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_build', {
  apiVersion: '2024-06-20' as any,
  appInfo: {
    name: 'StudyPlanner Netherlands',
    version: '1.0.0',
    url: 'https://studyplanner.nl',
  },
});
