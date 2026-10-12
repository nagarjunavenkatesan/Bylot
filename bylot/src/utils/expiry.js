/**
 * Expiry formatting utility for Bylot product cards and listings.
 * 
 * Provides robust, timezone-safe date and relative expiry calculations
 * aligned with Bylot's en-IN locale conventions.
 */

/**
 * Parses and formats product expiry information for card presentation.
 * 
 * @param {Object|string|Date} productOrDate - Product object or expiry date string/Date
 * @returns {Object|null} Expiry presentation metadata or null if no date available
 */
export function formatCardExpiry(productOrDate) {
    if (!productOrDate) return null;

    let raw = null;
    let isExpiredExplicit = false;
    let fallbackDaysRemaining = null;

    if (typeof productOrDate === 'object' && !(productOrDate instanceof Date)) {
        raw = productOrDate.expiry_date
            || productOrDate.expiryDate
            || productOrDate.expiry
            || null;
        isExpiredExplicit = Boolean(
            productOrDate.isExpired ||
            productOrDate.expiryStatus === 'Expired' ||
            productOrDate.status === 'expired'
        );
        if (typeof productOrDate.daysRemaining === 'number') {
            fallbackDaysRemaining = productOrDate.daysRemaining;
        } else if (typeof productOrDate.daysExpired === 'number') {
            fallbackDaysRemaining = -Math.abs(productOrDate.daysExpired);
        }
    } else {
        raw = productOrDate;
    }

    if (!raw) return null;

    let formattedDate = '';
    let relativeLabel = null;
    let isExpired = isExpiredExplicit;

    try {
        let dateObj = null;
        let hasExplicitTime = false;

        if (typeof raw === 'string') {
            const trimmed = raw.trim();

            // Detect whether an explicit non-midnight time component exists
            // Matches formats like "T18:30", " 18:30:00", "06:30 PM", etc.
            const timeMatch = trimmed.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1], 10);
                const minutes = parseInt(timeMatch[2], 10);
                if (hours !== 0 || minutes !== 0) {
                    hasExplicitTime = true;
                }
            }

            // Timezone-safe parse for standard YYYY-MM-DD date-only strings
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const [y, m, d] = trimmed.split('-').map(Number);
                dateObj = new Date(y, m - 1, d);
            } else {
                dateObj = new Date(trimmed);
            }
        } else if (raw instanceof Date) {
            dateObj = raw;
            if (dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0) {
                hasExplicitTime = true;
            }
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
            // Format calendar date in en-IN style (e.g. "12 Oct 2026")
            const datePart = dateObj.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            if (hasExplicitTime) {
                const timePart = dateObj.toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
                formattedDate = `${datePart}, ${timePart}`;
            } else {
                formattedDate = datePart;
            }

            // Calculate calendar day difference relative to today
            const now = new Date();
            const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const targetMidnight = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
            const diffTime = todayMidnight - targetMidnight;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                isExpired = true;
                if (diffDays === 1) {
                    relativeLabel = 'Expired yesterday';
                } else {
                    relativeLabel = `Expired ${diffDays} days ago`;
                }
            } else if (diffDays === 0) {
                if (isExpired) {
                    relativeLabel = 'Expired today';
                } else {
                    relativeLabel = 'Expires today';
                }
            } else {
                const daysRemaining = Math.abs(diffDays);
                if (daysRemaining === 1) {
                    relativeLabel = 'Expires tomorrow';
                } else {
                    relativeLabel = `Expires in ${daysRemaining} days`;
                }
            }
        } else {
            // Fallback for non-standard string formats (e.g. pre-formatted label)
            formattedDate = String(raw);
            if (fallbackDaysRemaining !== null) {
                if (fallbackDaysRemaining < 0) {
                    const days = Math.abs(fallbackDaysRemaining);
                    isExpired = true;
                    relativeLabel = days === 1 ? 'Expired yesterday' : `Expired ${days} days ago`;
                } else if (fallbackDaysRemaining === 0) {
                    relativeLabel = isExpired ? 'Expired today' : 'Expires today';
                } else {
                    relativeLabel = fallbackDaysRemaining === 1 ? 'Expires tomorrow' : `Expires in ${fallbackDaysRemaining} days`;
                }
            } else if (isExpired) {
                relativeLabel = 'Expired';
            }
        }
    } catch {
        formattedDate = String(raw);
    }

    return {
        formattedDate,
        relativeLabel,
        isExpired
    };
}
