const { validationResult } = require("express-validator");
const AppError = require("../utils/AppError");

function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  return next(new AppError("Validation failed", 422, result.array().map((err) => ({
    field: err.path,
    message: err.msg
  }))));
}

module.exports = validate;
