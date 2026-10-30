// UI controller — depends on data.js, storage.js, engine.js

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  view: 'search',
  searchDebounce: null,
  lastQuery: '',
  lastCategory: null,
  selectedCardIds: new Set(),
  selectedPortalIds: new Set(),
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function fmt(n) {
  return Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) + '%' : '—';
}

function fmtPortal(n) {
  return Number.isFinite(n) ? 'Up to ' + (Math.round(n * 10) / 10).toFixed(1) + '%' : '—';
}

function fmtDollar(rate) {
  return '$' + (Math.round(rate * 100) / 100).toFixed(2);
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function showToast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark')       html.setAttribute('data-theme','dark');
  else if (theme === 'light') html.setAttribute('data-theme','light');
  else                         html.removeAttribute('data-theme');
  const isLight = theme === 'light';
  const themeIcon = isLight
    ? '<i class="ph ph-moon" aria-hidden="true"></i>'
    : '<i class="ph ph-sun" aria-hidden="true"></i>';
  document.getElementById('btn-theme').innerHTML = themeIcon;
  const navThemeBtn = document.getElementById('btn-theme-nav');
  if (navThemeBtn) navThemeBtn.innerHTML = themeIcon;
}

function toggleTheme() {
  const s = getSettings();
  const next = s.theme === 'light' ? 'dark' : 'light';
  updateSettings({ theme: next });
  applyTheme(next);
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function navigate(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .left-nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById('panel-' + panelId);
  if (panel) panel.classList.add('active');
  document.querySelectorAll(`[data-panel="${panelId}"]`).forEach(n => n.classList.add('active'));
  state.view = panelId;
  if (panelId === 'cards')   renderCards();
  if (panelId === 'portals') renderPortals();
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function checkOnboarding() {
  const s = getSettings();
  if (!s.onboardingDone && getCards().length === 0) showOnboarding();
}

function showOnboarding() {
  document.getElementById('onboarding-overlay').removeAttribute('hidden');
  setOnboardingStep(1);
  renderObCardPicker();
}

function setOnboardingStep(step) {
  document.querySelectorAll('.onboarding-step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === step);
  });
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.remove('active','done');
    if (i + 1 === step) dot.classList.add('active');
    else if (i + 1 < step) dot.classList.add('done');
  });
}

function finishOnboarding() {
  updateSettings({ onboardingDone: true });
  document.getElementById('onboarding-overlay').setAttribute('hidden','');
  renderSearchState();
  navigate('search');
}

// ─── Search panel ─────────────────────────────────────────────────────────────

function renderSearchState() {
  const cards   = getCards();
  const empty   = document.getElementById('search-empty-state');
  const initial = document.getElementById('search-initial');
  const recent  = document.getElementById('recent-searches');
  const qs      = document.getElementById('quick-searches');
  const results = document.getElementById('search-results');

  results.setAttribute('hidden','');

  // Always populate popular stores (visible in both empty and has-cards states)
  if (qs) {
    const popular = ['Amazon','Walmart','Target','Macy\'s','Nike','Nordstrom','Chewy','Wayfair'];
    qs.innerHTML = popular.map(m => {
      const cat  = MERCHANT_DB[normalizeName(m)]?.category || 'retail';
      const icon = CATEGORY_META[cat]?.icon || 'ph ph-shopping-bag';
      return `<button class="recent-chip" data-search="${esc(m)}"><i class="${icon}" aria-hidden="true"></i> ${esc(m)}</button>`;
    }).join('');
  }

  if (!cards.length) {
    empty.removeAttribute('hidden');
    if (initial) initial.removeAttribute('hidden');
    if (recent)  recent.setAttribute('hidden','');
    return;
  }
  empty.setAttribute('hidden','');
  if (initial) initial.removeAttribute('hidden');

  // Favourite stores
  const favWrap = document.getElementById('fav-stores-wrap');
  const favList = document.getElementById('fav-stores');
  if (favWrap && favList) {
    const favs = getFavourites();
    if (favs.length) {
      favWrap.removeAttribute('hidden');
      favList.innerHTML = favs.map(f => `
        <span class="fav-item">
          <button class="recent-chip" data-search="${esc(f)}"><i class="ph-fill ph-star-fill" style="color:#F59E0B" aria-hidden="true"></i> ${esc(f)}</button>
          <button class="fav-remove-btn" data-fav-remove="${esc(f)}" title="Remove" aria-label="Remove ${esc(f)} from favourites"><i class="ph ph-x" aria-hidden="true"></i></button>
        </span>`).join('');
    } else {
      favWrap.setAttribute('hidden','');
    }
  }

  // Recent searches
  const recents = getRecentSearches();
  if (recents.length && recent) {
    recent.removeAttribute('hidden');
    document.getElementById('recent-list').innerHTML = recents.map(r => `
      <button class="recent-chip" data-search="${esc(r)}"><i class="ph ph-clock-counter-clockwise" aria-hidden="true"></i> ${esc(r)}</button>`).join('');
  } else if (recent) {
    recent.setAttribute('hidden','');
  }
}

