document.addEventListener('DOMContentLoaded', () => {
  const scrapeForm = document.getElementById('scrape-form');
  const targetUrlInput = document.getElementById('target-url');
  const clearBtn = document.getElementById('clear-btn');
  const scrapeBtn = document.getElementById('scrape-btn');
  const btnSpinner = scrapeBtn.querySelector('.spinner');
  const btnText = scrapeBtn.querySelector('.btn-text');
  
  const modeSelect = document.getElementById('mode-select');
  const resultsSection = document.getElementById('results-section');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  const copyJsonBtn = document.getElementById('copy-json-btn');
  const downloadJsonBtn = document.getElementById('download-json-btn');
  const downloadCsvBtn = document.getElementById('download-csv-btn');
  
  const jsonOutputCode = document.getElementById('json-output-code');
  const productGridView = document.getElementById('product-grid-view');
  const productCountLabel = document.getElementById('product-count-label');
  
  const responseStatusBadge = document.getElementById('response-status-badge');
  const extractedTimestamp = document.getElementById('extracted-timestamp');
  
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  let currentScrapedData = null;

  // FAQ Accordions Toggle
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = btn.nextElementSibling;
      const icon = btn.querySelector('.faq-icon');
      const isHidden = answer.classList.contains('hidden');
      
      document.querySelectorAll('.faq-answer').forEach(a => a.classList.add('hidden'));
      document.querySelectorAll('.faq-icon').forEach(i => i.textContent = '+');

      if (isHidden) {
        answer.classList.remove('hidden');
        icon.textContent = '−';
      }
    });
  });

  clearBtn.addEventListener('click', () => {
    targetUrlInput.value = '';
    targetUrlInput.focus();
  });

  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      targetUrlInput.value = btn.dataset.url;
      modeSelect.value = 'category';
      targetUrlInput.focus();
    });
  });

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  scrapeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = targetUrlInput.value.trim();
    if (!url) return;

    setLoadingState(true);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          mode: modeSelect.value
        })
      });

      const result = await response.json();
      setLoadingState(false);

      if (!response.ok) {
        showToast(result.error || 'Scrapify failed to extract data', 'error');
        displayErrorInJsonViewer(result);
        return;
      }

      currentScrapedData = result;
      displayResults(result);
      addToHistory(url);
      showToast('Scrapify: Extracted successfully!', 'success');

    } catch (err) {
      setLoadingState(false);
      showToast('Connection error to Scrapify engine server', 'error');
      console.error(err);
    }
  });

  function displayResults(data) {
    resultsSection.classList.remove('hidden');

    responseStatusBadge.textContent = `HTTP ${data.http_status} OK`;
    responseStatusBadge.className = 'badge badge-success';
    extractedTimestamp.textContent = `Extracted at ${new Date(data.extracted_at).toLocaleTimeString()}`;

    const products = (data.data && data.data.products) ? data.data.products : [];
    productCountLabel.textContent = `${products.length} products found`;

    jsonOutputCode.innerHTML = syntaxHighlightJson(data);
    renderProductGrid(products);

    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  function displayErrorInJsonViewer(errObj) {
    resultsSection.classList.remove('hidden');
    responseStatusBadge.textContent = 'HTTP 500 ERROR';
    responseStatusBadge.className = 'badge';
    responseStatusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
    responseStatusBadge.style.color = '#ef4444';

    jsonOutputCode.innerHTML = syntaxHighlightJson(errObj);
    productGridView.innerHTML = `<p class="empty-state">Extraction failed: ${errObj.error}</p>`;
  }

  function syntaxHighlightJson(jsonObj) {
    let str = JSON.stringify(jsonObj, null, 2);
    str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
  }

  function renderProductGrid(products) {
    productGridView.innerHTML = '';
    if (!products || products.length === 0) {
      productGridView.innerHTML = `<p class="empty-state">No individual product cards found on this page.</p>`;
      return;
    }

    products.forEach((p, idx) => {
      const name = p.name || p.title || `Product #${idx + 1}`;
      const price = p.price || p.discount_price || 'N/A';
      const img = p.image || 'https://via.placeholder.com/200x200?text=No+Image';
      const url = p.product_url || p.url || '#';

      const card = document.createElement('div');
      card.className = 'grid-product-card';
      card.innerHTML = `
        <div class="grid-product-img">
          <img src="${img}" alt="${name}" onerror="this.src='https://via.placeholder.com/200x200?text=No+Image'" />
        </div>
        <div class="grid-product-title">${name}</div>
        <div class="grid-product-price">${price}</div>
        ${url !== '#' ? `<a href="${url}" target="_blank" rel="noopener" class="grid-product-link">View Product Page ↗</a>` : ''}
      `;
      productGridView.appendChild(card);
    });
  }

  copyJsonBtn.addEventListener('click', () => {
    if (!currentScrapedData) return;
    navigator.clipboard.writeText(JSON.stringify(currentScrapedData, null, 2));
    showToast('JSON copied to clipboard!', 'success');
  });

  downloadJsonBtn.addEventListener('click', () => {
    if (!currentScrapedData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentScrapedData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `scrapify_data_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Downloaded Scrapify JSON file!', 'success');
  });

  downloadCsvBtn.addEventListener('click', () => {
    if (!currentScrapedData || !currentScrapedData.data) return;
    const products = currentScrapedData.data.products || [];
    if (products.length === 0) {
      showToast('No products array to export to CSV', 'error');
      return;
    }

    const headers = ['name', 'price', 'discount_price', 'image', 'product_url', 'brand'];
    const csvRows = [
      headers.join(','),
      ...products.map(p => headers.map(h => JSON.stringify(p[h] || p.title || '')).join(','))
    ];

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvRows.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scrapify_products_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Exported Scrapify CSV!', 'success');
  });

  function addToHistory(url) {
    let history = JSON.parse(localStorage.getItem('scrape_history') || '[]');
    history = history.filter(h => h.url !== url);
    history.unshift({ url, timestamp: new Date().toISOString() });
    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem('scrape_history', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    let history = JSON.parse(localStorage.getItem('scrape_history') || '[]');
    if (history.length === 0) {
      historyList.innerHTML = `<p class="empty-state">No extractions performed yet.</p>`;
      return;
    }

    historyList.innerHTML = '';
    history.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <span class="history-url">${item.url}</span>
        <span class="history-time">${new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      `;
      el.addEventListener('click', () => {
        targetUrlInput.value = item.url;
        scrapeForm.dispatchEvent(new Event('submit'));
      });
      historyList.appendChild(el);
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('scrape_history');
    renderHistory();
  });

  renderHistory();

  function setLoadingState(isLoading) {
    if (isLoading) {
      scrapeBtn.disabled = true;
      btnSpinner.classList.remove('hidden');
      btnText.textContent = 'Scrapifying Data...';
    } else {
      scrapeBtn.disabled = false;
      btnSpinner.classList.add('hidden');
      btnText.textContent = 'Scrapify Now (JSON)';
    }
  }

  function showToast(msg, type = 'info') {
    toastMessage.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3500);
  }
});
