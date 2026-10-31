/**
 * Helper to determine if the currently logged-in user can delete a product.
 * Strict authorization rules:
 * - Unauthenticated users (user === null) -> FALSE
 * - Buyers (role !== 'seller' && role !== 'admin') -> FALSE
 * - Other sellers who do NOT own the product -> FALSE
 * - Owning seller -> TRUE
 * - Admin -> TRUE (when isAdmin flag is active)
 */
export function canDeleteProduct(user, product, isOwner = false, isAdmin = false) {
  if (!user || !product) return false;

  const isSellerOwner = Boolean(
    (user.role === 'seller' || user.role === 'admin') &&
    (
      isOwner ||
      (product.seller_user_id != null && Number(user.id) === Number(product.seller_user_id)) ||
      (product.seller_id != null && user.seller_id != null && Number(user.seller_id) === Number(product.seller_id))
    )
  );

  const isAuthorizedAdmin = Boolean(isAdmin && user.role === 'admin');

  return isSellerOwner || isAuthorizedAdmin;
}
