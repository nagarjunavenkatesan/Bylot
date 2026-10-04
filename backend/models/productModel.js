const { pool } = require("../config/db");

// Columns needed for listing views (description excluded for performance)
const productListSelect = `
  p.id, p.product_item_id, p.seller_id, p.category_id, p.name, p.slug, p.sku, p.brand,
  p.mrp, p.selling_price, p.discount_percent, p.stock_quantity, p.low_stock_threshold,
  p.expiry_date, p.manufacture_date, p.batch_number, p.product_type, p.image_url,
  p.status, p.created_at, p.updated_at,
  c.name AS category_name,
  s.business_name AS seller_name,
  s.latitude AS seller_latitude,
  s.longitude AS seller_longitude
`;

// Full columns including description for detail view
const productDetailSelect = `
  p.id, p.product_item_id, p.seller_id, p.category_id, p.name, p.slug, p.description, p.sku, p.brand,
  p.mrp, p.selling_price, p.discount_percent, p.stock_quantity, p.low_stock_threshold,
  p.expiry_date, p.manufacture_date, p.batch_number, p.product_type, p.image_url,
  p.status, p.created_at, p.updated_at,
  c.name AS category_name,
  s.business_name AS seller_name,
  s.latitude AS seller_latitude,
  s.longitude AS seller_longitude
`;

// Shared standard joins for public product queries
const PUBLIC_PRODUCT_JOINS = `
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN sellers s ON s.id = p.seller_id
  JOIN users u ON u.id = s.user_id
`;

// Shared standard filter: product active, seller approved, seller active, and seller user active
const PUBLIC_PRODUCT_CONDITION = `
  p.status = 'active'
  AND s.approval_status = 'approved'
  AND s.status = 'active'
  AND u.status = 'active'
`;

function baseProductQuery(where = "1=1", isDetail = false) {
  const selectClause = isDetail ? productDetailSelect : productListSelect;
  return `
    SELECT ${selectClause}
    ${PUBLIC_PRODUCT_JOINS}
    WHERE ${PUBLIC_PRODUCT_CONDITION} AND (${where})
  `;
}

function baseProductCountQuery(where = "1=1") {
  return `
    SELECT COUNT(*) AS total
    ${PUBLIC_PRODUCT_JOINS}
    WHERE ${PUBLIC_PRODUCT_CONDITION} AND (${where})
  `;
}

async function findProductById(id, includeInactive = false) {
  if (includeInactive) {
    // For admin or seller owner
    const [rows] = await pool.query(
      `SELECT ${productDetailSelect}
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       JOIN users u ON u.id = s.user_id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  // Public detail: enforces active product, approved seller, active seller, active user
  const [rows] = await pool.query(
    `${baseProductQuery("p.id = ?", true)} LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  productListSelect,
  productDetailSelect,
  productSelect: productDetailSelect, // backward compatibility
  PUBLIC_PRODUCT_JOINS,
  PUBLIC_PRODUCT_CONDITION,
  baseProductQuery,
  baseProductCountQuery,
  findProductById
};
