const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeW6icje8Lrm2LwJf51H5SpdufMQMcbSiUmRthoc8I8YQ20yg/formResponse';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: json(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const params  = new URLSearchParams(event.body);
  const token   = params.get('cf-turnstile-response') || '';
  const blogUrl = (params.get('blogUrl') || '').trim();
  const name    = (params.get('name')    || '').trim();

  // Basic URL validation
  try {
    const { protocol } = new URL(blogUrl);
    if (protocol !== 'https:' && protocol !== 'http:') throw new Error();
  } catch {
    return { statusCode: 400, headers: json(), body: JSON.stringify({ error: 'Invalid URL' }) };
  }

  // Verify Turnstile token server-side
  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || '';
  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret:   process.env.TURNSTILE_SECRET,
      response: token,
      remoteip: ip,
    }),
  });
  const { success } = await verifyRes.json();

  if (!success) {
    return { statusCode: 400, headers: json(), body: JSON.stringify({ error: 'CAPTCHA verification failed' }) };
  }

  // Forward to Google Forms
  await fetch(GOOGLE_FORM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'entry.487552982':  blogUrl,
      'entry.1528747364': name,
    }),
  }).catch(() => {});

  return { statusCode: 200, headers: json(), body: JSON.stringify({ ok: true }) };
};

function json() {
  return { 'Content-Type': 'application/json' };
}
