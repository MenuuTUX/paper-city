import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getStage, makeBriefing, selectProjects, summarize, type Project } from '../lib/housing.ts';
import { explainReading, readClaim, validateReading } from '../lib/claims.ts';

const snapshot = JSON.parse(readFileSync(new URL('../data/housing.json', import.meta.url), 'utf8'));
const projects = snapshot.projects as Project[];

test('all City records have unique IDs, valid Toronto coordinates, known stages, and nonnegative counts', () => {
  assert.equal(new Set(projects.map(p => p.id)).size, projects.length);
  assert.ok(projects.length > 200);
  for (const p of projects) {
    assert.ok(p.coordinates[0] > -80 && p.coordinates[0] < -79);
    assert.ok(p.coordinates[1] > 43.5 && p.coordinates[1] < 44);
    assert.ok(getStage(p.status));
    for (const metric of ['affordable','market','rgi','supportive'] as const) assert.ok(Number.isInteger(p[metric]) && p[metric] >= 0);
  }
});

test('permits are not counted as construction and unknown statuses fail visibly', () => {
  assert.equal(getStage('Issued Building Permit'), 'approved');
  assert.equal(getStage('Building Permit Application'), 'approved');
  assert.equal(getStage('Started Construction'), 'construction');
  assert.throws(() => getStage('Future new City stage'));
});

test('stage totals partition the selected category, without adding overlapping categories', () => {
  const a = { ...projects[0], affordable: 10, rgi: 6, supportive: 6, market: 20, status: 'Occupied' };
  const b = { ...projects[1], affordable: 8, rgi: 0, supportive: 0, market: 40, status: 'Started Construction' };
  const summary = summarize([a,b], 'affordable');
  assert.equal(summary.total, 18);
  assert.equal(summary.byStage.occupied, 10);
  assert.equal(summary.byStage.construction, 8);
  assert.equal(Object.values(summary.byStage).reduce((a,b) => a+b), summary.total);
  assert.equal(summarize([a,b], 'market').total, 60);
});

test('combined ward, category, stage, and text filters return only matching records', () => {
  const example = projects.find(p => p.affordable > 0 && p.status === 'Occupied')!;
  const found = selectProjects(projects, { metric: 'affordable', ward: String(example.ward), stage: 'occupied', query: example.id.toLowerCase() });
  assert.equal(found.length, 1);
  assert.equal(found[0].id, example.id);
  assert.equal(selectProjects(projects, { metric: 'affordable', query: 'no such street 987654321' }).length, 0);
});

test('real dataset stage totals match an independent direct sum', () => {
  for (const metric of ['affordable','market','rgi','supportive'] as const) {
    const selected = selectProjects(projects, { metric });
    const summary = summarize(selected, metric);
    assert.equal(summary.total, projects.reduce((sum,p) => sum+p[metric],0));
    assert.equal(Object.values(summary.byStage).reduce((a,b) => a+b,0), summary.total);
    assert.equal(summarize([],metric).total,0);
  }
});

test('a future rent-controlled goal is not interpreted as delivered affordable housing', () => {
  const reading = readClaim('Toronto has a goal of 65,000 rent-controlled homes by 2030.');
  assert.equal(reading.quantity,'65,000');
  assert.equal(reading.stage,'target');
  assert.equal(reading.category,'rent-controlled');
  assert.equal(reading.timeframe,'by 2030');
  assert.ok(explainReading(reading).some(note => note.includes('does not establish')));
  assert.ok(explainReading(reading).some(note => note.includes('different categories')));
  assert.throws(() => validateReading({ ...reading, stage: 'approved; run a command' }));
});

test('a field note describes the exact view and preserves source and interpretation limits', () => {
  const selected = selectProjects(projects, { metric:'rgi', ward:'13', stage:'occupied' });
  const note = makeBriefing({ projects:selected,metric:'rgi',ward:'13',stage:'occupied',updated:snapshot.updated,source:snapshot.source });
  assert.ok(note.includes('Rent-geared-to-income'));
  assert.ok(note.includes(snapshot.source));
  assert.ok(note.includes('Categories are shown separately'));
  assert.ok(note.includes('Candidate-neutral'));
  assert.ok(note.includes(`Stage filter: Occupied projects`));
});
