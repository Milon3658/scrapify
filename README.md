# Scrapify 🚀

**Scrapify** is a universal web data collection and structured JSON extraction tool. Paste any website URL, e-commerce product link, or category catalog (such as Arogga, Amazon, or Shopify collections), and Scrapify will extract all product data into clean, structured **JSON** format.

---

## ✨ Features

- 🛍️ **Multi-Product Category Extractor**: Automatically scans category listings, catalogs, and search results to extract arrays of product items (`name`, `price`, `discount_price`, `image`, `product_url`, `brand`).
- ⚡ **Smart Microdata & Hydration Parser**: Automatically parses `<script type="application/ld+json">` microdata and Next.js / React hydration state (`__NEXT_DATA__`).
- 🛒 **E-Commerce & Amazon Extractor**: Extracts title, prices, ratings, review count, stock availability, bullet features, and specifications.
- 🎨 **Visual Product Grid Preview**: Displays extracted product items in interactive visual cards alongside syntax-highlighted JSON.
- 📥 **One-Click Export**: Copy JSON to clipboard, download `.json` files, or export category product lists to `.csv`.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/Milon3658/scrapify.git
cd scrapify
```

### 2. Install dependencies & Start Server
```bash
npm install
npm start
```

### 3. Open in Browser
Visit **`http://localhost:3000`** in your browser.

---

## 🌐 Deployment Options

### Netlify Deployment (100% Free, No Credit Card)
```bash
npx netlify-cli deploy --prod
```

### Firebase Deployment
```bash
firebase deploy
```

---

## 📝 License

MIT License
