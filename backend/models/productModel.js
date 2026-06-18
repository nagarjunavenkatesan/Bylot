const { pool } = require("../config/db");

const productSelect = `
  p.id, p.product_item_id, p.seller_id, p.category_id, p.name, p.slug, p.description, p.sku, p.brand,
  p.mrp, p.selling_price, p.discount_percent, p.stock_quantity, p.low_stock_threshold,
  p.expiry_date, p.manufacture_date, p.batch_number, p.product_type, p.image_url,
  p.status, p.created_at, p.updated_at,
  c.name AS category_name,
  s.business_name AS seller_name,
  s.latitude AS seller_latitude,
  s.longitude AS seller_longitude
`;

function baseProductQuery(where = "p.status = 'active'") {
  return `
    SELECT ${productSelect}
    FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN sellers s ON s.id = p.seller_id
    WHERE ${where}
  `;
}

async function findProductById(id) {
  const [rows] = await pool.execute(`${baseProductQuery("p.id = ?")} LIMIT 1`, [id]);
  return rows[0] || null;
}

module.exports = {
  productSelect,
  baseProductQuery,
  findProductById
};
