import { writeFile } from 'node:fs/promises';

const base = 'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/';
const packageId = 'upcoming-and-recently-completed-affordable-housing-units';
const metaResponse = await fetch(`${base}package_show?id=${packageId}`);
if (!metaResponse.ok) throw new Error(`City metadata returned ${metaResponse.status}`);
const metadata = await metaResponse.json();
if (!metadata.success) throw new Error('City metadata request failed');
const resource = metadata.result.resources.find(r => r.datastore_active);
if (!resource) throw new Error('No active city data resource');
const records = [];
for (let offset = 0; ; offset += 1000) {
  const response = await fetch(`${base}datastore_search?resource_id=${resource.id}&limit=1000&offset=${offset}`);
  if (!response.ok) throw new Error(`City data returned ${response.status}`);
  const page = await response.json();
  if (!page.success) throw new Error('City data request failed');
  records.push(...page.result.records);
  if (records.length >= page.result.total) break;
}
const number = (value) => {
  const n = Number(String(value ?? '').replaceAll(',', '').trim());
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid unit count: ${value}`);
  return n;
};
const ids = new Set();
const projects = records.map(record => {
  const id = record['Project ID'];
  if (!id || ids.has(id)) throw new Error(`Missing or duplicate project ID: ${id}`);
  ids.add(id);
  const geometry = typeof record.geometry === 'string' ? JSON.parse(record.geometry) : record.geometry;
  const coordinates = geometry?.coordinates;
  if (!coordinates || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) throw new Error(`Invalid coordinates: ${id}`);
  return {
    id,
    address: record['Anchor Address'],
    addresses: record.Addresses,
    status: record.Status,
    ward: number(record['Ward Number']),
    wardName: record['Ward Name'],
    affordable: number(record['Affordable Homes Approved']),
    market: number(record['Rent-Controlled Market Units Approved']),
    rgi: number(record['RGI Homes Approved']),
    supportive: number(record['Supportive Units']),
    torontoBuilds: record['Toronto Builds Portfolio'] === 'Yes',
    coordinates,
  };
});
const result = {
  source: `https://open.toronto.ca/dataset/${packageId}/`,
  api: `${base}datastore_search?resource_id=${resource.id}`,
  title: metadata.result.title,
  updated: metadata.result.last_refreshed,
  retrieved: new Date().toISOString(),
  projects,
};
await writeFile(new URL('../data/housing.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`Saved ${projects.length} verified project records. Source refreshed ${result.updated}.`);
