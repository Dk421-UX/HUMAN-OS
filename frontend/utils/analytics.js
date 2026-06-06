/**
 * Human OS — Google Analytics 4 Utility
 * Privacy-safe: never sends raw reflection text.
 * All events carry only metadata (counts, categories, labels).
 */

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

/**
 * Send a custom GA4 event.
 * @param {string} eventName  - GA4 event name (snake_case)
 * @param {Object} params     - Privacy-safe metadata only
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;

  try {
    window.gtag('event', eventName, {
      send_to: GA_MEASUREMENT_ID,
      ...params
    });
  } catch {
    // Fail silently — analytics should never break the app
  }
}

// ─────────────────────────────────────────────
// Reflection Events
// ─────────────────────────────────────────────

/** User submitted a reflection entry */
export function trackReflectionSubmitted(wordCount) {
  trackEvent('reflection_submitted', {
    word_count_range: getWordCountRange(wordCount)
  });
}

/** Patterns were detected after analysis */
export function trackPatternDetected(patternCount) {
  trackEvent('pattern_detected', {
    pattern_count: patternCount ?? 0
  });
}

/** A conflict was surfaced in the result */
export function trackConflictDetected(conflictCategory) {
  trackEvent('conflict_detected', {
    conflict_category: conflictCategory ?? 'unknown'
  });
}

/** An experiment/action was generated */
export function trackExperimentGenerated() {
  trackEvent('experiment_generated');
}

/** User clicked "Reflect Again" to reset */
export function trackReflectionReset() {
  trackEvent('reflection_reset');
}

// ─────────────────────────────────────────────
// Navigation / Page View Events
// ─────────────────────────────────────────────

export function trackMirrorViewed() {
  trackEvent('mirror_viewed');
}

export function trackDNAViewed() {
  trackEvent('dna_viewed');
}

export function trackGraphViewed() {
  trackEvent('graph_viewed');
}

export function trackTimelineViewed() {
  trackEvent('timeline_viewed');
}

export function trackVaultViewed() {
  trackEvent('vault_viewed');
}

// ─────────────────────────────────────────────
// Interaction Events
// ─────────────────────────────────────────────

/** User selected a pattern node on DNA page */
export function trackPatternSelected(patternName) {
  trackEvent('pattern_selected', {
    pattern_name: patternName ?? 'unknown'
  });
}

/** User clicked a node on the Graph */
export function trackNodeInspected(nodeName) {
  trackEvent('node_inspected', {
    node_name: nodeName ?? 'unknown'
  });
}

/** User opened the narrative dossier drawer on Graph */
export function trackDossierOpened(nodeName) {
  trackEvent('dossier_opened', {
    node_name: nodeName ?? 'unknown'
  });
}

/** User expanded a pattern card in Vault */
export function trackPatternExpanded(patternName) {
  trackEvent('pattern_expanded', {
    pattern_name: patternName ?? 'unknown'
  });
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getWordCountRange(count) {
  const n = Number(count) || 0;
  if (n < 20) return '0-20';
  if (n < 50) return '20-50';
  if (n < 100) return '50-100';
  if (n < 200) return '100-200';
  return '200+';
}
