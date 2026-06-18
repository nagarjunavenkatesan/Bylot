function getPagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

module.exports = {
  getPagination,
  buildMeta
};