function handleSearchInput(val) {
  const clearBtn = document.getElementById('search-clear');
  clearBtn.hidden = !val;
  const results = document.getElementById('search-results');
  const initial = document.getElementById('search-initial');

  if (!val) {
    results.setAttribute('hidden','');
    if (initial) initial.removeAttribute('hidden');
    closeAutocomplete();
    return;
  }

  clearTimeout(state.searchDebounce);
  if (val.length < 2) { closeAutocomplete(); return; }

  renderAutocomplete(getAutocompleteSuggestions(val));
  state.searchDebounce = setTimeout(() => runSearch(val), 380);
}

function renderAutocomplete(suggestions) {
  const dd = document.getElementById('search-autocomplete');
  if (!suggestions.length) { dd.setAttribute('hidden',''); return; }
  dd.removeAttribute('hidden');
  dd.innerHTML = suggestions.map(s =>
    `<div class="autocomplete-item" data-value="${esc(s)}"><i class="ph ph-magnifying-glass ac-icon" aria-hidden="true"></i> ${esc(s)}</div>`
  ).join('');
}

function closeAutocomplete() {
  document.getElementById('search-autocomplete').setAttribute('hidden','');
}

function runSearch(query) {
  if (!query || query.length < 2) return;
  closeAutocomplete();
  const cards = getCards();
  if (!cards.length) return;

  addRecentSearch(query);
  state.lastQuery    = query;
  state.lastCategory = null;

  const result = getRecommendations(query, cards, getPortals());
  renderResults(result);

  document.getElementById('search-initial').setAttribute('hidden','');
  document.getElementById('search-results').removeAttribute('hidden');

  // Async: fetch bank offer hints (non-blocking; section hidden until results arrive)
  document.getElementById('bank-offers').setAttribute('hidden','');
  const displayName = result.merchant.displayName || query;
  getBankOffers(displayName, cards).then(offers => renderBankOffers(offers, displayName));
}

function renderResults(result) {
  const { merchant, recommendations, unusedBest } = result;
  const catMeta = CATEGORY_META[merchant.category] || CATEGORY_META.default;

  const displayName = merchant.displayName || state.lastQuery;
  document.getElementById('results-merchant-name').textContent = displayName;
  document.getElementById('results-category-badge').innerHTML =
    `<i class="${catMeta.icon}" aria-hidden="true"></i> ${esc(CATEGORIES[merchant.category] || merchant.category)}`;

  const favBtn = document.getElementById('btn-fav-store');
  if (favBtn) {
    const starred = isFavourite(displayName);
    favBtn.innerHTML = `<i class="${starred ? 'ph-fill ph-star-fill' : 'ph ph-star'}" style="${starred ? 'color:#F59E0B' : ''}" aria-hidden="true"></i>`;
    favBtn.title     = starred ? 'Remove from favourites' : 'Add to favourites';
    favBtn.setAttribute('aria-label', starred ? 'Remove from favourites' : 'Add to favourites');
    favBtn.dataset.favStoreName = displayName;
  }

  if (!recommendations.length) {
    document.getElementById('best-combo').innerHTML = `
      <div class="no-results">
        <div class="no-results-icon"><i class="ph ph-credit-card" aria-hidden="true"></i></div>
        <h3>Add a card first</h3>
        <p>Go to My Cards and add your credit cards to see savings recommendations.</p>
      </div>`;
    document.getElementById('other-combos').innerHTML = '';
    document.getElementById('tip-banner').setAttribute('hidden','');
    document.getElementById('category-override').setAttribute('hidden','');
    return;
  }

  const [best, ...rest] = recommendations;
  document.getElementById('best-combo').innerHTML = buildBestComboCard(best, merchant);

  document.getElementById('other-combos').innerHTML = rest.length
    ? `<div class="other-combos-label">Other options</div>
       <div class="combos-list">${rest.map((c, i) => buildComboRow(c, i + 2)).join('')}</div>`
    : '';

  // Upsell if an unused portal has a better rate
  const tip = document.getElementById('tip-banner');
  if (unusedBest && unusedBest.rate > 0) {
    tip.removeAttribute('hidden');
    tip.innerHTML = `
      <div class="upsell-card">
        <div class="upsell-icon"><i class="ph ph-lightbulb" aria-hidden="true"></i></div>
        <div class="upsell-info">
          <div class="upsell-title">Up to +${unusedBest.rate}% more with ${esc(unusedBest.portalDef.name)}</div>
          <div class="upsell-body">Add ${esc(unusedBest.portalDef.name)} in My Portals to stack this cashback.</div>
        </div>
      </div>`;
  } else {
    tip.setAttribute('hidden','');
  }

  // Category override for unknown merchants
  const overrideEl = document.getElementById('category-override');
  if (!merchant.isKnown) {
    overrideEl.removeAttribute('hidden');
    document.getElementById('category-buttons').innerHTML = Object.entries(CATEGORIES)
      .filter(([k]) => k !== 'default')
      .map(([k, v]) => `<button class="cat-btn" data-cat="${k}">${CATEGORY_META[k]?.icon ? `<i class="${CATEGORY_META[k].icon}" aria-hidden="true"></i>` : ''} ${v}</button>`)
      .join('');
  } else {
    overrideEl.setAttribute('hidden','');
  }
}

