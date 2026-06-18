function success(res, message, data = null, statusCode = 200, meta = undefined) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function error(res, message, statusCode = 500, errors = undefined) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = {
  success,
  error
};
