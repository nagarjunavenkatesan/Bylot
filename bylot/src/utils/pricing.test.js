/**
 * Unit tests for src/utils/pricing.js
 * Run with: node --test src/utils/pricing.test.js
 * (D4 requirement: normal case, zero discount, missing MRP, selling above MRP,
 *  rounding, large numbers, NaN/null inputs, zero selling price, server percent)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getProductPricing, sumOrderSavings } from './pricing.js';

// ─── getProductPricing ──────────────────────────────────────────────────────

describe('getProductPricing — normal savings', () => {
  it('computes amount, percent, labels for a standard discount', () => {
    const p = getProductPricing({ mrp: 100, sellingPrice: 70 });
    assert.equal(p.hasSavings, true);
    assert.equal(p.discountPercent, 30);
    assert.equal(p.savingsAmount, 30);
    assert.match(p.savingsLabel, /You save/i);
    assert.match(p.savingsLabel, /30%/);
    assert.match(p.ariaLabel, /30 rupees/i);
    assert.match(p.ribbonLabel, /30% OFF/i);
    assert.ok(p.formattedSelling, 'formattedSelling must be defined');
    assert.ok(p.formattedMrp, 'formattedMrp must be defined');
    assert.ok(p.formattedSavings, 'formattedSavings must be defined');
  });

  it('accepts snake_case field names from API', () => {
    const p = getProductPricing({ mrp: 200, selling_price: 150 });
    assert.equal(p.hasSavings, true);
    assert.equal(p.discountPercent, 25);
  });

  it('accepts legacy originalPrice / price fields', () => {
    const p = getProductPricing({ originalPrice: 80, price: 60 });
    assert.equal(p.hasSavings, true);
    assert.equal(p.discountPercent, 25);
  });
});

// ─── Zero / no discount ─────────────────────────────────────────────────────

describe('getProductPricing — zero or no discount', () => {
  it('hides badge when selling == mrp', () => {
    const p = getProductPricing({ mrp: 100, sellingPrice: 100 });
    assert.equal(p.hasSavings, false);
  });

  it('hides badge when discount_percent is 0', () => {
    const p = getProductPricing({ mrp: 50, sellingPrice: 50, discount_percent: 0 });
    assert.equal(p.hasSavings, false);
  });

  it('still returns formattedSelling even with no savings', () => {
    const p = getProductPricing({ mrp: 50, sellingPrice: 50 });
    assert.ok(p.formattedSelling, 'should still format the selling price');
  });
});

// ─── Missing / invalid MRP ──────────────────────────────────────────────────

describe('getProductPricing — missing or invalid MRP', () => {
  it('hides when mrp is undefined', () => {
    const p = getProductPricing({ sellingPrice: 50 });
    assert.equal(p.hasSavings, false);
  });

  it('hides when mrp is null', () => {
    const p = getProductPricing({ mrp: null, sellingPrice: 50 });
    assert.equal(p.hasSavings, false);
  });

  it('hides when mrp is 0', () => {
    const p = getProductPricing({ mrp: 0, sellingPrice: 50 });
    assert.equal(p.hasSavings, false);
  });

  it('hides when mrp is NaN string', () => {
    const p = getProductPricing({ mrp: 'n/a', sellingPrice: 50 });
    assert.equal(p.hasSavings, false);
  });

  it('hides when selling price is undefined', () => {
    const p = getProductPricing({ mrp: 100 });
    assert.equal(p.hasSavings, false);
  });

  it('hides when selling price is negative', () => {
    const p = getProductPricing({ mrp: 100, sellingPrice: -10 });
    assert.equal(p.hasSavings, false);
  });
});

// ─── Selling above MRP ──────────────────────────────────────────────────────

describe('getProductPricing — selling price above MRP', () => {
  it('never shows negative discount', () => {
    const p = getProductPricing({ mrp: 40, sellingPrice: 50 });
    assert.equal(p.hasSavings, false);
  });

  it('never shows savings when selling >> mrp', () => {
    const p = getProductPricing({ mrp: 1, sellingPrice: 999 });
    assert.equal(p.hasSavings, false);
  });
});

// ─── Rounding (paise arithmetic) ────────────────────────────────────────────

describe('getProductPricing — rounding', () => {
  it('rounds percent correctly: 33/99 → 33%', () => {
    const p = getProductPricing({ mrp: 99, sellingPrice: 66 });
    assert.equal(p.hasSavings, true);
    assert.equal(p.discountPercent, 33);
  });

  it('rounds 1/3 discount to 33%', () => {
    const p = getProductPricing({ mrp: 3, sellingPrice: 2 });
    assert.equal(p.discountPercent, 33);
  });

  it('avoids floating-point drift: ₹99.99 - ₹66.66', () => {
    const p = getProductPricing({ mrp: 99.99, sellingPrice: 66.66 });
    assert.equal(p.hasSavings, true);
    // savings = 33.33 → paise = 3333, should not be 3332 or 3334
    assert.ok(p.savingsAmount > 33.3 && p.savingsAmount < 33.4, `savings: ${p.savingsAmount}`);
  });
});

// ─── Large numbers ──────────────────────────────────────────────────────────

describe('getProductPricing — large amounts', () => {
  it('handles 6-figure MRP without overflow', () => {
    const p = getProductPricing({ mrp: 999999, sellingPrice: 500000 });
    assert.equal(p.hasSavings, true);
    assert.ok(p.formattedSavings.includes('4,99,999') || p.formattedSavings.includes('499999'),
      `formattedSavings: ${p.formattedSavings}`);
  });

  it('formats using en-IN currency (₹ symbol or INR)', () => {
    const p = getProductPricing({ mrp: 1000, sellingPrice: 800 });
    assert.ok(p.formattedSelling.includes('800') || p.formattedSelling.includes('₹'));
  });
});

// ─── Server-provided discount_percent cross-check ───────────────────────────

describe('getProductPricing — server discount_percent', () => {
  it('uses server value when it matches calculated (within ±1%)', () => {
    // calculated = 30%, server says 30 → use 30
    const p = getProductPricing({ mrp: 100, sellingPrice: 70, discount_percent: 30 });
    assert.equal(p.discountPercent, 30);
  });

  it('uses calculated value when server value is way off', () => {
    // calculated ≈ 30%, server says 50 → ignore server, use 30
    const p = getProductPricing({ mrp: 100, sellingPrice: 70, discount_percent: 50 });
    assert.equal(p.discountPercent, 30);
  });

  it('uses server value when within 1% tolerance', () => {
    // calculated = 33%, server says 34 → within tolerance, use 34
    const p = getProductPricing({ mrp: 99, sellingPrice: 66, discount_percent: 34 });
    assert.equal(p.discountPercent, 34);
  });
});

// ─── Product object is null / undefined ─────────────────────────────────────

describe('getProductPricing — null / undefined product', () => {
  it('returns hasSavings:false for null', () => {
    const p = getProductPricing(null);
    assert.equal(p.hasSavings, false);
  });

  it('returns hasSavings:false for undefined', () => {
    const p = getProductPricing(undefined);
    assert.equal(p.hasSavings, false);
  });

  it('returns hasSavings:false for empty object', () => {
    const p = getProductPricing({});
    assert.equal(p.hasSavings, false);
  });
});

// ─── sumOrderSavings ────────────────────────────────────────────────────────

describe('sumOrderSavings', () => {
  it('sums line savings correctly (quantity-aware)', () => {
    const s = sumOrderSavings([
      { mrp: 100, unit_price: 80, quantity: 2 }, // save 20 × 2 = 40
      { mrp: 50,  unit_price: 50, quantity: 1 }, // no savings
    ]);
    assert.equal(s.hasSavings, true);
    assert.equal(s.totalSavings, 40);
  });

  it('returns hasSavings:false when nothing is discounted', () => {
    const s = sumOrderSavings([
      { mrp: 50, unit_price: 50, quantity: 3 },
    ]);
    assert.equal(s.hasSavings, false);
    assert.equal(s.totalSavings, 0);
  });

  it('handles empty array', () => {
    const s = sumOrderSavings([]);
    assert.equal(s.hasSavings, false);
    assert.equal(s.totalSavings, 0);
  });

  it('handles null / undefined gracefully', () => {
    const s = sumOrderSavings(null);
    assert.equal(s.hasSavings, false);
  });

  it('sums multiple discounted lines', () => {
    const s = sumOrderSavings([
      { mrp: 100, unit_price: 70, quantity: 1 }, // save 30
      { mrp: 200, unit_price: 150, quantity: 2 }, // save 50 × 2 = 100
    ]);
    assert.equal(s.totalSavings, 130);
  });

  it('formattedTotalSavings is a non-empty string', () => {
    const s = sumOrderSavings([{ mrp: 100, unit_price: 80, quantity: 1 }]);
    assert.ok(typeof s.formattedTotalSavings === 'string' && s.formattedTotalSavings.length > 0);
  });
});
