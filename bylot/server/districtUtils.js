export const TAMIL_NADU_DISTRICTS = [
    'Chennai',
    'Coimbatore',
    'Madurai',
    'Tiruchirappalli',
    'Salem',
    'Tirunelveli',
    'Thanjavur',
    'Vellore',
    'Erode',
    'Dindigul',
    'Thoothukudi',
    'Karur',
    'Kanchipuram',
    'Cuddalore',
    'Theni',
    'Namakkal',
    'Sivaganga',
    'Virudhunagar',
    'Ramanathapuram',
    'Other',
];

export function extractDistrict(location = '', district = '') {
    const normalizedDistrict = String(district || '').trim();
    if (normalizedDistrict) return normalizedDistrict;

    const value = String(location || '').trim();
    if (!value) return 'Unassigned';

    const lower = value.toLowerCase();
    const matched = TAMIL_NADU_DISTRICTS.find((name) => {
        if (name === 'Other') return false;
        return lower.includes(name.toLowerCase());
    });
    if (matched) return matched;

    if (value.includes(',')) {
        const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
        if (parts.length) return parts[parts.length - 1];
    }

    if (value.startsWith('http')) return 'Unassigned';
    return value.split(' ')[0] || 'Unassigned';
}
