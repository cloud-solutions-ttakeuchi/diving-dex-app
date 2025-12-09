
import fs from 'fs';

const locations = JSON.parse(fs.readFileSync('src/data/locations_seed.json', 'utf8'));
const pointCreatures = JSON.parse(fs.readFileSync('src/data/point_creatures_seed.json', 'utf8'));

// 1. Collect all valid Point IDs from locations
const validPointIds = new Set();
function traverse(node) {
  if (node.type === 'Point' || node.id?.startsWith('p_')) {
    validPointIds.add(node.id);
  }
  if (node.children) {
    node.children.forEach(traverse);
  }
}
locations.forEach(traverse);

console.log(`Found ${validPointIds.size} valid points in locations_seed.json`);

// 2. Check Point Creatures
let orphanedCount = 0;
const validLinks = [];

pointCreatures.forEach(pc => {
  if (validPointIds.has(pc.pointId)) {
    validLinks.push(pc);
  } else {
    orphanedCount++;
  }
});

console.log(`Total links: ${pointCreatures.length}`);
console.log(`Valid links: ${validLinks.length}`);
console.log(`Orphaned links: ${orphanedCount}`);

if (orphanedCount > 0) {
  fs.writeFileSync('src/data/point_creatures_seed.json', JSON.stringify(validLinks, null, 2));
  console.log('Cleaned point_creatures_seed.json (removed orphans).');
} else {
  console.log('No orphans found. File is clean.');
}
