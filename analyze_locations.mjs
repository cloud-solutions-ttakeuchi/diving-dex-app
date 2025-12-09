
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/data/locations_seed.json', 'utf8'));

const regions = new Map();
const zones = new Map();
const areas = new Map();
const points = new Map();

function traverse(node, type, parentPath = '') {
  const name = node.name;
  const currentPath = parentPath ? `${parentPath} > ${name}` : name;

  if (type === 'Region') {
    if (!regions.has(name)) regions.set(name, []);
    regions.get(name).push(currentPath);
  } else if (type === 'Zone') {
    if (!zones.has(name)) zones.set(name, []);
    zones.get(name).push(currentPath);
  } else if (type === 'Area') {
    if (!areas.has(name)) areas.set(name, []);
    areas.get(name).push(currentPath);
  } else if (type === 'Point') {
    if (!points.has(name)) points.set(name, []);
    points.get(name).push(currentPath);
  }

  if (node.children) {
    let childType = '';
    if (type === 'Region') childType = 'Zone';
    else if (type === 'Zone') childType = 'Area';
    else if (type === 'Area') childType = 'Point';

    // Some nodes might have explicit type
    node.children.forEach(child => {
      const nextType = child.type || childType;
      traverse(child, nextType, currentPath);
    });
  }
}

data.forEach(region => traverse(region, 'Region'));

console.log('--- Duplicates Report ---');

console.log('\n[Duplicate Zones]');
zones.forEach((paths, name) => {
  if (paths.length > 1) console.log(`${name}: ${paths.length} occurrences\n  ${paths.join('\n  ')}`);
});

console.log('\n[Duplicate Areas]');
areas.forEach((paths, name) => {
  if (paths.length > 1) console.log(`${name}: ${paths.length} occurrences\n  ${paths.join('\n  ')}`);
});

console.log('\n[Duplicate Points]');
points.forEach((paths, name) => {
  if (paths.length > 1) console.log(`${name}: ${paths.length} occurrences\n  ${paths.join('\n  ')}`);
});
