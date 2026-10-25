const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const reportArchiveService = require("../services/reportArchiveService");
const auditLogger = require("../security/auditLogger");

/**
 * List generated reports and archives.
 * GET /api/admin/archives or GET /api/admin/report-archives
 */
const listReports = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await reportArchiveService.listReportArchives({ page, limit });
  return success(res, "Admin reports retrieved successfully", result);
});

/**
 * Trigger background report generation.
 * POST /api/admin/archives/generate or POST /api/admin/reports/generate
 */
const generateReport = asyncHandler(async (req, res) => {
  const { days, startDate, endDate } = req.body;

  // Validate days if provided
  if (days !== undefined && days !== null) {
    const parsedDays = Number(days);
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      throw new AppError("Report period must be between 1 and 365 days", 400);
    }
  }

  // Validate dates if custom date range provided
  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      throw new AppError("Invalid date format for startDate or endDate (must be YYYY-MM-DD)", 400);
    }
    if (s > e) {
      throw new AppError("startDate cannot be after endDate", 400);
    }
  }

  const job = await reportArchiveService.initiateReportGeneration({
    days,
    startDate,
    endDate,
    adminUserId: req.user.id
  });

  return res.status(202).json({
    success: true,
    message: "Report generation job initiated in background",
    data: job
  });
});

/**
 * Check status of a specific report.
 * GET /api/admin/archives/:id/status or GET /api/admin/reports/:reportId/status
 */
const getReportStatus = asyncHandler(async (req, res) => {
  const { id, reportId } = req.params;
  const targetId = id || reportId;

  const report = await reportArchiveService.findReportArchive(targetId);
  if (!report) {
    throw new AppError("Report not found", 404);
  }

  return success(res, "Report status retrieved", {
    id: report.id,
    reportId: report.report_id,
    status: report.status,
    periodStart: reportArchiveService.formatDate(report.period_start),
    periodEnd: reportArchiveService.formatDate(report.period_end),
    periodDays: report.period_days,
    fileSize: Number(report.file_size),
    checksum: report.checksum_sha256 || report.plaintext_sha256,
    encryptionAlgorithm: report.encryption_algorithm,
    errorMessage: report.error_message,
    createdAt: report.created_at,
    expiresAt: report.expires_at
  });
});

/**
 * Download and stream decrypted report archive.
 * GET /api/admin/reports/:reportId/download or GET /api/admin/archives/:id/download
 */
const downloadReport = asyncHandler(async (req, res) => {
  const { id, reportId } = req.params;
  const targetId = id || reportId;

  // Path traversal protection: ensure identifier contains only safe characters
  if (typeof targetId === "string" && (targetId.includes("..") || targetId.includes("/") || targetId.includes("\\") || targetId.includes("\0"))) {
    throw new AppError("Invalid report identifier format", 400);
  }

  const report = await reportArchiveService.findReportArchive(targetId);
  if (!report) {
    throw new AppError("Report not found", 404);
  }

  if (report.status === "DELETED") {
    throw new AppError("This report archive was deleted and cannot be downloaded.", 410);
  }

  if (report.status !== "READY") {
    throw new AppError(`Report is not ready for download (current status: ${report.status})`, 400);
  }

  await reportArchiveService.streamDecryptedArchive(report, res, req.user.id);
});

/**
 * Delete an archived report.
 * DELETE /api/admin/reports/:reportId or DELETE /api/admin/archives/:id
 * Only deletes the archived report file and metadata. Live application data is untouched!
 */
const deleteReport = asyncHandler(async (req, res) => {
  const { id, reportId } = req.params;
  const targetId = id || reportId;

  if (typeof targetId === "string" && (targetId.includes("..") || targetId.includes("/") || targetId.includes("\\") || targetId.includes("\0"))) {
    throw new AppError("Invalid report identifier format", 400);
  }

  const result = await reportArchiveService.deleteReportArchive(targetId, req.user.id);
  return success(res, result.message, result);
});

/**
 * Manually trigger retention cleanup for expired reports.
 * POST /api/admin/archives/cleanup
 */
const cleanupExpired = asyncHandler(async (req, res) => {
  const result = await reportArchiveService.cleanExpiredArchives();
  return success(res, `Cleaned ${result.cleanedCount} expired archives`, result);
});

module.exports = {
  listReports,
  generateReport,
  getReportStatus,
  downloadReport,
  deleteReport,
  cleanupExpired
};
