import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCardExpiry } from './expiry.js';

test('formatCardExpiry — date-only expiry string', () => {
    const res = formatCardExpiry({ expiry_date: '2026-10-12' });
    assert.ok(res);
    assert.match(res.formattedDate, /12\s+Oct\s+2026/i);
    // Should NOT have 12:00 AM or 00:00 time attached for date-only
    assert.ok(!res.formattedDate.includes(':'));
});

test('formatCardExpiry — datetime with explicit time', () => {
    const res = formatCardExpiry({ expiry_date: '2026-10-12T18:30:00' });
    assert.ok(res);
    assert.match(res.formattedDate, /12\s+Oct\s+2026/i);
    assert.match(res.formattedDate, /6:30\s+PM/i);
});

test('formatCardExpiry — space separated datetime with time', () => {
    const res = formatCardExpiry({ expiry_date: '2026-10-12 18:30:00' });
    assert.ok(res);
    assert.match(res.formattedDate, /12\s+Oct\s+2026/i);
    assert.match(res.formattedDate, /6:30\s+PM/i);
});

test('formatCardExpiry — expired in the past produces relative days', () => {
    // 10 days before today
    const past = new Date();
    past.setDate(past.getDate() - 10);
    const pastStr = past.toISOString().slice(0, 10);

    const res = formatCardExpiry({ expiry_date: pastStr });
    assert.ok(res);
    assert.equal(res.isExpired, true);
    assert.equal(res.relativeLabel, 'Expired 10 days ago');
});

test('formatCardExpiry — expired yesterday', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const pastStr = past.toISOString().slice(0, 10);

    const res = formatCardExpiry({ expiry_date: pastStr });
    assert.ok(res);
    assert.equal(res.isExpired, true);
    assert.equal(res.relativeLabel, 'Expired yesterday');
});

test('formatCardExpiry — expired today when flagged expired', () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const res = formatCardExpiry({ expiry_date: todayStr, isExpired: true });
    assert.ok(res);
    assert.equal(res.isExpired, true);
    assert.equal(res.relativeLabel, 'Expired today');
});

test('formatCardExpiry — expiring in future produces Expires in N days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = future.toISOString().slice(0, 10);

    const res = formatCardExpiry({ expiry_date: futureStr });
    assert.ok(res);
    assert.equal(res.isExpired, false);
    assert.equal(res.relativeLabel, 'Expires in 5 days');
});

test('formatCardExpiry — handles null, undefined, empty object gracefully', () => {
    assert.equal(formatCardExpiry(null), null);
    assert.equal(formatCardExpiry(undefined), null);
    assert.equal(formatCardExpiry({}), null);
    assert.equal(formatCardExpiry({ expiry_date: '' }), null);
});

test('formatCardExpiry — accepts legacy expiry or expiryDate field', () => {
    const res = formatCardExpiry({ expiry: '2026-10-12' });
    assert.ok(res);
    assert.match(res.formattedDate, /12\s+Oct\s+2026/i);

    const res2 = formatCardExpiry({ expiryDate: '2026-10-12' });
    assert.ok(res2);
    assert.match(res2.formattedDate, /12\s+Oct\s+2026/i);
});
