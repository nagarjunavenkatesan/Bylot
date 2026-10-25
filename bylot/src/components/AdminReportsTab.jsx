import React, { useState, useEffect, useCallback } from 'react';
import {
  FaArchive,
  FaDownload,
  FaTrash,
  FaShieldAlt,
  FaLock,
  FaSyncAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaCalendarAlt,
  FaFileAlt
} from 'react-icons/fa';
import { API_BASE_URL, getAccessToken } from '../api/backendApi';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export default function AdminReportsTab({ adminRequest }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [customDays, setCustomDays] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, report: null });

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminRequest('/api/admin/archives?limit=50');
      setReports(res.data?.reports || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch archived reports.');
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Auto-poll if any report is PENDING or GENERATING
  useEffect(() => {
    const hasActiveJob = reports.some(r => r.status === 'PENDING' || r.status === 'GENERATING');
    if (!hasActiveJob) return;

    const interval = setInterval(() => {
      adminRequest('/api/admin/archives?limit=50')
        .then(res => {
          setReports(res.data?.reports || []);
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [reports, adminRequest]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const days = customDays ? Number(customDays) : Number(selectedPeriod);
      const res = await adminRequest('/api/admin/archives/generate', {
        method: 'POST',
        body: JSON.stringify({ days })
      });
      setMessage(res.message || `Generating report for the last ${days} days...`);
      await loadReports();
    } catch (err) {
      setError(err.message || 'Failed to initiate report generation.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (report) => {
    if (report.status !== 'READY') return;
    setDownloadingId(report.reportId);
    setError('');
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/reports/${report.reportId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || `Download failed (${res.status})`);
      }

      // Stream blob to browser download
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${report.reportId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message || 'Failed to download report archive.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.report) return;
    const target = deleteModal.report;
    setDeletingId(target.reportId);
    setError('');
    setMessage('');
    try {
      const res = await adminRequest(`/api/admin/reports/${target.reportId}`, {
        method: 'DELETE'
      });
      setMessage(res.message || 'Report deleted successfully. Live Bylot data was NOT modified.');
      setDeleteModal({ open: false, report: null });
      await loadReports();
    } catch (err) {
      setError(err.message || 'Failed to delete report.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-reports-tab">
      <div className="admin-reports-header">
        <div>
          <h3>BYLOT REPORTS & EVIDENCE ARCHIVES</h3>
          <p className="admin-reports-subtitle">
            Immutable, AES-256-GCM encrypted evidence snapshots containing buyers, sellers, products,
            orders, complaints, and audit records. Live marketplace data is never altered.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadReports}
          disabled={loading}
          title="Refresh reports"
        >
          <FaSyncAlt className={loading ? 'spin-icon' : ''} /> Refresh
        </button>
      </div>

      {/* Generation Bar */}
      <div className="admin-reports-generate-bar">
        <div className="generate-controls">
          <label htmlFor="report-period-select" className="generate-label">
            <FaCalendarAlt /> Report Period:
          </label>
          <select
            id="report-period-select"
            className="form-input form-input-sm"
            value={customDays ? 'custom' : selectedPeriod}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCustomDays('30');
              } else {
                setCustomDays('');
                setSelectedPeriod(Number(e.target.value));
              }
            }}
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days (Default)</option>
            <option value={60}>Last 60 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={180}>Last 180 Days</option>
            <option value={365}>Last 365 Days</option>
            <option value="custom">Custom Days…</option>
          </select>

          {customDays !== '' && (
            <input
              type="number"
              className="form-input form-input-sm custom-days-input"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="Days (1-365)"
              min={1}
              max={365}
            />
          )}

          <button
            type="button"
            className="btn btn-glow btn-sm generate-btn"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <FaSpinner className="spin-icon" /> Generating…
              </>
            ) : (
              <>
                <FaArchive /> Generate Report
              </>
            )}
          </button>
        </div>

        <div className="encryption-pill">
          <FaLock className="lock-icon" />
          <span>AES-256-GCM Envelope Encryption Active</span>
        </div>
      </div>

      {(message || error) && (
        <div className={`admin-alert ${error ? 'error' : 'success'}`}>
          {error ? <FaExclamationTriangle /> : <FaCheckCircle />}
          <span>{error || message}</span>
        </div>
      )}

      {/* Reports Table */}
      <div className="admin-table-wrap">
        <table className="admin-table admin-reports-table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Period</th>
              <th>Created Date</th>
              <th>Status</th>
              <th>File Size</th>
              <th>Encryption</th>
              <th>Checksum (SHA-256)</th>
              <th>Created By</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={9} className="admin-empty">
                  {loading ? 'Loading report archives…' : 'No report archives generated yet. Click "Generate Report" above.'}
                </td>
              </tr>
            ) : (
              reports.map((report) => {
                const isReady = report.status === 'READY';
                const isPending = report.status === 'PENDING' || report.status === 'GENERATING';
                const isDeleted = report.status === 'DELETED';
                const isFailed = report.status === 'FAILED';

                return (
                  <tr key={report.id || report.reportId} className={isDeleted ? 'row-muted' : ''}>
                    <td className="report-id-cell">
                      <FaFileAlt className="report-icon" />
                      <span className="mono-text" title={report.reportId}>
                        {report.reportId}
                      </span>
                    </td>
                    <td>
                      <span className="date-range">
                        {report.periodStart} → {report.periodEnd}
                      </span>
                      <small className="days-label">({report.periodDays}d)</small>
                    </td>
                    <td>{formatDateDisplay(report.createdAt)}</td>
                    <td>
                      <span className={`status-badge status-${report.status.toLowerCase()}`}>
                        {isPending && <FaSpinner className="spin-icon inline-spin" />}
                        {isReady && <FaCheckCircle />}
                        {isFailed && <FaExclamationTriangle />}
                        {report.status}
                      </span>
                    </td>
                    <td>{report.fileSize > 0 ? formatBytes(report.fileSize) : '-'}</td>
                    <td>
                      {isReady ? (
                        <span className="enc-tag">
                          <FaLock /> AES-256-GCM
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="checksum-cell">
                      {report.checksum ? (
                        <span className="mono-text checksum-preview" title={report.checksum}>
                          {report.checksum.slice(0, 10)}…{report.checksum.slice(-8)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{report.createdBy}</td>
                    <td className="text-right actions-cell">
                      {isReady && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs action-btn"
                          onClick={() => handleDownload(report)}
                          disabled={downloadingId === report.reportId}
                          title="Download encrypted report"
                        >
                          {downloadingId === report.reportId ? (
                            <FaSpinner className="spin-icon" />
                          ) : (
                            <FaDownload />
                          )}
                          <span>Download</span>
                        </button>
                      )}

                      {!isDeleted && (
                        <button
                          type="button"
                          className="btn btn-danger btn-xs action-btn"
                          onClick={() => setDeleteModal({ open: true, report })}
                          disabled={deletingId === report.reportId}
                          title="Delete report archive"
                        >
                          <FaTrash />
                          <span>Delete</span>
                        </button>
                      )}

                      {isDeleted && <span className="deleted-label">Archived & Cleared</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal (Prompt Section 24) */}
      {deleteModal.open && (
        <div
          className="admin-modal-overlay"
          onClick={() => !deletingId && setDeleteModal({ open: false, report: null })}
          role="presentation"
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-report-modal-title"
          >
            <div className="admin-modal-header">
              <div className="admin-modal-icon danger">
                <FaExclamationTriangle />
              </div>
              <h3 id="delete-report-modal-title">Delete this archived report?</h3>
            </div>
            <div className="admin-modal-body">
              <p>
                Report: <strong>{deleteModal.report?.reportId}</strong>
                <br /><br />
                This deletes only the archived encrypted report file and its metadata.
                <br />
                <strong>Live Bylot data will NOT be deleted.</strong>
              </p>
              <div className="admin-modal-warning">
                ⚠ The encrypted archive file will be permanently unlinked from storage.
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteModal({ open: false, report: null })}
                disabled={deletingId !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deletingId !== null}
              >
                {deletingId ? (
                  <>
                    <FaSpinner className="spin-icon" /> Deleting…
                  </>
                ) : (
                  'Delete Report'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
