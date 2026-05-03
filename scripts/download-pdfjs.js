// PDF.js（公式ビルド）を取得してmedia/pdfjs/に配置するセットアップスクリプト
// https://github.com/mozilla/pdf.js/releases から prebuilt をダウンロード

const fs = require('fs');
const path = require('path');
const https = require('https');

const PDFJS_VERSION = '4.7.76'; // 安定版
const FILES = [
  {
    url: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`,
    filename: 'pdf.min.mjs',
  },
  {
    url: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
    filename: 'pdf.worker.min.mjs',
  },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'media', 'pdfjs');

// ダウンロード処理
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        // リダイレクト追従
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          return download(response.headers.location, dest).then(resolve, reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${response.statusCode}: ${url}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(err);
      });
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`PDF.js v${PDFJS_VERSION} をダウンロード中...`);
  for (const { url, filename } of FILES) {
    const dest = path.join(OUTPUT_DIR, filename);
    process.stdout.write(`  ${filename} ... `);
    try {
      await download(url, dest);
      const stat = fs.statSync(dest);
      console.log(`✓ (${(stat.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
      process.exit(1);
    }
  }
  console.log('\n完了！ media/pdfjs/ にPDF.jsを配置しました。');
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
