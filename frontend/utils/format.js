export const toDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const numericDate = new Date(value);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const hasYear = /\b\d{4}\b/.test(raw);
  const normalized = hasYear ? raw : `${raw}, ${new Date().getFullYear()}`;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (value, options = {}) => {
  const date = toDate(value);
  if (!date) return value || 'N/A';

  const fallbackOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };

  return date.toLocaleDateString('en-US', Object.keys(options).length > 0 ? options : fallbackOptions);
};

export const sortByNewest = (items, getValue = (item) => item?.created_at) => {
  return [...(items || [])].sort((a, b) => {
    const dateA = toDate(getValue(a))?.getTime() || 0;
    const dateB = toDate(getValue(b))?.getTime() || 0;
    return dateB - dateA;
  });
};