function renderBankOffers(offers, merchantName) {
  const el = document.getElementById('bank-offers');
  if (!el || !offers.length) { if (el) el.setAttribute('hidden',''); return; }

  el.removeAttribute('hidden');
  el.innerHTML = `
    <div class="bank-offers-wrap">
      <div class="bank-offers-header">
        <i class="ph ph-tag" aria-hidden="true"></i>
        <span>Bank Offers at ${esc(merchantName)}</span>
        <span class="bank-offers-badge">Save more</span>
      </div>
      <div class="bank-offers-list">
        ${offers.map(o => {
          const link    = BANK_OFFER_LINKS[o.bank] || '#';
          const expiry  = o.expiresAt ? `Expires ${fmtDate(o.expiresAt)}` : '';
          const addedOn = o.addedAt   ? `Spotted ${fmtDate(o.addedAt)}`   : '';
          return `
            <div class="bank-offer-row">
              <div class="bank-offer-left">
                <div class="bank-offer-bank">${esc(o.bank)}</div>
                <div class="bank-offer-title">${esc(o.title)}</div>
                ${expiry  ? `<div class="bank-offer-meta"><i class="ph ph-clock" aria-hidden="true"></i> ${expiry}</div>` : ''}
                ${addedOn && !expiry ? `<div class="bank-offer-meta">${addedOn}</div>` : ''}
              </div>
              <a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm bank-offer-link">
                Check ${esc(o.bank)} Offers <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
              </a>
            </div>`;
        }).join('')}
      </div>
      <p class="bank-offers-note"><i class="ph ph-info" aria-hidden="true"></i> These offers may be targeted — check your account to confirm you have them before buying.</p>
    </div>`;
}

function buildBestComboCard(combo, merchant) {
  const card   = combo.card;
  const portal = combo.portal;
  const tmpl   = card.template;
  const total  = combo.total;
  const catName = CATEGORIES[merchant.category] || merchant.category;

  const pointNote = (tmpl.rewardType === 'points' || tmpl.rewardType === 'miles')
    ? ` · ${card.rate}× pts at ${(tmpl.pointValue * 100).toFixed(2)}¢/pt` : '';

  const bonusHtml = card.isBonusActive && card.bonusLabel
    ? `<div class="bonus-badge"><i class="ph ph-lightning" aria-hidden="true"></i> ${esc(card.bonusLabel)}</div>` : '';
  const bonusNoteHtml = card.isBonusActive && card.bonusNote
    ? `<br><span style="color:rgba(255,255,255,.5);font-size:.72rem">${esc(card.bonusNote)}</span>` : '';

  const portalRow = portal ? (() => {
    const staleHtml = portal.isStale
      ? `<span class="stale-badge" style="margin-left:4px"><i class="ph ph-warning" aria-hidden="true"></i> Verify</span>` : '';
    const freshHtml = portal.lastChecked
      ? `Checked ${fmtDate(portal.lastChecked)}` : '';
    return `
      <div class="breakdown-row">
        <div class="breakdown-icon"><i class="ph ph-storefront" aria-hidden="true"></i></div>
        <div class="breakdown-info">
          <div class="breakdown-name">${esc(portal.portalDef.name)}</div>
          <div class="breakdown-detail">${freshHtml}${staleHtml}</div>
        </div>
        <div class="breakdown-rate">${fmtPortal(portal.rate)}</div>
      </div>`;
  })() : '';

  const instruction = portal
    ? `<strong>Go to ${esc(merchant.displayName || state.lastQuery)}</strong> through
       <strong>${esc(portal.portalDef.name)}</strong>, then pay with your
       <strong>${esc(tmpl.name)}</strong>.`
    : `Pay with your <strong>${esc(tmpl.name)}</strong>.
       Add a cashback portal in My Portals for even more savings.`;

  return `
    <div class="best-combo-card">
      <div class="best-label"><i class="ph ph-trophy" aria-hidden="true"></i> Best Combo</div>
      <div class="best-total">${portal ? fmtPortal(total) : fmt(total)}</div>
      <div class="best-savings-amount">≈ ${fmtDollar(total)} saved on $100</div>
      <div class="best-total-label">total savings${portal ? ' stacked' : ''}</div>
      <div class="best-breakdown">
        <div class="breakdown-row">
          <div class="breakdown-icon"><i class="ph ph-credit-card" aria-hidden="true"></i></div>
          <div class="breakdown-info">
            <div class="breakdown-name">${esc(tmpl.name)}</div>
            <div class="breakdown-detail">${esc(catName)}${pointNote}</div>
            ${bonusHtml}${bonusNoteHtml}
          </div>
          <div class="breakdown-rate">${fmt(card.cashbackEquiv)}</div>
        </div>
        ${portalRow}
      </div>
      <div class="best-instruction">${instruction}</div>
    </div>`;
}

