import { getImageName } from './imageNumbering.js';

const parseOptionalInt = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
};

export const filterImages = (images, { search = '', keypointsMin = null, keypointsMax = null } = {}) => {
  const q = String(search || '').trim().toLowerCase();
  const kpMin = parseOptionalInt(keypointsMin);
  const kpMax = parseOptionalInt(keypointsMax);

  return (images || []).filter(img => {
    const name = getImageName(img);
    if (q) {
      if (!name || !name.toLowerCase().includes(q)) return false;
    }

    if (kpMin === null && kpMax === null) return true;

    const kp = (typeof img === 'string')
      ? null
      : (Number.isFinite(img?.keypointCount) ? img.keypointCount : null);
    if (kp === null) return true;
    if (kpMin !== null && kp < kpMin) return false;
    if (kpMax !== null && kp > kpMax) return false;
    return true;
  });
};

export const filterImagesAdvanced = (
  images,
  {
    search = '',
    annotated = 'all',
    keypointsMin = null,
    keypointsMax = null,
    bboxesMin = null,
    bboxesMax = null
  } = {}
) => {
  const q = String(search || '').trim().toLowerCase();
  const kpMin = parseOptionalInt(keypointsMin);
  const kpMax = parseOptionalInt(keypointsMax);
  const bbMin = parseOptionalInt(bboxesMin);
  const bbMax = parseOptionalInt(bboxesMax);

  return (images || []).filter(img => {
    const name = getImageName(img);
    if (q) {
      if (!name || !name.toLowerCase().includes(q)) return false;
    }

    if (annotated !== 'all') {
      const hasAnn = typeof img === 'string' ? false : !!img?.hasAnnotation;
      if (annotated === 'annotated' && !hasAnn) return false;
      if (annotated === 'unannotated' && hasAnn) return false;
    }

    if (kpMin !== null || kpMax !== null) {
      const kp = typeof img === 'string' ? null : (Number.isFinite(img?.keypointCount) ? img.keypointCount : null);
      if (kp !== null) {
        if (kpMin !== null && kp < kpMin) return false;
        if (kpMax !== null && kp > kpMax) return false;
      }
    }

    if (bbMin !== null || bbMax !== null) {
      const bb = typeof img === 'string' ? null : (Number.isFinite(img?.bboxCount) ? img.bboxCount : null);
      if (bb !== null) {
        if (bbMin !== null && bb < bbMin) return false;
        if (bbMax !== null && bb > bbMax) return false;
      }
    }

    return true;
  });
};
