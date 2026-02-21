import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSessionPhase } from './useAnnotationSession.js';

test('deriveSessionPhase reflects conflict first', () => {
  const phase = deriveSessionPhase({
    conflictInfo: { serverEtag: 'W/"1"' },
    isLoaded: true,
    lastLoadError: null,
    saveStatus: 'saved',
    hasUnsavedChanges: false
  });
  assert.equal(phase, 'conflict');
});

test('deriveSessionPhase order matches loading -> error -> saving -> dirty -> ready', () => {
  assert.equal(deriveSessionPhase({
    conflictInfo: null,
    isLoaded: false,
    lastLoadError: null,
    saveStatus: 'saved',
    hasUnsavedChanges: false
  }), 'loading');

  assert.equal(deriveSessionPhase({
    conflictInfo: null,
    isLoaded: true,
    lastLoadError: 'x',
    saveStatus: 'saved',
    hasUnsavedChanges: false
  }), 'error');

  assert.equal(deriveSessionPhase({
    conflictInfo: null,
    isLoaded: true,
    lastLoadError: null,
    saveStatus: 'saving',
    hasUnsavedChanges: true
  }), 'saving');

  assert.equal(deriveSessionPhase({
    conflictInfo: null,
    isLoaded: true,
    lastLoadError: null,
    saveStatus: 'saved',
    hasUnsavedChanges: true
  }), 'dirty');

  assert.equal(deriveSessionPhase({
    conflictInfo: null,
    isLoaded: true,
    lastLoadError: null,
    saveStatus: 'saved',
    hasUnsavedChanges: false
  }), 'ready');
});

