import Stripe from 'stripe';

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

/** Which Stripe account mode this deployment runs against. */
export function getStripeEnvironment(): StripeEnv {
  return process.env['STRIPE_ENVIRONMENT'] === 'live' ? 'live' : 'sandbox';
}

/**
 * Direct Stripe client. One secret key per deployment (STRIPE_SECRET_KEY);
 * sandbox vs live is a deployment concern, driven by STRIPE_ENVIRONMENT.
 */
export function createStripeClient(_env?: StripeEnv): Stripe {
  return new Stripe(getEnv('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-03-25.dahlia',
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const stripeError = error as { message?: string; raw?: { message?: string } };
    const message = stripeError.raw?.message ?? stripeError.message;
    if (message) return message;
  }
  return 'Плащането не може да бъде обработено.';
}

export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ id: string; type: string; data: { object: any } }> {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  const secret = env === 'sandbox'
    ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');

  if (!signature || !body) throw new Error('Missing signature or body');

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(',')) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = value;
    if (key === 'v1' && value) v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error('Invalid signature format');

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error('Webhook timestamp too old');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = Buffer.from(new Uint8Array(signed)).toString('hex');
  if (!v1Signatures.includes(expected)) throw new Error('Invalid webhook signature');

  return JSON.parse(body);
}