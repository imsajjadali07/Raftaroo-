export const config = {
  matcher: '/mart.html',
};

// Known social media / chat app crawlers jo link preview banate hain
const BOT_UA_REGEX = /facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Pinterest|redditbot|vkShare|Applebot/i;

export default async function middleware(request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('product');
  const ua = request.headers.get('user-agent') || '';

  // Sirf tab kaam karo jab request kisi bot se aayi ho AND product ID mojood ho
  // Warna normal user ko pehle jaisi SPA hi milegi (koi farq nahi padega)
  if (!productId || !BOT_UA_REGEX.test(ua)) {
    return;
  }

  try {
    // 1) Product ka data Firebase Realtime Database se fetch karo
    const dbUrl = `https://raftaroo-9ce8d-default-rtdb.asia-southeast1.firebasedatabase.app/martProducts/${encodeURIComponent(productId)}.json`;
    const prodRes = await fetch(dbUrl);
    const product = await prodRes.json();

    // Agar product na mile to normal default page hi serve hone do
    if (!product) return;

    // 2) Asal mart.html file ka HTML fetch karo
    const htmlRes = await fetch(new URL('/mart.html', request.url));
    let html = await htmlRes.text();

    // 3) Product ke hisaab se dynamic title/description/image banao
    const title = `${product.name || 'Product'} - Raftaroo Mart`;
    const desc = `Rs. ${parseInt(product.price) || 0} - ${product.name || ''} ab Raftaroo Mart par order karein.`;
    const image = product.image || 'https://iili.io/C7vaynp.jpg';
    const pageUrl = url.toString();

    const esc = (s) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 4) Head ke andar static OG/Twitter tags ko dynamic values se replace karo
    html = html
      .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${esc(title)}">`)
      .replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${esc(desc)}">`)
      .replace(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${esc(image)}">`)
      .replace(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${esc(pageUrl)}">`)
      .replace(/<meta name="twitter:title" content=".*?">/, `<meta name="twitter:title" content="${esc(title)}">`)
      .replace(/<meta name="twitter:description" content=".*?">/, `<meta name="twitter:description" content="${esc(desc)}">`)
      .replace(/<meta name="twitter:image" content=".*?">/, `<meta name="twitter:image" content="${esc(image)}">`);

    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    // Kisi bhi error ki surat mein normal page hi serve hone do, crash nahi hona chahiye
    return;
  }
}
