const BLOG = 't.nico-ruge.de';
const LIMIT = 10;

const stripHtml = (s = '') =>
  s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

exports.handler = async () => {
  const key = process.env.TUMBLR_API_KEY;
  if (!key) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing TUMBLR_API_KEY' }),
    };
  }

  const url = `https://api.tumblr.com/v2/blog/${BLOG}/posts/text?api_key=${encodeURIComponent(key)}&limit=${LIMIT}&filter=text`;

  try {
    const r = await fetch(url);
    if (!r.ok) {
      return {
        statusCode: r.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Tumblr API ${r.status}` }),
      };
    }
    const data = await r.json();
    const posts = (data?.response?.posts || []).map((p) => {
      const body = p.body || '';
      const summary = (p.summary || '').trim();
      const excerpt = summary || stripHtml(body).slice(0, 200);
      return {
        id: String(p.id),
        title: p.title || stripHtml(body).slice(0, 80) || '(untitled)',
        excerpt,
        date: p.date,
        url: p.post_url,
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
      body: JSON.stringify({ posts }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream error', detail: String(err) }),
    };
  }
};
