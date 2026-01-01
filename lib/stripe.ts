import Stripe from 'stripe'

// Server-side only - never import this file in client components
if (typeof window !== 'undefined') {
  throw new Error('Stripe server client should only be used server-side')
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Create stripe instance lazily - only fails when actually used
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2024-10-28.acacia',
      typescript: true,
    })
  }
  return stripeInstance
}

// For backwards compatibility - but prefer getStripe()
export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-10-28.acacia', typescript: true })
  : (null as unknown as Stripe)

// Check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!stripeSecretKey
}

// Currency configuration
export const DEFAULT_CURRENCY = 'pln'

// Helper to convert amount to Stripe format (cents/smallest unit)
export function toStripeAmount(amount: number): number {
  return Math.round(amount * 100)
}

// Helper to convert from Stripe format back to regular amount
export function fromStripeAmount(amount: number): number {
  return amount / 100
}