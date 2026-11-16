'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const jsonScripts = scripts.filter(([, attrs]) => /\bid\s*=\s*["']embedded-state["']/.test(attrs));

// Static offline checks only. Browser and real Windows/iPad acceptance remain separate.
test('standalone Korean HTML has no remote script or stylesheet dependency', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html\s+lang=["']ko["']/i);
  assert.equal(scripts.length, 2);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b[^>]*\bhref\s*=\s*["']https?:\/\//i);
});

test('embedded state has unique stations, twelve months, and synthetic source', () => {
  assert.equal(jsonScripts.length, 1);
  const state = JSON.parse(jsonScripts[0][2]);
  assert.equal(state.version, 1);
  assert.match(state.source, /가상|합성/);
  assert.ok(Array.isArray(state.stations) && state.stations.length >= 2);
  assert.equal(new Set(state.stations.map(s => s.id)).size, state.stations.length);
  for (const station of state.stations) {
    assert.ok(typeof station.name === 'string' && station.name.length > 0);
    for (const key of ['temps', 'rain']) {
      assert.ok(Array.isArray(station[key]) && station[key].length === 12, station.name + ': ' + key + ' must cover 12 months');
      for (const value of station[key]) assert.ok(typeof value === 'number' && Number.isFinite(value));
    }
    for (const value of station.rain) assert.ok(value >= 0);
  }
  assert.ok(state.stations.some(s => s.id === state.activeId));
  assert.ok(Array.isArray(state.questions) && state.questions.length >= 2);
});

test('inline application JavaScript parses without external code', () => {
  const appScripts = scripts.filter(([, attrs]) => !/application\/json/i.test(attrs));
  assert.equal(appScripts.length, 1);
  new vm.Script(appScripts[0][2], { filename: 'climograph-inline.js' });
});

test('editing and local export controls remain present', () => {
  for (const id of ['editBtn', 'undoBtn', 'redoBtn', 'exportJsonBtn',
    'saveHtmlBtn', 'printBtn', 'loadJsonBtn', 'importCsvBtn', 'exportCsvBtn']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing control: ' + id);
  }
  for (const token of ['window.print()', 'new FileReader()', 'URL.createObjectURL',
    'function saveHTML()', 'function parseCSV(', 'function normalize(']) {
    assert.ok(html.includes(token), 'missing implementation: ' + token);
  }
});

test('CSV import rejects missing cells, invalid numbers, duplicate and extra months', () => {
  const script = scripts.find(([, attrs]) => !/application\/json/i.test(attrs))[2];
  const start = script.indexOf('function parseCSV(t){');
  const end = script.indexOf('function handleFileInput(', start);
  assert.ok(start >= 0 && end > start);
  const parseCSV = vm.runInNewContext(script.slice(start, end) + '\nparseCSV;', {}, { timeout: 1000 });
  const original = '월,기온,강수량\n' +
    Array.from({length: 12}, (_, i) => (i+1) + ',' + (i-2) + ',' + (i*5)).join('\n');
  assert.equal(parseCSV(original).rain[0], 0);
  assert.equal(parseCSV(original).temps[11], 9);
  const bad = [
    original.replace('1,-2,0', '1,,0'),
    original.replace('1,-2,0', '1,-2,'),
    original.replace('1,-2,0', '1,-2,-1'),
    original.replace('1,-2,0', '1,NaN,0'),
    original.replace('1,-2,0', '13,-2,0'),
    original.replace('2,-1,5', '1,-1,5'),
    original + '\n1,-2,0'
  ];
  for (const csv of bad) assert.throws(() => parseCSV(csv));
});

test('JSON normalization rejects blanks and null instead of replacing them with zero', () => {
  const script = scripts.find(([, attrs]) => !/application\/json/i.test(attrs))[2];
  const start = script.indexOf('function parseMeasure(');
  const end = script.indexOf('function syncForm(', start);
  assert.ok(start >= 0 && end > start);
  const defaults = JSON.parse(jsonScripts[0][2]);
  const normalize = vm.runInNewContext(script.slice(start, end) + '\nnormalize;', { defaults }, { timeout: 1000 });
  assert.equal(normalize(defaults).stations[0].rain[0], defaults.stations[0].rain[0]);
  for (const value of ['', null, false, 'N/A', ' ']) {
    const copy = JSON.parse(JSON.stringify(defaults));
    copy.stations[0].rain[0] = value;
    assert.throws(() => normalize(copy));
  }
  const zero = JSON.parse(JSON.stringify(defaults));
  zero.stations[0].rain[0] = 0;
  assert.equal(normalize(zero).stations[0].rain[0], 0);
});