function buildComboRow(combo, rank) {
  const tmpl  = combo.card.template;
  const portal = combo.portal;
  const names  = portal ? `${tmpl.name} + ${portal.portalDef.name}` : tmpl.name;
  const detail = portal
    ? `${fmt(combo.card.cashbackEquiv)} card + ${fmtPortal(portal.rate)} portal`
    : `${fmt(combo.card.cashbackEquiv)} card cashback`;
  return `
    <div class="combo-card">
      <div class="combo-rank">${rank}</div>
      <div class="combo-info">
        <div class="combo-names">${esc(names)}</div>
        <div class="combo-details">${detail}</div>
      </div>
      <div class="combo-rate-wrap">
        <div class="combo-rate">${fmt(combo.total)}</div>
        <div class="combo-savings">≈ ${fmtDollar(combo.total)}</div>
      </div>
    </div>`;
}

// ─── Cards panel ──────────────────────────────────────────────────────────────

function renderCards() {
  const cards = getCards();
  const list  = document.getElementById('cards-list');
  const empty = document.getElementById('cards-empty');

  if (!cards.length) {
    list.innerHTML = '';
    empty.removeAttribute('hidden');
    return;
  }
  empty.setAttribute('hidden','');
  list.innerHTML = cards.map(uc => {
    const tmpl = CARD_TEMPLATES.find(t => t.id === uc.templateId);
    if (!tmpl) return '';
    const hasChosen = !!tmpl.chosenCategories;
    const chosenLabel = hasChosen && uc.chosenCategory
      ? tmpl.chosenCategories.find(c => c.key === uc.chosenCategory)?.label
      : null;
    return `
      <div class="card-tile">
        <div class="card-chip" style="background:${esc(tmpl.color)}">${esc(tmpl.issuer.substring(0,3).toUpperCase())}</div>
        <div class="card-tile-info">
          <div class="card-tile-name">${esc(tmpl.name)}</div>
          <div class="card-tile-sub">${esc(tmpl.tagline)}</div>
          ${chosenLabel ? `<div class="card-tile-category"><i class="ph ph-tag" aria-hidden="true"></i> ${esc(tmpl.chosenRate)}% on ${esc(chosenLabel)}</div>` : ''}
          ${hasChosen && !chosenLabel ? `<div class="card-tile-category" style="color:var(--warning, #F59E0B)"><i class="ph ph-warning" aria-hidden="true"></i> Select your ${tmpl.chosenRate}% category</div>` : ''}
        </div>
        <div class="card-tile-actions">
          ${hasChosen ? `<button class="btn-ghost" style="font-size:.8rem;padding:6px 10px" data-choose-category="${esc(uc.id)}" title="Change category" aria-label="Change category"><i class="ph ph-pencil" aria-hidden="true"></i></button>` : ''}
          <button class="btn-ghost" style="color:var(--danger);font-size:.8rem;padding:6px 10px" data-remove-card="${esc(uc.id)}" title="Remove" aria-label="Remove card"><i class="ph ph-x" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }).join('');
}

// ─── Portals panel ────────────────────────────────────────────────────────────

function renderPortals() {
  const portals = getPortals();
  const list    = document.getElementById('portals-list');
  const empty   = document.getElementById('portals-empty');

  if (!portals.length) {
    list.innerHTML = '';
    empty.removeAttribute('hidden');
    return;
  }
  empty.setAttribute('hidden','');
  list.innerHTML = portals.map(up => {
    const def = PORTAL_DB[up.portalId];
    if (!def) return '';
    const count = Object.values(def.rates || {}).filter(r => r.rate > 0).length;
    return `
      <div class="portal-tile">
        <div class="portal-dot" style="background:${esc(def.color)}"></div>
        <div class="portal-tile-info">
          <div class="portal-tile-name">${esc(def.name)}</div>
          <div class="portal-tile-sub">${count} merchants · rates updated Oct 2026</div>
        </div>
        <div class="portal-tile-actions">
          <button class="btn-ghost" style="color:var(--danger);font-size:.8rem;padding:6px 10px" data-remove-portal="${esc(up.id)}" title="Remove" aria-label="Remove portal"><i class="ph ph-x" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }).join('');
}

