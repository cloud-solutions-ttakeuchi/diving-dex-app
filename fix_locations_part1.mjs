
import fs from 'fs';
import path from 'path';

const filePath = 'src/data/locations_seed.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Helper to find a node by name (DFS)
function findNode(nodes, name, type) {
  for (const node of nodes) {
    if (node.name === name) return node; // Weak check, assuming unique names at level? No.
    // We need to find GLOBAL unique path or check structure.
    // For Izu, we look at Top Level -> Children (Regions).
    // Japan -> Region "Izu" vs "Izu Peninsula".
  }
  return null;
}

// 1. Fix Izu (Japan > Izu vs Izu Peninsula)
const japan = data.find(n => n.name === '日本');
if (japan) {
  const izu = japan.children.find(c => c.name === '伊豆');
  const izuPen = japan.children.find(c => c.name === '伊豆半島');

  if (izu && izuPen) {
    console.log('Merging Izu into Izu Peninsula...');
    // Move children of Izu to Izu Peninsula (avoiding duplicates)
    // Izu Peninsula has children too.

    // Strategy: Iterate Izu children (Areas/Zones)
    izu.children.forEach(sourceChild => {
      const targetChild = izuPen.children.find(tc => tc.name === sourceChild.name);
      if (targetChild) {
        // Merge grand-children (Points)
        sourceChild.children.forEach(sourcePoint => {
          const targetPoint = targetChild.children.find(tp => tp.name === sourcePoint.name);
          if (!targetPoint) {
            targetChild.children.push(sourcePoint);
          } else {
            // Point Exists. Merge? Or ignore if identical?
            // Assuming identical for seed.
          }
        });
      } else {
        // Move whole child
        izuPen.children.push(sourceChild);
      }
    });
    // Connect Izu Peninsula as THE one.
    // Remove '伊豆'
    japan.children = japan.children.filter(c => c.name !== '伊豆');
  }
}

// 2. Fix Bali (Bali > South vs South Bali, etc.)
const bali = data.find(n => n.name === 'バリ');
if (bali) {
  // Map of preferred names: { '南部': '南部バリ', '東部': '東部バリ', 'ヌサペニダ': 'ペニダ島' } ...
  // Let's standardise to "〜バリ" (South Bali) if available, or create it.
  // Existing: "南部" and "南部バリ".
  // We want "南部バリ".

  const mergePairs = [
    { bad: '南部', good: '南部バリ' },
    { bad: '東部', good: '東部バリ' },
    { bad: '西部', good: '西部バリ' }, // if exists
    { bad: '北西部', good: '北西部バリ' }, // if exists
    { bad: 'ヌサペニダ', good: 'ペニダ島' } // Standardize on Penida Island? Or Nusa Penida? 'ペニダ島' usually.
  ];

  mergePairs.forEach(pair => {
    const badNode = bali.children.find(c => c.name === pair.bad);
    let goodNode = bali.children.find(c => c.name === pair.good);

    if (badNode) {
      console.log(`Merging ${pair.bad} into ${pair.good}...`);
      if (!goodNode) {
        // Rename bad to good if good doesn't exist
        badNode.name = pair.good;
        goodNode = badNode;
      } else {
        // Merge bad into good
        badNode.children.forEach(sourceChild => {
          const targetChild = goodNode.children.find(tc => tc.name === sourceChild.name);
          if (targetChild) {
            sourceChild.children.forEach(sourcePoint => {
              const targetPoint = targetChild.children.find(tp => tp.name === sourcePoint.name);
              if (!targetPoint) targetChild.children.push(sourcePoint);
            });
          } else {
            goodNode.children.push(sourceChild);
          }
        });
        // Remove bad
        bali.children = bali.children.filter(c => c.name !== pair.bad);
      }
    }
  });
}

// 3. Fix Mexico
const mexico = data.find(n => n.name === 'メキシコ');
if (mexico) {
  const mergePairs = [
    { bad: 'カリブ海', good: 'ユカタン半島（カリブ海側）' }, // Prefer descriptive land name? Or Sea? User said "Caribbean vs Yucatan".
    // Logic: "Yucatan" is land region. "Caribbean" is sea.
    // Usually divelog apps use Region (Land) > Area.
    // So 'ユカタン半島' is better region. 'カリブ海' is too broad.
    { bad: '太平洋（バハ・カリフォルニア半島）', good: 'バハ・カリフォルニア半島（太平洋側/コルテス海側）' }
  ];

  mergePairs.forEach(pair => {
    const badNode = mexico.children.find(c => c.name === pair.bad);
    let goodNode = mexico.children.find(c => c.name === pair.good);

    if (badNode) {
      console.log(`Merging ${pair.bad} into ${pair.good}...`);
      if (!goodNode) {
        badNode.name = pair.good;
      } else {
        badNode.children.forEach(sourceChild => {
          const targetChild = goodNode.children.find(tc => tc.name === sourceChild.name);
          if (targetChild) {
            sourceChild.children.forEach(sourcePoint => {
              const targetPoint = targetChild.children.find(tp => tp.name === sourcePoint.name);
              if (!targetPoint) targetChild.children.push(sourcePoint);
            });
          } else {
            goodNode.children.push(sourceChild);
          }
        });
        mexico.children = mexico.children.filter(c => c.name !== pair.bad);
      }
    }
  });
}

// 4. Inspect Ishigaki (For Reporting)
// No changes yet, just log what's there for verification?
// Logic is separate.

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Fixed locations_seed.json');
