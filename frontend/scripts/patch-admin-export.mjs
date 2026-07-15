import { readFile, writeFile } from 'node:fs/promises';

const fileUrl = new URL('../src/app/admin/page.tsx', import.meta.url);
let source = await readFile(fileUrl, 'utf8');
source = source.replace(/\r\n/g, '\n');

const replacements = [
  [
    "worksheet.autoFilter = 'A1:N1';",
    "worksheet.autoFilter = 'A1:L1';"
  ],
  [
    "      '申込日時', '予約状態', '受付状態', '受付日時', 'キャンセル日時'",
    "      '申込日時', '予約状態', '受付日時'"
  ],
  [
    "    let currentNo = 1;\n    data.forEach(res => {\n      const row = worksheet.addRow([",
    "    let currentNo = 1;\n    const activeData = data.filter(res => !res.cancelled_at);\n    activeData.forEach(res => {\n      const row = worksheet.addRow(["
  ],
  [
    "        res.checked_in === 1 ? '受付済' : '未受付',\n        res.checked_in_at ? new Date(res.checked_in_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '',\n        res.cancelled_at ? `キャンセル済 (${new Date(res.cancelled_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })})` : '有効'",
    "        res.checked_in === 1 ? '受付済' : '未受付',\n        res.checked_in_at ? new Date(res.checked_in_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : ''"
  ],
  [
    "    worksheet.getColumn(11).width = 12; // Check-in Status\n    worksheet.getColumn(12).width = 22; // Check-in At\n    worksheet.getColumn(13).width = 30; // Cancel Status",
    "    worksheet.getColumn(11).width = 12; // Reservation status\n    worksheet.getColumn(12).width = 22; // Check-in time"
  ]
];

for (const [before, after] of replacements) {
  if (source.includes(before)) {
    source = source.replace(before, after);
  } else if (!source.includes(after)) {
    throw new Error(`Excel export patch target was not found: ${before.slice(0, 80)}`);
  }
}

await writeFile(fileUrl, source, 'utf8');
console.log('Applied admin Excel export cleanup.');