// ─── Card Picker Modal ────────────────────────────────────────────────────────

function openCardPicker() {
  state.selectedCardIds = new Set();
  document.getElementById('card-picker-search').value = '';
  renderCardPickerGrid('');
  document.getElementById('modal-card-picker').removeAttribute('hidden');
  setTimeout(() => document.getElementById('card-picker-search').focus(), 50);
}

function renderCardPickerGrid(filter) {
  const added = new Set(getCards().map(c => c.templateId));
  const norm  = filter.toLowerCase();
  const groups = {};

  CARD_TEMPLATES.forEach(t => {
    if (norm && !t.name.toLowerCase().includes(norm) && !t.issuer.toLowerCase().includes(norm)) return;
    if (!groups[t.issuer]) groups[t.issuer] = [];
    groups[t.issuer].push(t);
  });

  const html = Object.entries(groups).map(([issuer, templates]) => `
    <div class="picker-group-label">${esc(issuer)}</div>
    ${templates.map(t => {
      const isAdded = added.has(t.id);
      const isSel   = state.selectedCardIds.has(t.id);
      return `
        <div class="picker-item ${isSel ? 'selected' : ''} ${isAdded ? 'already-added' : ''}"
             data-pick-card="${esc(t.id)}"${isAdded ? ' title="Already in your wallet"' : ''}>
          <div class="picker-chip" style="background:${esc(t.color)}">${esc(t.issuer.substring(0,3).toUpperCase())}</div>
          <div class="picker-info">
            <div class="picker-name">${esc(t.name)}</div>
            <div class="picker-sub">${esc(t.highlight)}${t.annualFee ? ` · $${t.annualFee}/yr` : ' · no fee'}</div>
          </div>
          ${isAdded
            ? `<span class="picker-already"><i class="ph ph-check" aria-hidden="true"></i> Added</span>`
            : `<div class="picker-check">${isSel ? '<i class="ph ph-check" aria-hidden="true"></i>' : ''}</div>`
          }
        </div>`;
    }).join('')}
  `).join('');

  document.getElementById('card-picker-grid').innerHTML = html
    || `<p style="color:var(--text-3);text-align:center;padding:20px">No cards match</p>`;
  syncCardPickerFooter();
}

function syncCardPickerFooter() {
  const n   = state.selectedCardIds.size;
  const btn = document.getElementById('btn-add-cards-confirm');
  btn.textContent = n > 0 ? `Add ${n} Card${n > 1 ? 's' : ''}` : 'Add Cards';
  btn.style.opacity = n === 0 ? '.5' : '1';
  btn.disabled = n === 0;
}

function confirmAddCards() {
  const addedCards = [];
  state.selectedCardIds.forEach(id => {
    const card = addCard(id);
    if (card) addedCards.push(card);
  });
  closeModal('modal-card-picker');
  updateNavCounts();
  if (addedCards.length > 0) {
    renderCards();
    renderSearchState();
    showToast(`Added ${addedCards.length} card${addedCards.length > 1 ? 's' : ''}`, 'success');
    // Prompt for category on cards that need it
    const needsCat = addedCards.find(c => CARD_TEMPLATES.find(t => t.id === c.templateId)?.chosenCategories);
    if (needsCat) openCategoryPicker(needsCat.id);
  }
}

function openCategoryPicker(cardId) {
  const card = getCards().find(c => c.id === cardId);
  if (!card) return;
  const tmpl = CARD_TEMPLATES.find(t => t.id === card.templateId);
  if (!tmpl?.chosenCategories) return;

  const isMonthly = tmpl.id === 'paypal-debit';
  document.getElementById('cat-picker-title').textContent =
    `${tmpl.name}: ${tmpl.chosenRate}% Category`;
  document.getElementById('cat-picker-desc').textContent =
    isMonthly
      ? `Which category did you activate this month? Update it each month.`
      : `Which category did you choose for your 3% bonus? (Set once at BoA's website.)`;

  const catIcons = { dining:'fork-knife', gas:'gas-pump', grocery:'storefront', drugstore:'first-aid', retail:'shopping-bag', home:'house', travel:'airplane', default:'tag' };
  document.getElementById('cat-picker-list').innerHTML = tmpl.chosenCategories.map(c => `
    <button class="cat-picker-item${card.chosenCategory === c.key ? ' active' : ''}" data-cat-key="${esc(c.key)}" data-card-id="${esc(cardId)}">
      <i class="ph ph-${catIcons[c.category] || catIcons.default}" aria-hidden="true"></i>
      ${esc(c.label)}
    </button>`).join('');

  document.getElementById('modal-category-picker').removeAttribute('hidden');
}

