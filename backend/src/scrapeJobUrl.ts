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

const decodeHtmlEntities = (str: string) => {
  if (!str) return "";
  // named entities (common subset)
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    nbsp: " ",
    apos: "'",
  };

  return str
    .replace(/&([a-zA-Z]+);/g, (_, name) => (named[name] ?? `&${name};`))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
};

const cleanText = (value?: string | null) => {
  if (!value) return "";
  const decoded = decodeHtmlEntities(value);
  return decoded
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2013\u2014\u2012]/g, "-")
    .trim();
};

const isCssLike = (chunk: string) => {
  if (!chunk) return false;
  const lowered = chunk.toLowerCase();
  const cssTokens = ['{', '}', '/*', '*/', 'sourceurl', '.css', 'jetpack', '@media', 'webkit-mask', 'mask-image', 'color-mix(', 'opacity:'];
  let tokenCount = 0;
  for (const t of cssTokens) if (lowered.includes(t)) tokenCount++;
  // also detect long sequences of punctuation which indicate CSS/JS
  const punctRatio = (chunk.match(/[^\w\s]/g) || []).length / Math.max(1, chunk.length);
  return tokenCount >= 1 || punctRatio > 0.12;
};

const sanitizeTextChunks = (text: string) => {
  if (!text) return '';
  // split into chunks by closing brace or long runs of punctuation/newlines
  const rawChunks = text.split(/\}|\n{2,}|;\s*/g).map(c => c.trim()).filter(Boolean);
  const good = rawChunks.filter(c => !isCssLike(c));
  // fall back to original if everything got removed
  const result = good.join('. ');
  return result || text;
};

const normalizeSkillToken = (input: string) => {
  if (!input) return "";
  let t = cleanText(input);
  t = t.replace(/<[^>]+>/g, ' ');
  t = t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  t = t.replace(/^,+|,+$/g, "").replace(/^\)+|\(+$/g, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
};

const dedupeCaseInsensitive = (arr: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!s) continue;
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
};

const normalizeCompany = (value?: string | null) => {
  const text = cleanText(value);
  if (!text) return "";
  return text.replace(/^(?:at|@)\s+/i, "").trim();
};

const normalizeLocation = (value?: string | null) => {
  const text = cleanText(value);
  if (!text) return "";

  const withoutPrefix = text.replace(
    /^(?:remote|hybrid|on-site|onsite|in-office|office)(?:\s*[•·-]|\s+)?\s*/i,
    ""
  );

  const result = withoutPrefix
    .replace(/^(?:location|office)\s*[:\-]\s*/i, "")
    .replace(/^[•·\-\s]+/, "")
    .replace(/[•·\-\s]+$/, "")
    .trim();

  return result;
};

