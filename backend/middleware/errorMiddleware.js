const { error } = require("../utils/apiResponse");
const env = require("../config/env");

const friendlyMessages = {
  "Incorrect arguments to mysqld_stmt_execute": "Something went wrong while loading data. Please try again.",
  "product_reports": "A system table was missing and has been fixed. Please refresh and try again.",
  "Duplicate entry": "This record already exists. Please use a different value.",
  "Cannot add or update a child row": "The referenced item does not exist. Please check your selection.",
  "Deadlock found": "The system is busy. Please try again.",
  "Timeout": "The request took too long. Please try again.",
  "ECONNREFUSED": "Unable to connect to the database. Please check your connection.",
  "ENOTFOUND": "Unable to reach the database server."
};

function getFriendlyMessage(err) {
  const msg = err.message || "";
  for (const [key, friendly] of Object.entries(friendlyMessages)) {
    if (msg.includes(key)) return friendly;
  }
  return null;
}

function notFound(req, res, next) {
  const err = new Error("The requested page or resource was not found.");
  err.statusCode = 404;
  next(err);
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const friendly = getFriendlyMessage(err);
  const message = friendly || (statusCode === 500 ? "Something went wrong. Please try again." : err.message);

  if (env.nodeEnv !== "test") {
    console.error(`[ERROR] ${statusCode} -`, err.message || err);
  }

  return error(res, message, statusCode, err.errors);
}

module.exports = {
  notFound,
  errorHandler
};
