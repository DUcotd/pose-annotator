import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSequentialNumbering } from './imageNumbering.js';

test('validateSequentialNumbering: empty list is ok', () => {
  assert.deepEqual(validateSequentialNumbering([]), { checked: true, ok: true });
});

test('validateSequentialNumbering: non-numbered names are not checked', () => {
  assert.deepEqual(validateSequentialNumbering([{ name: 'cat.jpg' }, { name: 'dog.jpg' }]), { checked: false, ok: true });
});

test('validateSequentialNumbering: detects gaps', () => {
  const r = validateSequentialNumbering([{ name: '000001.jpg' }, { name: '000003.jpg' }]);
  assert.equal(r.checked, true);
  assert.equal(r.ok, false);
  assert.equal(r.expected, '000002');
});

test('validateSequentialNumbering: passes unsorted but sequential set', () => {
  const r = validateSequentialNumbering([{ name: '000002.jpg' }, { name: '000001.jpg' }]);
  assert.deepEqual(r, { checked: true, ok: true });
});

