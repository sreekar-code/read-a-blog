const Parser = require('rss-parser');

// Must match the feeds array in script.js exactly.
// Requests for any other URL are rejected with 403.
const ALLOWED_FEEDS = new Set([
  'https://sreekarscribbles.com/feed.xml',
  'https://aravindballa.com/rss.xml',
  'https://rss.beehiiv.com/feeds/arqSjkRars.xml',
  'https://www.vikra.cafe/feed.xml',
  'https://sive.rs/en.atom',
]);

exports.handler = async (event) => {
  const url = event.queryStringParameters?.url;

  if (!url) {
    return { statusCode: 400, headers: json(), body: JSON.stringify({ error: 'Missing url parameter' }) };
  }

  if (!ALLOWED_FEEDS.has(url)) {
    return { statusCode: 403, headers: json(), body: JSON.stringify({ error: 'Feed not allowed' }) };
  }

  try {
    const feed = await new Parser().parseURL(url);
    return {
      statusCode: 200,
      headers: json(),
      body: JSON.stringify({
        status: 'ok',
        feed:  { title: feed.title },
        items: feed.items.map(item => ({ title: item.title, link: item.link })),
      }),
    };
  } catch {
    return { statusCode: 500, headers: json(), body: JSON.stringify({ error: 'Failed to fetch feed' }) };
  }
};

function json() {
  return { 'Content-Type': 'application/json' };
}
