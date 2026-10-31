import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteProduct } from './sellerDelete.js';

test('canDeleteProduct — unauthenticated user cannot delete', () => {
  const product = { id: 101, seller_id: 12, seller_user_id: 42, name: 'Sample Item' };
  assert.equal(canDeleteProduct(null, product), false);
  assert.equal(canDeleteProduct(undefined, product), false);
});

test('canDeleteProduct — buyer cannot delete', () => {
  const buyer = { id: 99, role: 'buyer', name: 'Buyer User' };
  const product = { id: 101, seller_id: 12, seller_user_id: 42, name: 'Sample Item' };
  assert.equal(canDeleteProduct(buyer, product), false);
});

test('canDeleteProduct — other seller cannot delete (IDOR protection)', () => {
  const sellerB = { id: 88, seller_id: 99, role: 'seller', name: 'Seller B' };
  const productA = { id: 101, seller_id: 12, seller_user_id: 42, name: 'Product of Seller A' };
  assert.equal(canDeleteProduct(sellerB, productA), false);
});

test('canDeleteProduct — owning seller by seller_user_id can delete', () => {
  const sellerA = { id: 42, seller_id: 12, role: 'seller', name: 'Seller A' };
  const productA = { id: 101, seller_id: 12, seller_user_id: 42, name: 'Product of Seller A' };
  assert.equal(canDeleteProduct(sellerA, productA), true);
});

test('canDeleteProduct — owning seller by seller_id can delete', () => {
  const sellerA = { id: 42, seller_id: 12, role: 'seller', name: 'Seller A' };
  const productA = { id: 101, seller_id: 12, name: 'Product of Seller A' };
  assert.equal(canDeleteProduct(sellerA, productA), true);
});

test('canDeleteProduct — owning seller with isOwner prop can delete', () => {
  const sellerA = { id: 42, role: 'seller', name: 'Seller A' };
  const productA = { id: 101, name: 'Product of Seller A' };
  assert.equal(canDeleteProduct(sellerA, productA, true), true);
});

test('canDeleteProduct — admin can delete when isAdmin is true', () => {
  const admin = { id: 1, role: 'admin', name: 'Admin User' };
  const product = { id: 101, seller_id: 12, seller_user_id: 42, name: 'Product' };
  assert.equal(canDeleteProduct(admin, product, false, true), true);
  // Without isAdmin flag, admin not acting as admin doesn't see admin delete on generic card
  assert.equal(canDeleteProduct(admin, product, false, false), false);
});
