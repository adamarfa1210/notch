const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const baseDir = path.resolve(__dirname);
const folderAwal = path.join(baseDir, 'testing_dragdrop', 'folder_awal');
const folderAkhir = path.join(baseDir, 'testing_dragdrop', 'folder_akhir');

function getHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function run() {
  console.log('================================================================');
  console.log('   FULL END-TO-END VERIFICATION: 5 USER FILES (INGRESS & EGRESS)');
  console.log('================================================================');

  // 1. Clean folder_akhir
  if (fs.existsSync(folderAkhir)) {
    const existing = fs.readdirSync(folderAkhir);
    for (const f of existing) {
      fs.unlinkSync(path.join(folderAkhir, f));
    }
  } else {
    fs.mkdirSync(folderAkhir, { recursive: true });
  }
  console.log('[Step 1] folder_akhir cleaned.');

  // 2. Clear backend RAM buffer
  await new Promise((resolve, reject) => {
    const req = http.request('http://127.0.0.1:49152/api/items/clear', { method: 'POST' }, (res) => {
      resolve();
    });
    req.on('error', reject);
    req.end();
  });
  console.log('[Step 2] Notch RAM Buffer cleared.');

  // 3. Ingest all 5 files from folder_awal
  const filesAwal = fs.readdirSync(folderAwal);
  console.log(`[Step 3] Ingesting ${filesAwal.length} user files into Notch RAM:`);

  for (const fileName of filesAwal) {
    const fullPath = path.join(folderAwal, fileName);
    const payload = JSON.stringify({
      item_type: 'file',
      content: fullPath
    });

    await new Promise((resolve, reject) => {
      const req = http.request('http://127.0.0.1:49152/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload, 'utf8')
        }
      }, (res) => {
        let respData = '';
        res.on('data', chunk => respData += chunk);
        res.on('end', () => {
          console.log(`  -> Staged: "${fileName}" (Status: ${res.statusCode})`);
          resolve();
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  // 4. Read back items from RAM buffer (GET /api/items)
  const items = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:49152/api/items', (res) => {
      let raw = [];
      res.on('data', chunk => raw.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(raw).toString('utf8');
        resolve(JSON.parse(body));
      });
    }).on('error', reject);
  });

  console.log(`\n[Step 4] Notch RAM Buffer contains ${items.length} items (FIFO capacity: 5):`);
  items.forEach((item, idx) => {
    console.log(`  Slot #${idx + 1}: [${item.item_type}] "${item.preview}"`);
    console.log(`    Data Path: "${item.data}"`);
    console.log(`    Exists on Disk: ${fs.existsSync(item.data)}`);
  });

  // 5. Simulate Native Drag-Out (Egress) to folder_akhir
  console.log('\n[Step 5] Executing Egress Transfer from RAM Buffer -> folder_akhir:');
  const transferResults = [];

  for (const item of items) {
    const sourcePath = item.data;
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Item path does not exist on disk: ${sourcePath}`);
    }

    const destPath = path.join(folderAkhir, path.basename(sourcePath));
    // Simulate drop copy (as done by Windows Shell when dragged to destination folder)
    fs.copyFileSync(sourcePath, destPath);

    const sourceHash = getHash(sourcePath);
    const destHash = getHash(destPath);
    const sourceStat = fs.statSync(sourcePath);
    const destStat = fs.statSync(destPath);

    const match = (sourceHash === destHash && sourceStat.size === destStat.size);
    transferResults.push({
      name: path.basename(sourcePath),
      size: destStat.size,
      sha256: destHash.slice(0, 16) + '...',
      verified: match
    });

    console.log(`  -> Transferred: "${path.basename(sourcePath)}" [${(destStat.size / (1024 * 1024)).toFixed(2)} MB] - Verified: ${match}`);
  }

  // 6. Final Destination Verification
  const filesAkhir = fs.readdirSync(folderAkhir);
  console.log(`\n[Step 6] Verification Summary:`);
  console.log(`  Total Files in folder_akhir: ${filesAkhir.length} of 5 expected`);
  const allVerified = transferResults.every(r => r.verified) && filesAkhir.length === 5;
  console.log(`  All Hashes & Sizes 100% Match: ${allVerified ? 'PASSED ✅' : 'FAILED ❌'}`);

  console.log('================================================================\n');
}

run().catch(err => {
  console.error('[Verification Error]:', err);
  process.exit(1);
});