const getMetaContent = (html: string, prop: string) => {
  const regex = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  const match = html.match(regex);
  if (match?.[1]) return match[1];

  const nameRegex = new RegExp(`<meta[^>]+name=["']${prop}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  return html.match(nameRegex)?.[1] ?? null;
};

const pickTextFromSelectors = (html: string, selectors: string[]) => {
  for (const selector of selectors) {
    const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, "i");
    const match = html.match(regex);
    if (match?.[1]) {
      return cleanText(match[1].replace(/<[^>]+>/g, " "));
    }
  }
  return "";
};

const parseTitle = (html: string, url: string) => {
  const explicit = cleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  let title = explicit || cleanText(html.match(/<meta[^>]+name=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]) || "";
  if (!title) {
    title = url.split(/[/?#]/).filter(Boolean).slice(-1)[0]?.replace(/[-_]+/g, " ") ?? "";
  }
  // remove common leading noise like "Apply for" or "Job:" and strip common site suffixes
  title = title.replace(/^\s*(?:Apply for|Apply now:|Job:|Job\s+opening\s*-?)\s*/i, "");

  // strip common site suffixes often appended by job sites (e.g. "| LinkedIn Jobs")
  try {
    const urlHost = new URL(url).hostname.replace(/^www\./, "");
    const parts = title.split("|").map((p) => p.trim());
    if (parts.length > 1) {
      const last = parts[parts.length - 1] || "";
      if (/linkedin|indeed|glassdoor|jobs|career|jobboard|jobber|welcome/i.test(last) || last.toLowerCase().includes(urlHost)) {
        parts.pop();
        title = parts.join(" | ");
      }
    }
  } catch (e) {
    // ignore malformed URL
  }

  // remove trailing site tokens after dashes/em-dashes
  title = title.replace(/\s+[–—-]\s*(?:LinkedIn|Indeed|Glassdoor|Jobs|Jobboard).*$/i, "");

  return cleanText(title || "");
};

const parseLocation = (html: string) => {
  const patterns = [
    /<[^>]*class=["'][^"']*(?:job-location|location|office|city|job-details)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<[^>]*>(?:Location|Office|City|Location:|Office:|City:)\s*([\s\S]*?)<\/[^>]+>/i,
    /(?:Remote|Hybrid|On-site|In-office)\s*[•·-]?\s*([A-Za-z0-9][^<\n]+?)(?:<|\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;

    const value = cleanText((match[1] ?? match[0]).replace(/<[^>]+>/g, " "));
    const normalized = normalizeLocation(value);
    if (normalized) return normalized;
  }

  const cityMatch = html.match(/\b(?:London|New York|Singapore|Berlin|Sydney|Paris|Toronto|Bangalore|Dubai|San Francisco)\b[^<]*?/i);
  if (cityMatch) {
    const candidate = cleanText(cityMatch[0]);
    const normalized = normalizeLocation(candidate);
    if (normalized) return normalized;
  }

  return "";
};

const parseDescription = (html: string) => {
  const mainCandidates = ["job-description", "description", "content", "job-details", "main", "article"];
  const text = pickTextFromSelectors(html, mainCandidates);
  if (text) return text;

  // prefer meta description / og:description when available
  const metaDesc = getMetaContent(html, 'og:description') || getMetaContent(html, 'description');
  if (metaDesc) return cleanText(metaDesc);

  // LinkedIn-specific: prefer the show-more-less markup which contains the full description
  const linkedInBlock = html.match(/<div[^>]*class=["'][^"']*show-more-less-html__markup[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (linkedInBlock && linkedInBlock[1]) {
    const inner = linkedInBlock[1];
    const items = Array.from(inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(m => cleanText((m[1]||'').replace(/<[^>]+>/g, ' '))).filter(Boolean);
    if (items.length) return items.join(' ');
    return cleanText(inner.replace(/<[^>]+>/g, ' '));
  }

  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map((m) =>
    cleanText(m[1].replace(/<[^>]+>/g, " "))
  );
  const description = paragraphs.filter(Boolean).slice(0, 8).join(" ");
  const fallback = cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
  const final = sanitizeTextChunks(description || fallback);
  return cleanText(final);
};

const parseJsonLdJobPosting = (html: string) => {
  const scripts = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)).map(m=>m[1]);
  for (const s of scripts) {
    try {
      const data = JSON.parse(s);
      // handle arrays or nested itemListElement
      const candidates = Array.isArray(data) ? data : [data];
      for (const cand of candidates) {
        const obj = cand?.['@graph'] ? cand['@graph'] : cand;
        const items = Array.isArray(obj) ? obj : [obj];
        for (const it of items) {
          const type = (it['@type'] || it['@type']?.toString() || '').toString();
          if (!type && it['@type'] === undefined) {
            // some pages nest under 'mainEntity'
            const main = it.mainEntity || it['mainEntityOfPage'];
            if (main && (main['@type'] || '').toString().toLowerCase().includes('job')) {
              return main;
            }
          }
          if (typeof type === 'string' && /jobposting/i.test(type)) {
            return it;
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
  return null;
};

const isLinkedInUrl = (url: string) => {
  try {
    return new URL(url).hostname.includes('linkedin.com');
  } catch (e) {
    return false;
  }
};

const pickTextNearH1 = (html: string) => {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) return { h1: '', nearby: '' };
  const h1Text = cleanText(h1Match[1].replace(/<[^>]+>/g, ' '));
  // look for a company link within next 800 chars
  const start = h1Match.index! + h1Match[0].length;
  const rest = html.slice(start, start + 800);
  const compLink = rest.match(/<a[^>]+href=["'][^"']*company[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1];
  const compSpan = rest.match(/<span[^>]*class=["'][^"']*(?:company|org|topcard__org-name|top-card__company)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  const company = cleanText((compLink || compSpan || '').replace(/<[^>]+>/g, ' '));
  return { h1: h1Text, nearby: company };
};

const splitKeywords = (text: string) => {
  const words = text
    .split(/[\n,;|/]+/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  const candidates = words
    .flatMap((part) => part.split(/\s*\+\s*|\s*and\s*|\s*\|\s*/i))
    .map((word) => cleanText(word))
    .filter(Boolean);

  const noisePatterns = [/sourceurl/i, /\.css/i, /http/i, /jetpack/i, /\{/, /\}/, /@media/i];

  const normalizeToken = (w: string) => {
    let t = cleanText(w);
    // remove enclosing punctuation and parentheses
    t = t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    // remove trailing or leading stray commas/periods/parentheses
    t = t.replace(/^,+|,+$/g, "").replace(/^\)+|\(+$/g, "");
    t = t.replace(/\s+/g, " ").trim();
    return t;
  };

  const filtered = candidates
    .map((w) => normalizeToken(w))
    .filter((w) => {
      if (!w) return false;
      if (w.length < 2) return false;
      const punctRatio = (w.match(/[^\w\s]/g) || []).length / Math.max(1, w.length);
      if (punctRatio > 0.3) return false;
      for (const p of noisePatterns) if (p.test(w)) return false;
      return true;
    });

  // deduplicate case-insensitively but preserve original case of first occurrence
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of filtered) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }

  return unique.slice(0, 20);
};

const findCompanyAndPosition = (title: string) => {
  if (!title) return { company: "", position: "" };

  // try patterns like "Position at Company — Location" or "Position - Core at Company"
  // if title contains ' at ' somewhere, prefer splitting there (handles 'Core at Jobgether')
  const atIndex = title.toLowerCase().indexOf(' at ');
  if (atIndex >= 0) {
    const before = title.slice(0, atIndex);
    let after = title.slice(atIndex + 4);
    // drop trailing tokens like location or site name
    after = after.split(/[\u2013\u2014\-|\|]/)[0].trim();
    const cleanedBefore = cleanText(before.replace(/^\s*(?:Apply for|Job[:\s-]*)/i, ''));
    const cleanedAfter = cleanText(after);
    if (cleanedAfter && cleanedBefore) {
      return { company: cleanedAfter, position: cleanedBefore };
    }
  }

  // fallback: "Position - Company"
  const dashMatch = title.match(/^(.*?)[\-–—]\s*(.+)$/);
  if (dashMatch) {
    const candidatePosition = cleanText(dashMatch[1]);
    const candidateCompany = cleanText(dashMatch[2]);
    if (candidatePosition && candidateCompany) {
      // if company looks like a site token (LinkedIn Jobs) don't use it
      if (/linkedin|jobs|indeed|glassdoor/i.test(candidateCompany)) {
        return { company: "", position: cleanText(title) };
      }
      return { company: candidateCompany, position: candidatePosition };
    }
  }

  // last resort: attempt to split on em dash used for location: "Position — Company"
  const emMatch = title.match(/^(.*?)\s+[\u2013\u2014]\s*(.+)$/);
  if (emMatch) {
    return { company: cleanText(emMatch[2]), position: cleanText(emMatch[1]) };
  }

  return { company: "", position: cleanText(title) };
};

// extract lists following headings like "Requirements", "Qualifications", "Responsibilities", "Skills"
const extractListsUnderHeadings = (html: string) => {
  const headingPattern = /<(h1|h2|h3|h4|strong|b)[^>]*>([\s\S]{0,300}?)<\/\1>/gi;
  const usefulHeadings = ['requirement', 'qualification', 'responsibil', "what you'll", 'what we', 'skill', 'experience', 'youll', 'you will'];
  let m: RegExpExecArray | null;
  while ((m = headingPattern.exec(html))) {
    const hText = cleanText(m[2] || '');
    if (!hText) continue;
    const lowered = hText.toLowerCase();
    if (usefulHeadings.some((k) => lowered.includes(k))) {
      // look forward from match index for a UL/OL
      const rest = html.slice(m.index + m[0].length, m.index + m[0].length + 4000);
      const listMatch = rest.match(/<(ul|ol)[^>]*>([\s\S]*?)<\/(ul|ol)>/i);
      if (listMatch && listMatch[2]) {
        const items = Array.from(listMatch[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(x => cleanText((x[1]||'').replace(/<[^>]+>/g, ' '))).filter(Boolean);
        if (items.length >= 1) return items;
      }
    }
  }

  // fallback: pick the largest ul/ol in the page with at least 3 items
  const allLists = Array.from(html.matchAll(/<(ul|ol)[^>]*>([\s\S]*?)<\/(ul|ol)>/gi));
  let best: string[] = [];
  for (const L of allLists) {
    const inner = L[2] || '';
    const items = Array.from(inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map(x => cleanText((x[1]||'').replace(/<[^>]+>/g, ' '))).filter(Boolean);
    if (items.length > best.length && items.length >= 3) best = items;
  }
  return best;
};

export function extractJobDetailsFromHtml(html: string, url: string): ScrapedJobData {
  // try to parse JobPosting JSON-LD first (most structured)
  const jsonLd = parseJsonLdJobPosting(html);

  const siteName = normalizeCompany(getMetaContent(html, "og:site_name"));
  const title = parseTitle(html, url);
  const { company: titleCompany, position: titlePosition } = findCompanyAndPosition(title);

  // If JSON-LD job posting found, prefer its fields
  if (jsonLd) {
    const jTitle = cleanText(jsonLd.title || jsonLd.name || jsonLd.headline || titlePosition || title || "");
    const jCompany = normalizeCompany(
      jsonLd.hiringOrganization?.name || jsonLd.hiringOrganization || siteName || titleCompany
    );

    // jobLocation can be object or array
    let jLocation = "";
    const jobLoc = jsonLd.jobLocation || jsonLd.jobLocationType || jsonLd.jobLocation || null;
    if (jobLoc) {
      if (Array.isArray(jobLoc)) {
        const first = jobLoc[0];
        jLocation = cleanText(first?.address?.addressLocality || first?.address?.addressRegion || first?.address?.addressCountry || first?.address || first?.name || "");
      } else {
        jLocation = cleanText(jobLoc?.address?.addressLocality || jobLoc?.address?.addressRegion || jobLoc?.address?.addressCountry || jobLoc?.address || jobLoc?.name || "");
      }
    }

    const rawDescription = typeof jsonLd.description === 'string'
      ? jsonLd.description
      : Array.isArray(jsonLd.description)
      ? jsonLd.description.join(' ')
      : (typeof jsonLd.jobBenefits === 'string' ? jsonLd.jobBenefits : Array.isArray(jsonLd.jobBenefits) ? jsonLd.jobBenefits.join(' ') : '');
    const descNoTags = rawDescription.replace(/<[^>]+>/g, ' ');
    const jDescription = cleanText(descNoTags);

    const jRequirements = jsonLd.qualifications || jsonLd.jobRequirements || jsonLd.responsibilities || jsonLd.qualifications || '';
    const reqNoTags = typeof jRequirements === 'string' ? jRequirements.replace(/<[^>]+>/g, ' ') : Array.isArray(jRequirements) ? jRequirements.join(', ').replace(/<[^>]+>/g, ' ') : '';
    const requirementsText = reqNoTags;

    const rawSkills = Array.isArray(jsonLd.skills) ? jsonLd.skills.join(', ') : (typeof jsonLd.skills === 'string' ? jsonLd.skills : (Array.isArray(jsonLd.keySkills) ? jsonLd.keySkills.join(', ') : (typeof jsonLd.keySkills === 'string' ? jsonLd.keySkills : '')));
    const skillsText = (rawSkills || '').replace(/<[^>]+>/g, ' ');

    const descTokens = jDescription
      .split(/\s+/)
      .filter((word) => /[A-Z]{2,}/.test(word) && word.length > 2)
      .map(normalizeSkillToken)
      .filter(Boolean)
      .slice(0, 10);

    const merged = [
      ...splitKeywords(skillsText || requirementsText),
      ...descTokens,
    ];

    const normalizedSkills = dedupeCaseInsensitive(merged).slice(0, 12);

    return {
      company: jCompany || "Unknown company",
      position: jTitle || "Untitled role",
      location: normalizeLocation(jLocation) || null,
      job_description: jDescription || null,
      requirements: requirementsText ? splitKeywords(requirementsText) : [],
      skills: normalizedSkills,
      salary: jsonLd.baseSalary ? (typeof jsonLd.baseSalary === 'string' ? jsonLd.baseSalary : (jsonLd.baseSalary?.value?.value || null)) : null,
      employment_type: jsonLd.employmentType || jsonLd.jobEmploymentType || null,
      source: jsonLd.url || "Job posting link",
    };
  }

  // fallback heuristics when JSON-LD unavailable
  // LinkedIn-specific heuristics: prefer the <h1> as position and nearby company anchor/span
  let company = normalizeCompany(siteName || titleCompany || pickTextFromSelectors(html, ["company", "employer", "organization"]));
  let position = cleanText(titlePosition || pickTextFromSelectors(html, ["h1", "job-title", "position"]));

  if (isLinkedInUrl(url)) {
    const near = pickTextNearH1(html);
    if (near.h1) {
      position = position || near.h1;
    }
    if (near.nearby) {
      company = company || normalizeCompany(near.nearby);
    }
    // also try list-based extraction for LinkedIn
    const linkedLists = extractListsUnderHeadings(html);
    if (linkedLists && linkedLists.length) {
      // prefer first list as requirements
    }
  }

  const location = cleanText(
    parseLocation(html) ||
      (title.match(/\(([^)]+)\)/)?.[1] ?? "") ||
      getMetaContent(html, "og:locale") ||
      ""
  );

  const description = parseDescription(html);
  const requirementsText = pickTextFromSelectors(html, ["requirements", "responsibilities", "qualifications"]);
  const skillsText = pickTextFromSelectors(html, ["skills", "tech-stack", "experience"]);

  // try to extract list-based requirements/skills (LinkedIn and many job sites use headings + UL)
  const headingLists = extractListsUnderHeadings(html);
  const listRequirements = (headingLists && headingLists.length) ? headingLists : [];

  const mergedSkills = [
    ...splitKeywords(skillsText),
    ...splitKeywords(listRequirements.join(', ')),
    ...description
      .split(/\s+/)
      .filter((word) => /[A-Z]{2,}/.test(word) && word.length > 2)
      .map(normalizeSkillToken)
      .filter(Boolean)
      .slice(0, 10),
  ];

  const normalizedSkills = dedupeCaseInsensitive(mergedSkills).slice(0, 12);

  return {
    company: company || "Unknown company",
    position: position || "Untitled role",
    location: normalizeLocation(location) || null,
    job_description: description || null,
    requirements: (listRequirements.length > 0) ? listRequirements : (requirementsText ? splitKeywords(requirementsText) : []),
    skills: normalizedSkills,
    salary: null,
    employment_type: null,
    source: "Job posting link",
  };
}
