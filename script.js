// -- Config -------------------------------------------

const feeds = [

  "https://sreekarscribbles.com/feed.xml",
  "https://aravindballa.com/rss.xml",
  "https://rss.beehiiv.com/feeds/arqSjkRars.xml",
  "https://www.vikra.cafe/feed.xml",
  "https://sive.rs/en.atom"
];

const PROXY = '/.netlify/functions/rss-proxy?url=';

// -- State --------------------------------------------

let allPosts    = null;
let postsByBlog = null;  // Map<blogName, post[]>
let blogQueue   = [];    // shuffled rotation of blog names
let blogIndex   = 0;
let current     = null;

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

// Groups posts by blog name into a Map.
function buildPostMap(posts) {
  const map = new Map();
  for (const post of posts) {
    if (!map.has(post.blog)) map.set(post.blog, []);
    map.get(post.blog).push(post);
  }
  return map;
}

// Fisher-Yates shuffle, returns a new array.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Refills blogQueue with a fresh shuffle of all blog names.
// Ensures the first blog in the new cycle isn't the same as lastBlog
// (avoids a same-blog repeat at the cycle boundary).
function refillQueue(lastBlog = null) {
  blogQueue = shuffle([...postsByBlog.keys()]);
  if (lastBlog && blogQueue.length > 1 && blogQueue[0] === lastBlog) {
    const end = blogQueue.length - 1;
    [blogQueue[0], blogQueue[end]] = [blogQueue[end], blogQueue[0]];
  }
  blogIndex = 0;
}

// Picks the next post using a round-robin blog rotation.
// Each blog gets one slot per cycle; after all blogs have appeared the
// deck reshuffles. Never picks the same post object twice in a row.
function pickNext() {
  if (!postsByBlog || postsByBlog.size === 0) return null;
  if (blogIndex >= blogQueue.length) refillQueue(current?.blog);

  const blogName = blogQueue[blogIndex++];
  const posts    = postsByBlog.get(blogName);
  const available = (current && current.blog === blogName)
    ? posts.filter(p => p !== current)
    : posts;
  const pool = available.length > 0 ? available : posts;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
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
    if (!allPosts) {
      allPosts    = await loadFeeds();
      postsByBlog = buildPostMap(allPosts);
      refillQueue();
    }

    if (allPosts.length === 0) throw new Error('No posts found');

    current = pickNext();
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
  current = pickNext();
  swapCard(current);
});

const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

document.getElementById('blog-form').addEventListener('submit', async e => {
  e.preventDefault();
  const blogUrl   = document.getElementById('input-url').value.trim();
  const name      = document.getElementById('input-name').value.trim();
  const honeypot  = document.getElementById('input-trap').value;
  const token     = e.target.querySelector('[name="cf-turnstile-response"]')?.value || '';
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

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Submitting\u2026';

  try {
    const res = await fetch('/.netlify/functions/submit-blog', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ blogUrl, name, 'cf-turnstile-response': token }),
    });

    if (!res.ok) throw new Error('Submission failed');

    localStorage.setItem('rab_last_submit', Date.now().toString());
    e.target.reset();
    if (window.turnstile) window.turnstile.reset();
    submitBtn.textContent = 'Thanks!';
    setTimeout(() => {
      submitBtn.textContent = 'Submit \u2192';
      submitBtn.disabled    = false;
    }, 3000);
  } catch {
    if (window.turnstile) window.turnstile.reset();
    submitBtn.textContent = 'Try again';
    submitBtn.disabled    = false;
  }
});
