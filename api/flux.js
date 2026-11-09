export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const apiKey = body.api_key || process.env.FLUX_PAYIN_API_KEY || 'flx_live_fc9d2e8c8ff430e64e9c37921922655c2736d9b66143aa99';
    const mid = body.merchant_id || process.env.FLUX_MERCHANT_ID || 'mrc_f9e4b27a91f41dc4';

    const payload = {
      merchant_id: mid,
      amount: Number(body.amount || 30).toFixed(2),
      order_id: body.order_id,
      merchant_order_id: body.order_id,
      payer_email: body.payer_email || 'customer@pak-digital.store',
      customer_name: body.customer_name || 'Pak Digital User',
      return_url: body.return_url || 'https://pak-digital.store/funds.html'
    };

    const response = await fetch('https://gofluxpay.com/api/v1/payments/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