// ─── Portal Selector Modal ────────────────────────────────────────────────────

function openPortalSelector() {
  state.selectedPortalIds = new Set(getPortals().map(p => p.portalId));
  renderPortalSelectorGrid();
  document.getElementById('modal-portal-selector').removeAttribute('hidden');
}

function renderPortalSelectorGrid() {
  document.getElementById('portal-selector-grid').innerHTML = Object.values(PORTAL_DB).map(def => {
    const sel = state.selectedPortalIds.has(def.id);
    return `
      <div class="portal-sel-item ${sel ? 'selected' : ''}" data-pick-portal="${esc(def.id)}">
        <div class="portal-sel-check">${sel ? '<i class="ph ph-check" aria-hidden="true"></i>' : ''}</div>
        <div class="portal-sel-dot" style="background:${esc(def.color)}"></div>
        <div class="portal-sel-name">${esc(def.name)}</div>
        <div class="portal-sel-sub">${esc(def.tagline)}</div>
      </div>`;
  }).join('');
}

function confirmPortalSelection() {
  const existing = getPortals();
  const existIds = new Set(existing.map(p => p.portalId));
  let added = 0, removed = 0;
  state.selectedPortalIds.forEach(id => { if (!existIds.has(id)) { addPortal(id); added++; } });
  existing.forEach(p => { if (!state.selectedPortalIds.has(p.portalId)) { removePortal(p.id); removed++; } });
  closeModal('modal-portal-selector');
  renderPortals();
  updateNavCounts();
  renderSearchState();
  const msgs = [];
  if (added)   msgs.push(`Added ${added} portal${added > 1 ? 's' : ''}`);
  if (removed) msgs.push(`Removed ${removed}`);
  if (msgs.length) showToast(msgs.join(', '), 'success');
}

// ─── Modal helper ─────────────────────────────────────────────────────────────

function closeModal(id) {
  document.getElementById(id).setAttribute('hidden','');
}

// ─── Onboarding card/portal pickers ──────────────────────────────────────────

function renderObCardPicker() {
  const container = document.getElementById('ob-card-picker');
  if (!container) return;
  state.selectedCardIds = new Set();

  const groups = {};
  CARD_TEMPLATES.forEach(t => {
    if (!groups[t.issuer]) groups[t.issuer] = [];
    groups[t.issuer].push(t);
  });

  container.innerHTML = `<div class="card-picker-grid">
    ${Object.entries(groups).map(([issuer, templates]) => `
      <div class="picker-group-label">${esc(issuer)}</div>
      ${templates.map(t => `
        <div class="picker-item" data-ob-card="${esc(t.id)}">
          <div class="picker-chip" style="background:${esc(t.color)}">${esc(t.issuer.substring(0,3).toUpperCase())}</div>
          <div class="picker-info">
            <div class="picker-name">${esc(t.name)}</div>
            <div class="picker-sub">${esc(t.highlight)}${t.annualFee ? ` · $${t.annualFee}/yr` : ' · no fee'}</div>
          </div>
          <div class="picker-check"></div>
        </div>`).join('')}
    `).join('')}
  </div>`;

  container.addEventListener('click', function handler(e) {
    const item = e.target.closest('[data-ob-card]');
    if (!item) return;
    const id = item.dataset.obCard;
    if (state.selectedCardIds.has(id)) state.selectedCardIds.delete(id);
    else state.selectedCardIds.add(id);
    item.classList.toggle('selected');
    item.querySelector('.picker-check').innerHTML = state.selectedCardIds.has(id) ? '<i class="ph ph-check" aria-hidden="true"></i>' : '';
    const n = state.selectedCardIds.size;
    const btn = document.getElementById('ob-cards-next');
    if (btn) btn.textContent = n > 0 ? `Continue with ${n} card${n>1?'s':''} →` : 'Continue →';
  }, { once: false });
}

