import fetch from 'node-fetch';
import { extractJobDetailsFromHtml } from '../src/scrapeJobUrl';

const url = process.argv[2];
if (!url) {
  console.error('Usage: npx ts-node backend/scripts/runExtract.ts <url>');
  process.exit(2);
}

(async () => {
  try {
    console.log('Fetching:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const parsed = extractJobDetailsFromHtml(html, url);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('Error fetching/parsing:', err);
    process.exit(1);
  }
})();
