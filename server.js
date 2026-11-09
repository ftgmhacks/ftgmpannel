import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FLUX_BASE_URL = 'https://gofluxpay.com';
const SITE_DOMAIN = (process.env.SITE_DOMAIN || 'https://pak-digital.store').replace(/\/$/, '');

// Memory cache jo Admin Panel se keys utha kar yaad rakhega (No .env needed!)
let runtimeFluxConfig = {
  merchantId: process.env.FLUX_MERCHANT_ID || 'mrc_f9e4b27a91f41dc4',
  apiKey: process.env.FLUX_PAYIN_API_KEY || '',
  webhookSecret: process.env.FLUX_WEBHOOK_SECRET || ''
};

// 1. Webhook Listener (Reads raw body BEFORE express.json())
app.post('/webhooks/flux', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body;
    const signature = (req.headers['x-flux-signature'] || '').toString().trim();
    const secret = runtimeFluxConfig.webhookSecret;

    // Agar secret mojood hai toh HMAC-SHA256 verify karein
    if (secret && signature) {
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expectedSig, 'utf8');

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    console.log('[Flux Webhook Received]', event.event, event.payment_id, event.order_id);

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Flux Webhook Error]', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.use(express.json());
app.use(express.static(__dirname));

// 2. Create Flux Hosted Checkout Session
app.post('/api/flux/create', async (req, res) => {
  try {
    const { amount, order_id, payer_email, customer_name, merchant_id, api_key, webhook_secret } = req.body;

    // Admin Panel (Firestore) se aane wali keys ko server memory mein update kar lein
    if (merchant_id) runtimeFluxConfig.merchantId = merchant_id;
    if (api_key) runtimeFluxConfig.apiKey = api_key;
    if (webhook_secret) runtimeFluxConfig.webhookSecret = webhook_secret;

    const mid = runtimeFluxConfig.merchantId;
    const key = runtimeFluxConfig.apiKey;

    if (!mid || !key) {
      return res.status(500).json({ error: 'Flux Pay API Key is not set yet. Please save it in Admin Panel -> Settings & Keys.' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 1 || numAmount > 10000000) {
      return res.status(422).json({ error: 'Invalid amount. Must be between PKR 1.00 and 10,000,000.00' });
    }

    const formattedAmount = numAmount.toFixed(2);
    const cleanOrderId = String(order_id || 'FLX-' + Date.now()).slice(0, 95);
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer_email)
      ? payer_email
      : 'customer@pak-digital.store';

    const payload = {
      merchant_id: mid,
      amount: formattedAmount,
      order_id: cleanOrderId,
      merchant_order_id: cleanOrderId,
      payer_email: validEmail,
      customer_name: customer_name || 'Pak Digital User',
      return_url: `${SITE_DOMAIN}/funds.html?flux_order_id=${encodeURIComponent(cleanOrderId)}`,
      webhook_url: `${SITE_DOMAIN}/webhooks/flux`
    };

    const response = await fetch(`${FLUX_BASE_URL}/api/v1/payments/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Idempotency-Key': cleanOrderId
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if ((response.status === 201 || response.status === 200) && data.success && data.payment?.checkout_url) {
      return res.status(201).json(data);
    }

    return res.status(response.status || 400).json({
      error: data.message || data.error || 'Failed to initialize Flux Pay checkout',
      details: data
    });
  } catch (err) {
    console.error('[Flux Create Session Error]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 3. Server-to-Server Payment Status Verification
app.get('/api/flux/status', async (req, res) => {
  try {
    const paymentId = req.query.payment_id;
    const mid = req.query.merchant_id || runtimeFluxConfig.merchantId;
    const key = req.headers['x-flux-key'] || runtimeFluxConfig.apiKey;

    if (!paymentId || !mid || !key) {
      return res.status(400).json({ error: 'Missing payment_id or merchant credentials' });
    }

    const url = `${FLUX_BASE_URL}/api/v1/payments/status?payment_id=${encodeURIComponent(paymentId)}&merchant_id=${encodeURIComponent(mid)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[Flux Status Check Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pak Digital server running on port ${PORT}`));
