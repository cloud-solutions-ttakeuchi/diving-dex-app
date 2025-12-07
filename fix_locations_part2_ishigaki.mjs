
import fs from 'fs';

const filePath = 'src/data/locations_seed.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Helper to calculate specific ID for stability?
// For now, we'll generate simple IDs or reuse if possible.
// But since we are restructuring, new Area IDs are safer.
const generateId = (prefix) => `${prefix}_${Math.floor(Math.random() * 1000000)}`;

// 1. Find Ishigaki Island Zone
// We traverse to find a node named "石垣島"
let ishigakiNode = null;

function findIshigaki(nodes) {
  for (const node of nodes) {
    if (node.name === '石垣島') return node;
    if (node.children) {
      const found = findIshigaki(node.children);
      if (found) return found;
    }
  }
  return null;
}

ishigakiNode = findIshigaki(data);

if (!ishigakiNode) {
  console.error('Ishigaki Island node not found!');
  process.exit(1);
}

console.log('Found Ishigaki Node:', ishigakiNode.name);

// 2. Prepare new Areas
const newAreas = {
  '川平・石崎': {
    name: '川平・石崎',
    description: 'マンタスクランブルなどがある北部・北西エリア',
    id: generateId('a_ishigaki_kabira'), // specialized ID
    type: 'Area',
    children: []
  },
  '大崎・名蔵': {
    name: '大崎・名蔵',
    description: '生物豊富な大崎ハナゴイリーフや名蔵湾など',
    id: generateId('a_ishigaki_osaki'),
    type: 'Area',
    children: []
  },
  '米原・北部': {
    name: '米原・北部',
    description: 'Wリーフなどサンゴが美しい北部エリア',
    id: generateId('a_ishigaki_yonehara'),
    type: 'Area',
    children: []
  },
  '市街地・南部': {
    name: '市街地・南部',
    description: '港からのアクセスが良い南部エリアや離島方面',
    id: generateId('a_ishigaki_city'),
    type: 'Area',
    children: []
  }
};

// 3. Mapping Logic
function mapPointToArea(point) {
  const n = point.name;
  // Priority Match
  if (n.includes('マンタ') || n.includes('川平') || n.includes('石崎')) return '川平・石崎';
  if (n.includes('大崎') || n.includes('名蔵') || n.includes('崎枝') || n.includes('御神崎') || n.includes('アカククリ')) return '大崎・名蔵';
  if (n.includes('米原') || n.includes('荒川') || n.includes('Ｗリーフ') || n.includes('Wリーフ')) return '米原・北部';

  // Default / South
  return '市街地・南部';
}

// 4. Collect and Distribute Points
const collectedPoints = [];
// Iterate existing areas (children of Ishigaki)
if (ishigakiNode.children) {
  ishigakiNode.children.forEach(oldArea => {
    if (oldArea.children) {
      oldArea.children.forEach(point => {
        // Check if we already collected this point (by name)?
        // Duplicate removal logic:
        const existingIndex = collectedPoints.findIndex(p => p.name === point.name);
        if (existingIndex === -1) {
          collectedPoints.push(point);
        } else {
          // If duplicate, maybe keep the one with better metadata?
          // For now, keep first.
          console.log(`Skipping duplicate point during collect: ${point.name}`);
        }
      });
    }
  });
}

// 5. Assign to New Areas
collectedPoints.forEach(point => {
  const targetAreaName = mapPointToArea(point);
  // Update Point ID? No, keep existing ID if possible to preserve?
  // Actually, if we are deduping, the ID might matter if it was used in logs.
  // But this is "Seed" data.

  newAreas[targetAreaName].children.push(point);
});

// 6. Replace Children
ishigakiNode.children = Object.values(newAreas);

// 7. Save
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Restructured Ishigaki Areas successfully.');
console.log('Points distribution:');
Object.values(newAreas).forEach(a => {
  console.log(`- ${a.name}: ${a.children.length} points`);
});
