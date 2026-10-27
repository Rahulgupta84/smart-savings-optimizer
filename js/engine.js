// Recommendation engine.
// Depends on: data.js (CARD_TEMPLATES, PORTAL_DB, MERCHANT_DB, CATEGORY_KEYWORDS, normalizeName)

// ─── Merchant Identification ──────────────────────────────────────────────────

function identifyMerchant(input) {
  const norm = normalizeName(input);
  if (!norm) return { displayName: '', category: 'default', isKnown: false, normalizedInput: '' };

  if (MERCHANT_DB[norm]) {
    const m = MERCHANT_DB[norm];
    return { displayName: m.displayName, category: m.category, isKnown: true, normalizedInput: norm };
  }

  for (const [key, val] of Object.entries(MERCHANT_DB)) {
    if (key.includes(norm) || norm.includes(key)) {
      return { displayName: val.displayName, category: val.category, isKnown: true, normalizedInput: norm };
    }
  }

  const lower = input.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { displayName: input, category: cat, isKnown: false, normalizedInput: norm };
    }
  }

  return { displayName: input, category: 'default', isKnown: false, normalizedInput: norm };
}

// ─── Card Effective Rate ──────────────────────────────────────────────────────

function getEffectiveCardRate(userCard, merchantInfo) {
  const template = CARD_TEMPLATES.find(t => t.id === userCard.templateId);
  if (!template) return null;

  const category  = merchantInfo.category;
  const norm      = merchantInfo.normalizedInput;
  const rewards   = template.rewards || {};
  let baseRate    = rewards[category] ?? rewards.default ?? 1;
  let bonusLabel  = null;
  let isBonusActive = false;

  // Check current quarter rotating bonus
  const bonus = template.currentBonus;
  if (bonus) {
    const catMatch      = bonus.categories && bonus.categories.includes(category);
    const merchantMatch = bonus.merchants  && bonus.merchants.some(m => normalizeName(m) === norm);
    if ((catMatch || merchantMatch) && bonus.rate > baseRate) {
      baseRate      = bonus.rate;
      bonusLabel    = bonus.quarter;
      isBonusActive = true;
    }
  }

  // Convert points to cashback-equivalent
  let cashbackEquiv;
  if (template.rewardType === 'points' || template.rewardType === 'miles') {
    cashbackEquiv = baseRate * (template.pointValue || 0.01) * 100;
  } else {
    cashbackEquiv = baseRate;
  }

  return {
    template,
    userCard,
    rate:         baseRate,
    cashbackEquiv: +cashbackEquiv.toFixed(2),
    isBonusActive,
    bonusLabel,
    bonusNote:    isBonusActive ? bonus.note : null,
  };
}

// ─── Portal Rates ─────────────────────────────────────────────────────────────

function getPortalRatesForMerchant(userPortals, merchantInfo) {
  const norm    = merchantInfo.normalizedInput;
  const results = [];

  for (const up of userPortals) {
    const portalDef = PORTAL_DB[up.portalId];
    if (!portalDef) continue;

    const rates = portalDef.rates || {};
    let match = rates[norm];

    // Fuzzy fallback
    if (!match) {
      for (const [key, val] of Object.entries(rates)) {
        if (key.includes(norm) || (norm.length >= 4 && norm.includes(key))) {
          match = val;
          break;
        }
      }
    }

    if (!match || match.rate <= 0) continue;

    const daysSince = match.lastChecked
      ? Math.floor((Date.now() - new Date(match.lastChecked).getTime()) / 86400000)
      : null;

    results.push({
      portalDef,
      userPortal: up,
      rate:        match.rate,
      lastChecked: match.lastChecked,
      isStale:     daysSince !== null && daysSince > 45,
      daysOld:     daysSince,
    });
  }

  return results.sort((a, b) => b.rate - a.rate);
}

// ─── Best Portal From ALL portals (for upsell) ────────────────────────────────

function getBestUnusedPortalRate(userPortals, merchantInfo) {
  const norm         = merchantInfo.normalizedInput;
  const addedIds     = new Set(userPortals.map(p => p.portalId));
  let   best         = null;

  for (const [portalId, portalDef] of Object.entries(PORTAL_DB)) {
    if (addedIds.has(portalId)) continue;
    const rates = portalDef.rates || {};
    let match = rates[norm];
    if (!match) {
      for (const [key, val] of Object.entries(rates)) {
        if (key.includes(norm) || (norm.length >= 4 && norm.includes(key))) { match = val; break; }
      }
    }
    if (!match || match.rate <= 0) continue;
    if (!best || match.rate > best.rate) {
      best = { portalDef, rate: match.rate, lastChecked: match.lastChecked };
    }
  }

  return best;
}

// ─── Main Recommendations ─────────────────────────────────────────────────────

function getRecommendations(merchantInput, userCards, userPortals) {
  const merchantInfo  = identifyMerchant(merchantInput);
  const cardResults   = userCards.map(uc => getEffectiveCardRate(uc, merchantInfo)).filter(Boolean);
  const portalResults = getPortalRatesForMerchant(userPortals, merchantInfo);

  const combos = [];

  for (const cr of cardResults) {
    for (const pr of portalResults) {
      combos.push({ card: cr, portal: pr, total: +(cr.cashbackEquiv + pr.rate).toFixed(2) });
    }
    combos.push({ card: cr, portal: null, total: cr.cashbackEquiv });
  }

  combos.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return (b.portal ? 1 : 0) - (a.portal ? 1 : 0);
  });

  const seen   = new Set();
  const unique = combos.filter(c => {
    const key = (c.card.userCard.id || '') + '|' + (c.portal?.userPortal.id || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const unusedBest = getBestUnusedPortalRate(userPortals, merchantInfo);

  return {
    merchant:      merchantInfo,
    recommendations: unique.slice(0, 5),
    portalCount:   portalResults.length,
    unusedBest,
  };
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

function getAutocompleteSuggestions(input) {
  const norm = normalizeName(input);
  if (norm.length < 2) return [];

  const candidates = new Map();

  for (const [key, val] of Object.entries(MERCHANT_DB)) {
    if (key.includes(norm)) {
      candidates.set(val.displayName, { name: val.displayName, priority: key.startsWith(norm) ? 2 : 1 });
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)
    .map(c => c.name);
}