function renderObPortalSelector() {
  const container = document.getElementById('ob-portal-selector');
  if (!container) return;
  state.selectedPortalIds = new Set();

  container.innerHTML = `<div class="portal-selector-grid">
    ${Object.values(PORTAL_DB).map(def => `
      <div class="portal-sel-item" data-ob-portal="${esc(def.id)}">
        <div class="portal-sel-check"></div>
        <div class="portal-sel-dot" style="background:${esc(def.color)}"></div>
        <div class="portal-sel-name">${esc(def.name)}</div>
        <div class="portal-sel-sub">${esc(def.tagline)}</div>
      </div>`).join('')}
  </div>`;

  container.addEventListener('click', function handler(e) {
    const item = e.target.closest('[data-ob-portal]');
    if (!item) return;
    const id = item.dataset.obPortal;
    if (state.selectedPortalIds.has(id)) state.selectedPortalIds.delete(id);
    else state.selectedPortalIds.add(id);
    item.classList.toggle('selected');
    item.querySelector('.portal-sel-check').innerHTML = state.selectedPortalIds.has(id) ? '<i class="ph ph-check" aria-hidden="true"></i>' : '';
  }, { once: false });
}

// ─── Export ───────────────────────────────────────────────────────────────────

function handleExport() {
  const blob = new Blob([exportData()], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'savings-wallet.json'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function wireEvents() {
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
  document.getElementById('btn-export').addEventListener('click', handleExport);

  // Left sidebar (desktop)
  document.querySelectorAll('.left-nav-item[data-panel]').forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.panel)));
  document.getElementById('btn-add-card-nav')?.addEventListener('click', openCardPicker);
  document.getElementById('btn-add-portal-nav')?.addEventListener('click', openPortalSelector);
  document.getElementById('btn-theme-nav')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-export-nav')?.addEventListener('click', handleExport);


  // Bottom nav (mobile)
  document.querySelectorAll('.nav-item[data-panel]').forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.panel)));

  // Search
  const input = document.getElementById('search-input');
  input.addEventListener('input', e => handleSearchInput(e.target.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const v = input.value.trim(); if (v.length >= 2) runSearch(v); }
    if (e.key === 'Escape') { closeAutocomplete(); input.blur(); }
  });
  document.getElementById('search-clear').addEventListener('click', () => {
    input.value = '';
    handleSearchInput('');
    renderSearchState();
  });
  document.getElementById('search-autocomplete').addEventListener('click', e => {
    const item = e.target.closest('.autocomplete-item');
    if (item) { input.value = item.dataset.value; closeAutocomplete(); runSearch(item.dataset.value); }
  });

  // Click outside autocomplete
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) closeAutocomplete();
  });

  // Favourite store toggle (in results header)
  document.getElementById('btn-fav-store').addEventListener('click', () => {
    const name = document.getElementById('btn-fav-store').dataset.favStoreName;
    if (!name) return;
    const isNowFav = toggleFavourite(name);
    const favBtn = document.getElementById('btn-fav-store');
    favBtn.innerHTML = `<i class="${isNowFav ? 'ph-fill ph-star-fill' : 'ph ph-star'}" style="${isNowFav ? 'color:#F59E0B' : ''}" aria-hidden="true"></i>`;
    favBtn.title     = isNowFav ? 'Remove from favourites' : 'Add to favourites';
    favBtn.setAttribute('aria-label', isNowFav ? 'Remove from favourites' : 'Add to favourites');
    showToast(isNowFav ? `${name} added to favourites` : `${name} removed from favourites`);
  });

  // Favourite chip remove (delegated, must come before chip handler)
  document.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-fav-remove]');
    if (removeBtn) {
      toggleFavourite(removeBtn.dataset.favRemove);
      renderSearchState();
      showToast(`${removeBtn.dataset.favRemove} removed from favourites`);
    }
  });

  // Recent / quick search chips (delegated)
  document.addEventListener('click', e => {
    const chip = e.target.closest('[data-search]');
    if (chip) {
      input.value = chip.dataset.search;
      navigate('search');
      runSearch(chip.dataset.search);
    }
  });

  // Nav from empty state
  document.querySelectorAll('[data-nav]').forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.nav)));

  // Cards panel
  document.getElementById('btn-add-card').addEventListener('click', openCardPicker);
  document.getElementById('btn-add-card-empty').addEventListener('click', openCardPicker);
  document.getElementById('cards-list').addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-remove-card]');
    if (removeBtn) { removeCard(removeBtn.dataset.removeCard); renderCards(); updateNavCounts(); renderSearchState(); showToast('Card removed'); return; }
    const catBtn = e.target.closest('[data-choose-category]');
    if (catBtn) openCategoryPicker(catBtn.dataset.chooseCategory);
  });

  // Category picker
  document.getElementById('modal-category-picker').addEventListener('click', e => {
    const item = e.target.closest('[data-cat-key]');
    if (item) {
      updateCardCategory(item.dataset.cardId, item.dataset.catKey);
      document.getElementById('modal-category-picker').setAttribute('hidden','');
      renderCards();
      renderSearchState();
      showToast('Category saved', 'success');
    }
    if (e.target.id === 'modal-category-picker') document.getElementById('modal-category-picker').setAttribute('hidden','');
  });
  document.getElementById('close-cat-picker').addEventListener('click', () =>
    document.getElementById('modal-category-picker').setAttribute('hidden',''));

  // Portals panel
  document.getElementById('btn-add-portal').addEventListener('click', openPortalSelector);
  document.getElementById('btn-add-portal-empty').addEventListener('click', openPortalSelector);
  document.getElementById('portals-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-portal]');
    if (btn) { removePortal(btn.dataset.removePortal); renderPortals(); updateNavCounts(); showToast('Portal removed'); }
  });

  // Card picker modal
  document.getElementById('card-picker-search').addEventListener('input', e => renderCardPickerGrid(e.target.value));
  document.getElementById('card-picker-grid').addEventListener('click', e => {
    const item = e.target.closest('[data-pick-card]');
    if (!item || item.classList.contains('already-added')) return;
    const id = item.dataset.pickCard;
    if (state.selectedCardIds.has(id)) state.selectedCardIds.delete(id);
    else state.selectedCardIds.add(id);
    item.classList.toggle('selected');
    item.querySelector('.picker-check').innerHTML = state.selectedCardIds.has(id) ? '<i class="ph ph-check" aria-hidden="true"></i>' : '';
    syncCardPickerFooter();
  });
  document.getElementById('btn-add-cards-confirm').addEventListener('click', confirmAddCards);
  document.getElementById('close-card-picker').addEventListener('click', () => closeModal('modal-card-picker'));
  document.getElementById('modal-card-picker').addEventListener('click', e => {
    if (e.target.id === 'modal-card-picker') closeModal('modal-card-picker');
  });

  // Portal selector modal
  document.getElementById('portal-selector-grid').addEventListener('click', e => {
    const item = e.target.closest('[data-pick-portal]');
    if (!item) return;
    const id = item.dataset.pickPortal;
    if (state.selectedPortalIds.has(id)) state.selectedPortalIds.delete(id);
    else state.selectedPortalIds.add(id);
    renderPortalSelectorGrid();
  });
  document.getElementById('btn-portal-confirm').addEventListener('click', confirmPortalSelection);
  document.getElementById('close-portal-selector').addEventListener('click', () => closeModal('modal-portal-selector'));
  document.getElementById('modal-portal-selector').addEventListener('click', e => {
    if (e.target.id === 'modal-portal-selector') closeModal('modal-portal-selector');
  });

  // Category override
  document.getElementById('category-buttons').addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    state.lastCategory = btn.dataset.cat;
    const result = getRecommendations(state.lastQuery, getCards(), getPortals());
    result.merchant.category = btn.dataset.cat;
    renderResults(result);
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modal-card-picker');
      closeModal('modal-portal-selector');
    }
  });

  // Onboarding
  const obStart      = document.getElementById('ob-start');
  const obSkip       = document.getElementById('ob-skip');
  const obCardsNext  = document.getElementById('ob-cards-next');
  const obPortalsDone= document.getElementById('ob-portals-done');
  const obPortalsSkip= document.getElementById('ob-portals-skip');
  if (obStart)       obStart.addEventListener('click', () => setOnboardingStep(2));
  if (obSkip)        obSkip.addEventListener('click', finishOnboarding);
  if (obCardsNext)   obCardsNext.addEventListener('click', () => {
    if (state.selectedCardIds.size === 0 && getCards().length === 0) {
      showToast('Pick at least one card', 'danger'); return;
    }
    state.selectedCardIds.forEach(id => addCard(id));
    state.selectedCardIds.clear();
    setOnboardingStep(3);
    renderObPortalSelector();
  });
  if (obPortalsDone) obPortalsDone.addEventListener('click', () => {
    state.selectedPortalIds.forEach(id => addPortal(id));
    state.selectedPortalIds.clear();
    finishOnboarding();
  });
  if (obPortalsSkip) obPortalsSkip.addEventListener('click', finishOnboarding);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function updateNavCounts() {
  const cardCount   = getCards().length;
  const portalCount = getPortals().length;
  const cc = document.getElementById('nav-cards-count');
  const pc = document.getElementById('nav-portals-count');
  if (cc) { cc.textContent = cardCount;   cc.hidden = cardCount === 0; }
  if (pc) { pc.textContent = portalCount; pc.hidden = portalCount === 0; }
}

function init() {
  applyTheme(getSettings().theme);
  loadLiveRates();           // fetch sheet rates; falls back silently if unavailable
  wireEvents();
  renderCards();
  renderPortals();
  updateNavCounts();
  renderSearchState();
  checkOnboarding();
}

document.addEventListener('DOMContentLoaded', init);
