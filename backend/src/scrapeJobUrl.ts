export interface ScrapedJobData {
  company?: string | null;
  position?: string | null;
  location?: string | null;
  job_description?: string | null;
  requirements?: string[];
  skills?: string[];
  salary?: string | null;
  employment_type?: string | null;
  source?: string | null;
}

const cleanText = (value?: string | null) => {
  if (!value) return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
};

const normalizeCompany = (value?: string | null) => {
  const text = cleanText(value);
  if (!text) return "";
  return text.replace(/^(?:at|@)\s+/i, "");
};

const getMetaContent = (html: string, prop: string) => {
  const regex = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  const match = html.match(regex);
  if (match?.[1]) return match[1];

  const nameRegex = new RegExp(`<meta[^>]+name=["']${prop}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  return html.match(nameRegex)?.[1] ?? null;
};

const pickTextFromSelectors = (html: string, selectors: string[]) => {
  for (const selector of selectors) {
    const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i');
    const match = html.match(regex);
    if (match?.[1]) {
      return cleanText(match[1].replace(/<[^>]+>/g, " "));
    }
  }
  return "";
};

const parseTitle = (html: string, url: string) => {
  const explicit = cleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  if (explicit) return explicit;

  const canonical = cleanText(html.match(/<meta[^>]+name=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]);
  if (canonical) return canonical;

  return url.split(/[/?#]/).filter(Boolean).slice(-1)[0]?.replace(/[-_]+/g, " ") ?? "";
};

const parseLocation = (html: string) => {
  const candidates = [
    /(?:location|office|city)[^<>]*>([^<]+)</i,
    /<span[^>]*class=["'][^"']*(?:location|office|city)[^"']*["'][^>]*>([^<]+)<\/span>/i,
    /<div[^>]*class=["'][^"']*(?:location|office|city)[^"']*["'][^>]*>([^<]+)<\/div>/i,
    /(?:Remote|Hybrid|On-site|In-office|London|New York|Singapore|Berlin|Sydney|Paris|Toronto|Bangalore|Dubai|Remote\s*·|Hybrid\s*·)/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
    if (match && match[0]) return cleanText(match[0]);
  }

  return "";
};

const parseDescription = (html: string) => {
  const mainCandidates = [
    'job-description',
    'description',
    'content',
    'job-details',
    'main',
    'article',
  ];

  const text = pickTextFromSelectors(html, mainCandidates);
  if (text) return text;

  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => cleanText(m[1].replace(/<[^>]+>/g, ' ')));
  const description = paragraphs.filter(Boolean).slice(0, 8).join(' ');
  return description || cleanText(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
};

const splitKeywords = (text: string) => {
  const words = text
    .split(/[\n,;|/]+/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  return words.flatMap((part) => part.split(/\s*\+\s*|\s*and\s*|\s*\|\s*/i)).map((word) => cleanText(word)).filter(Boolean).slice(0, 20);
};

export function extractJobDetailsFromHtml(html: string, url: string): ScrapedJobData {
  const siteName = normalizeCompany(getMetaContent(html, 'og:site_name'));
  const title = parseTitle(html, url);

  const companyFromTitle = title.match(/at\s+(.+?)(?:\s+-\s+|\s*$)/i)?.[1] || null;
  const company = normalizeCompany(siteName || companyFromTitle || pickTextFromSelectors(html, ['company', 'employer', 'organization']));

  const position = cleanText(
    title
      .replace(new RegExp(`^${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*[-–:]?\s*`, 'i'), '')
      .replace(new RegExp(`\s*at\s+.*$`, 'i'), '')
      .replace(/\s*[-–:]\s*.*$/, '')
      .trim() ||
      pickTextFromSelectors(html, ['h1', 'job-title', 'position'])
  );

  const location = cleanText(
    parseLocation(html) ||
      (title.match(/\(([^)]+)\)/)?.[1] ?? '') ||
      getMetaContent(html, 'og:locale') ||
      ''
  );

  const description = parseDescription(html);
  const requirementsText = pickTextFromSelectors(html, ['requirements', 'responsibilities', 'qualifications']);
  const skillsText = pickTextFromSelectors(html, ['skills', 'tech-stack', 'experience']);

  const normalizedSkills = [
    ...splitKeywords(skillsText),
    ...description
      .split(/\s+/)
      .filter((word) => /[A-Z]{2,}/.test(word) && word.length > 2)
      .slice(0, 10),
  ].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 12);

  return {
    company: company || 'Unknown company',
    position: position || 'Untitled role',
    location: location || null,
    job_description: description || null,
    requirements: requirementsText ? splitKeywords(requirementsText) : [],
    skills: normalizedSkills,
    salary: null,
    employment_type: null,
    source: 'Job posting link',
  };
}
