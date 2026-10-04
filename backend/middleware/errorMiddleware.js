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

function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message;

  // Handle CORS rejection
  if (err.message && err.message.includes("Origin not allowed by CORS")) {
    statusCode = 403;
    message = err.message;
  }

  // Handle Multer errors (file size limit, unexpected file)
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      message = "File size exceeds the allowed limit";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      statusCode = 400;
      message = `Unexpected upload field: ${err.field || "file"}`;
    } else {
      statusCode = 400;
      message = err.message;
    }
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && "body" in err && statusCode === 400) {
    statusCode = 400;
    message = "Malformed JSON payload in request body";
  }

  const friendly = getFriendlyMessage(err);
  const finalMessage = friendly || (statusCode === 500 ? "Something went wrong. Please try again." : message);

  if (env.nodeEnv !== "test") {
    console.error(`[ERROR] ${statusCode} -`, err.message || err);
  }

  return error(res, finalMessage, statusCode, err.errors);
}

module.exports = {
  notFound,
  errorHandler
};
