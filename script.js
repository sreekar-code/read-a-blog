// -- Config -------------------------------------------

const feeds = [

  "https://sreekarscribbles.com/feed.xml",
  "https://aravindballa.com/rss.xml",
  "https://rss.beehiiv.com/feeds/arqSjkRars.xml",
  "https://www.vikra.cafe/feed.xml",
  "https://sive.rs/en.atom"
];

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeW6icje8Lrm2LwJf51H5SpdufMQMcbSiUmRthoc8I8YQ20yg/viewform';
const PROXY = '/.netlify/functions/rss-proxy?url=';

// -- State --------------------------------------------

let allPosts = null;
let current  = null;

// -- Data fetching ------------------------------------

async function loadFeeds() {
  const results = await Promise.allSettled(
    feeds.map(url =>
      fetch(PROXY + encodeURIComponent(url))
        .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
    )
  );

  const posts = [];
  for (const r of results) {
    if (r.status !== 'fulfilled' || r.value.status !== 'ok') continue;
    const blogName = r.value.feed.title;
    for (const item of r.value.items) {
      if (item.title && item.link) {
        posts.push({
          title: item.title.trim(),
          link:  item.link,
          blog:  blogName,
        });
      }
    }
  }
  return posts;
}

function pickRandom(pool, exclude = null) {
  const available = exclude ? pool.filter(p => p !== exclude) : pool;
  const source    = available.length > 0 ? available : pool;
  return source[Math.floor(Math.random() * source.length)] ?? null;
}

// -- DOM helpers --------------------------------------

function isSafeUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function setCardContent(post) {
  document.getElementById('card-blog').textContent  = post.blog;
  document.getElementById('card-title').textContent = post.title;
  const link = document.getElementById('card-link');
  link.href = isSafeUrl(post.link) ? post.link : '#';
}

// First reveal: button fades out, card fades+rises in
function revealCard(post) {
  setCardContent(post);

  const btnArea  = document.getElementById('btn-area');
  const cardArea = document.getElementById('card-area');
  const card     = document.getElementById('post-card');

  btnArea.style.transition = 'opacity 0.22s ease';
  btnArea.style.opacity    = '0';

  setTimeout(() => {
    btnArea.style.display = 'none';

    card.style.transition = 'none';
    card.style.opacity    = '0';
    card.style.transform  = 'translateY(22px)';
    cardArea.style.display = 'block';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = [
          'opacity   0.48s cubic-bezier(0.2, 0.8, 0.3, 1)',
          'transform 0.48s cubic-bezier(0.2, 0.8, 0.3, 1)',
        ].join(', ');
        card.style.opacity   = '1';
        card.style.transform = 'translateY(0)';
      });
    });
  }, 240);
}

// Subsequent swaps: quick fade out -> update -> fade back in
function swapCard(post) {
  const card = document.getElementById('post-card');

  card.style.transition = 'opacity 0.16s ease, transform 0.16s ease';
  card.style.opacity    = '0';
  card.style.transform  = 'translateY(10px)';

  setTimeout(() => {
    setCardContent(post);
    card.style.transition = [
      'opacity   0.38s cubic-bezier(0.2, 0.8, 0.3, 1)',
      'transform 0.38s cubic-bezier(0.2, 0.8, 0.3, 1)',
    ].join(', ');
    card.style.opacity   = '1';
    card.style.transform = 'translateY(0)';
  }, 170);
}

// -- Event handlers -----------------------------------

const readBtn  = document.getElementById('read-btn');
const errorMsg = document.getElementById('error-msg');

readBtn.addEventListener('click', async () => {
  readBtn.disabled       = true;
  readBtn.textContent    = 'Finding something good\u2026';
  errorMsg.style.display = 'none';

  try {
    if (!allPosts) allPosts = await loadFeeds();

    if (allPosts.length === 0) throw new Error('No posts found');

    current = pickRandom(allPosts);
    revealCard(current);

  } catch {
    errorMsg.textContent   = 'Couldn\u2019t load any posts. Please try again.';
    errorMsg.style.display = 'block';
    readBtn.disabled       = false;
    readBtn.textContent    = 'Read a Blog';
  }
});

document.getElementById('btn-another').addEventListener('click', () => {
  if (!allPosts || allPosts.length === 0) return;
  current = pickRandom(allPosts, current);
  swapCard(current);
});

const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

document.getElementById('blog-form').addEventListener('submit', e => {
  e.preventDefault();
  const blogUrl   = document.getElementById('input-url').value.trim();
  const name      = document.getElementById('input-name').value.trim();
  const honeypot  = document.getElementById('input-trap').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  // Honeypot triggered -- bot detected, silently drop
  if (honeypot) return;

  // Rate limit -- one submission per 10 minutes per browser
  const lastSubmit = parseInt(localStorage.getItem('rab_last_submit') || '0', 10);
  if (Date.now() - lastSubmit < RATE_LIMIT_MS) {
    submitBtn.textContent = 'Please wait a bit!';
    setTimeout(() => { submitBtn.textContent = 'Submit \u2192'; }, 2500);
    return;
  }

  // POST directly to Google Forms -- no redirect, data goes straight to the Sheet
  fetch(GOOGLE_FORM_URL.replace('/viewform', '/formResponse'), {
    method: 'POST',
    mode:   'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'entry.487552982':  blogUrl,
      'entry.1528747364': name,
    }),
  });

  // Optimistic confirmation -- no response comes back with no-cors
  localStorage.setItem('rab_last_submit', Date.now().toString());
  e.target.reset();
  submitBtn.textContent = 'Thanks!';
  submitBtn.disabled    = true;
  setTimeout(() => {
    submitBtn.textContent = 'Submit \u2192';
    submitBtn.disabled    = false;
  }, 3000);
});
