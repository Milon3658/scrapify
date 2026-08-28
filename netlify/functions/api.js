const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(baseUrl, relativeUrl) {
  if (!relativeUrl) return '';
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch (e) {
    return relativeUrl;
  }
}

function extractJsonLd($, baseUrl) {
  const jsonLdItems = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const rawText = $(el).html();
      if (!rawText) return;
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) jsonLdItems.push(...parsed);
      else jsonLdItems.push(parsed);
    } catch (e) {}
  });
  return jsonLdItems;
}

function extractNextData($, baseUrl) {
  const products = [];
  try {
    const nextDataRaw = $('#__NEXT_DATA__').html();
    if (nextDataRaw) {
      const parsed = JSON.parse(nextDataRaw);
      function findProductsInObj(obj, depth = 0) {
        if (!obj || depth > 8) return;
        if (Array.isArray(obj)) {
          obj.forEach(item => findProductsInObj(item, depth + 1));
          return;
        }
        if (typeof obj === 'object') {
          const keys = Object.keys(obj).map(k => k.toLowerCase());
          const hasName = keys.some(k => k.includes('name') || k.includes('title') || k === 'pv_name');
          const hasPrice = keys.some(k => k.includes('price') || k.includes('mrp') || k === 'pv_mrp');
          
          if ((hasName && hasPrice) || obj.sku || obj.product_id || obj.attached_product) {
            const name = obj.name || obj.title || obj.pv_name || obj.attached_product?.name || '';
            const price = obj.price || obj.mrp || obj.pv_mrp || obj.attached_product?.mrp || obj.unit_price || '';
            const discPrice = obj.discounted_price || obj.discount_price || obj.sales_price || '';
            const image = obj.image || obj.image_url || obj.attached_product?.attached_files?.[0]?.src || obj.img || '';
            const url = obj.url || obj.slug ? `/product/${obj.slug}` : '';
            const brand = obj.brand || obj.manufacturer || obj.company || '';

            if (name && (price || image || url)) {
              products.push({
                name: cleanText(String(name)),
                price: price ? String(price) : null,
                discount_price: discPrice ? String(discPrice) : null,
                image: toAbsoluteUrl(baseUrl, String(image)),
                product_url: url ? toAbsoluteUrl(baseUrl, String(url)) : null,
                brand: brand ? String(brand) : null,
                raw_item: obj
              });
              return;
            }
          }
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) findProductsInObj(obj[key], depth + 1);
          }
        }
      }
      findProductsInObj(parsed);
    }
  } catch (e) {}

  const uniqueProducts = [];
  const seenNames = new Set();
  for (const p of products) {
    if (p.name && !seenNames.has(p.name.toLowerCase())) {
      seenNames.add(p.name.toLowerCase());
      uniqueProducts.push(p);
    }
  }
  return uniqueProducts;
}

function extractCategoryProductGrid($, baseUrl) {
  const products = [];
  const cardSelectors = [
    '.product-card', '.product-item', '.product', '.item',
    '[class*="ProductCard"]', '[class*="productCard"]', '[class*="MedicineCard"]',
    '[class*="product-card"]', '[class*="medicine-card"]', '[class*="item-card"]',
    '.grid-item', '.col-product', 'article', 'li.product'
  ];

  let cardElements = $();
  for (const sel of cardSelectors) {
    const found = $(sel);
    if (found.length >= 2) {
      cardElements = found;
      break;
    }
  }

  if (cardElements.length < 2) {
    $('a').each((_, a) => {
      const $a = $(a);
      if ($a.find('img').length > 0 && ($a.text().includes('৳') || $a.text().includes('$') || $a.text().includes('Tk') || $a.text().includes('BDT') || /\d+/.test($a.text()))) {
        cardElements = cardElements.add($a.parent());
      }
    });
  }

  cardElements.each((index, el) => {
    const $card = $(el);
    let title = cleanText($card.find('h1, h2, h3, h4, h5, .title, .name, [class*="title"], [class*="name"]').first().text());
    if (!title) {
      const imgAlt = $card.find('img').first().attr('alt');
      if (imgAlt && imgAlt.length > 3) title = cleanText(imgAlt);
    }

    let price = '';
    let oldPrice = '';
    $card.find('.price, [class*="price"], [class*="Price"], span, div').each((_, pEl) => {
      const txt = cleanText($(pEl).text());
      if ((txt.includes('৳') || txt.includes('$') || txt.includes('Tk') || txt.includes('BDT') || /^\d+(\.\d+)?$/.test(txt)) && txt.length < 30) {
        if (!price) price = txt;
        else if (txt !== price && !oldPrice) oldPrice = txt;
      }
    });

    let image = $card.find('img').first().attr('src') ||
                $card.find('img').first().attr('data-src') ||
                $card.find('img').first().attr('srcset');
    if (image && image.includes(' ')) image = image.split(' ')[0];

    let link = $card.find('a').first().attr('href') || $card.attr('href');
    if (!link) {
      const parentLink = $card.closest('a').attr('href');
      if (parentLink) link = parentLink;
    }

    let unit = cleanText($card.find('.unit, .size, [class*="unit"], [class*="size"], [class*="pack"]').first().text());
    let brand = cleanText($card.find('.brand, .company, [class*="company"], [class*="brand"]').first().text());

    if (title && (price || image || link)) {
      products.push({
        id: index + 1,
        title,
        price: price || 'N/A',
        original_price: oldPrice || null,
        unit: unit || null,
        brand: brand || null,
        image: toAbsoluteUrl(baseUrl, image),
        product_url: toAbsoluteUrl(baseUrl, link)
      });
    }
  });

  return products;
}

function extractMetaData($, baseUrl) {
  return {
    title: $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '',
    description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
    canonical: $('link[rel="canonical"]').attr('href') || baseUrl,
    openGraphImage: $('meta[property="og:image"]').attr('content') || ''
  };
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid URL is required' })
      };
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const userAgent = getRandomUserAgent();
    const response = await axios.get(formattedUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const jsonLdData = extractJsonLd($, formattedUrl);
    const metaData = extractMetaData($, formattedUrl);
    const nextDataProducts = extractNextData($, formattedUrl);
    const domGridProducts = extractCategoryProductGrid($, formattedUrl);

    let allCategoryProducts = nextDataProducts.length > 0 ? nextDataProducts : domGridProducts;

    const outputJson = {
      generator: 'Scrapify v1.0 (Netlify Serverless Function)',
      status: 'success',
      extracted_at: new Date().toISOString(),
      source_url: formattedUrl,
      http_status: response.status,
      meta: metaData,
      json_ld: jsonLdData,
      data: {
        page_type: 'category_listing',
        total_products_found: allCategoryProducts.length,
        products: allCategoryProducts
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(outputJson)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: error.message || 'Scraping failed'
      })
    };
  }
};
