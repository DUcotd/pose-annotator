import test from 'node:test';
import assert from 'node:assert/strict';
import { filterImages, filterImagesAdvanced } from './galleryFilters.js';

test('filterImages: search filters by name', () => {
  const imgs = [{ name: '000001.jpg', keypointCount: 3 }, { name: 'abc.png', keypointCount: 7 }];
  const r = filterImages(imgs, { search: 'abc' });
  assert.deepEqual(r, [{ name: 'abc.png', keypointCount: 7 }]);
});

test('filterImages: keypoint min/max filters by keypointCount', () => {
  const imgs = [
    { name: 'a.jpg', keypointCount: 0 },
    { name: 'b.jpg', keypointCount: 5 },
    { name: 'c.jpg', keypointCount: 10 }
  ];
  assert.deepEqual(filterImages(imgs, { keypointsMin: 5 }), [imgs[1], imgs[2]]);
  assert.deepEqual(filterImages(imgs, { keypointsMax: 5 }), [imgs[0], imgs[1]]);
  assert.deepEqual(filterImages(imgs, { keypointsMin: 5, keypointsMax: 10 }), [imgs[1], imgs[2]]);
  assert.deepEqual(filterImages(imgs, { keypointsMin: 6, keypointsMax: 9 }), []);
});

test('filterImages: missing keypointCount does not blank out list', () => {
  const imgs = [{ name: 'a.jpg' }, { name: 'b.jpg', keypointCount: 2 }];
  assert.deepEqual(filterImages(imgs, { keypointsMin: 1 }), imgs);
});

test('filterImagesAdvanced: annotated filter works', () => {
  const imgs = [
    { name: 'a.jpg', hasAnnotation: false, keypointCount: 0, bboxCount: 0 },
    { name: 'b.jpg', hasAnnotation: true, keypointCount: 3, bboxCount: 1 }
  ];
  assert.deepEqual(filterImagesAdvanced(imgs, { annotated: 'annotated' }), [imgs[1]]);
  assert.deepEqual(filterImagesAdvanced(imgs, { annotated: 'unannotated' }), [imgs[0]]);
  assert.deepEqual(filterImagesAdvanced(imgs, { annotated: 'all' }), imgs);
});

test('filterImagesAdvanced: bbox min/max filters by bboxCount', () => {
  const imgs = [
    { name: 'a.jpg', hasAnnotation: false, bboxCount: 0 },
    { name: 'b.jpg', hasAnnotation: true, bboxCount: 2 },
    { name: 'c.jpg', hasAnnotation: true, bboxCount: 5 }
  ];
  assert.deepEqual(filterImagesAdvanced(imgs, { bboxesMin: 2 }), [imgs[1], imgs[2]]);
  assert.deepEqual(filterImagesAdvanced(imgs, { bboxesMax: 2 }), [imgs[0], imgs[1]]);
  assert.deepEqual(filterImagesAdvanced(imgs, { bboxesMin: 3, bboxesMax: 4 }), []);
});
