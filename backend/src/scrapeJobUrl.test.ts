const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJobDetailsFromHtml } = require('./scrapeJobUrl.ts');

test('extracts company, title, location and description from HTML', () => {
  const html = `
    <html>
      <head>
        <title>Frontend Engineer - Example Labs</title>
      </head>
      <body>
        <meta property="og:site_name" content="Example Labs" />
        <h1>Frontend Engineer</h1>
        <div class="job-location">Remote · London, UK</div>
        <div class="description">
          <p>Build and ship delightful user experiences.</p>
          <ul><li>React</li><li>TypeScript</li></ul>
        </div>
      </body>
    </html>
  `;

  const result = extractJobDetailsFromHtml(html, 'https://example.com/jobs/frontend-engineer');

  assert.equal(result.company, 'Example Labs');
  assert.equal(result.position, 'Frontend Engineer');
  assert.equal(result.location, 'London, UK');
  assert.match(result.job_description ?? '', /Build and ship delightful user experiences/i);
  assert.ok((result.skills ?? []).includes('React'));
});

test('falls back to page title when title tags are missing', () => {
  const html = `
    <html><head><title>Senior Product Designer at Acme</title></head><body>
      <div class="job-details">San Francisco, CA</div>
      <div>Design systems for enterprise customers.</div>
    </body></html>
  `;

  const result = extractJobDetailsFromHtml(html, 'https://acme.com/careers/design');

  assert.equal(result.company, 'Acme');
  assert.equal(result.position, 'Senior Product Designer');
  assert.equal(result.location, 'San Francisco, CA');
});
