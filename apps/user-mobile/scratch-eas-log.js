const https = require('https');
const fs = require('fs');
const zlib = require('zlib');

const url = "https://storage.googleapis.com/eas-workflows-production/logs/93ed1b8a-b2b5-459c-911c-14817aea1c77/993cd2e0-3abd-4e9a-908b-2c4bd340c55a/2026-11-12T19%3A27%3A46Z-351ef3ba-bc13-4e2d-83e0-8f41b6bfd34b.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20261112%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20261112T213130Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=837e42c3f56799fd1f1f52ee182408afb76581e687ba595f35dc75ebedc06cc14dedef104712f14d3caaf40367ec48497598a7d6281240cbf6ee798e57dea5715ddb6e9a7125da6b88fe5735ca3bcb910ca77adb9cb0d1cdaabcf2e8dfebd4ee447f010aa44bcfabf1cdc4ebb0238c9ae89f80ad96781d2f72082c1836917ece284b669735a44dfb25a040fe2e3a13d6f81c8cdc6437316a7c0c63172ee1bd5bae33f90dbb91cc0f0e243dc845171467576b94dfedf8c3643984f7933247e2fe3ab8bde9412314e6cdfac6feba9a02782fa97eda501b2fecf7d903be9b68fb77d8b478dbc88d43ba0161eae46b0989dc4b4fef2b8865acc17128d8dd120fa534";

https.get(url, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    const decompressed = zlib.brotliDecompressSync(buf).toString('utf8');
    fs.writeFileSync('brotli-eas.log', decompressed);
    console.log('Brotli decompressed successfully! Length:', decompressed.length);
    const lines = decompressed.split('\n');
    console.log('Total lines:', lines.length);
    const idx = lines.findIndex(l => l.includes('* What went wrong:') || l.includes('FAILURE:'));
    if (idx !== -1) {
      console.log('\n--- ERROR CONTEXT ---');
      console.log(lines.slice(Math.max(0, idx - 5), idx + 35).join('\n'));
    }
  });
});