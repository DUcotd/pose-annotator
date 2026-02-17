export const getImageName = (img) => typeof img === 'string' ? img : img?.name;

export const validateSequentialNumbering = (imageList) => {
  const names = (imageList || []).map(getImageName).filter(Boolean);
  if (names.length === 0) return { checked: true, ok: true };
  if (!names.every(n => /^\d{6}\./.test(n))) return { checked: false, ok: true };

  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  for (let i = 0; i < sorted.length; i++) {
    const expected = String(i + 1).padStart(6, '0');
    const got = sorted[i].slice(0, 6);
    if (got !== expected) {
      return { checked: true, ok: false, index: i, expected, got, name: sorted[i] };
    }
  }
  return { checked: true, ok: true };
};

