import prisma from "../../src/prismaClient";
import { extractJobDetailsFromHtml } from "../../src/scrapeJobUrl";
import { verifyToken } from "../../src/auth";

async function fetchJobPageHtml(url: string): Promise<string> {
  const candidates = [url, `https://r.jina.ai/http://${url}`];
  const perRequestTimeout = 8000; // ms

  for (const candidate of candidates) {
    // eslint-disable-next-line no-console
    console.log("preview: trying candidate", candidate);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), perRequestTimeout);
      const response = await fetch(candidate, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0; +https://localhost)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      clearTimeout(timeout);

      // eslint-disable-next-line no-console
      console.log("preview: candidate response", candidate, response.status);

      if (!response.ok) continue;

      const html = await response.text();
      if (html && html.trim()) return html;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("preview: fetch candidate failed", candidate, err && (err.name || err.message));
      continue;
    }
  }

  try {
    // In serverless production environments (Vercel), Puppeteer cold-starts and
    // binary availability often cause long delays or function failures. Skip
    // the Puppeteer fallback in production to avoid function invocation timeouts.
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console
      console.warn("preview: skipping puppeteer fallback in production/serverless");
      throw new Error("skip-puppeteer");
    }

    // optional puppeteer fallback for local/dev where it's available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");
      await page.setExtraHTTPHeaders({ Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" });
      const tryTargets = [url, `http://${url.replace(/^https?:\/\//, "")}`];
      for (const t of tryTargets) {
        try {
          await page.goto(t, { waitUntil: "networkidle2", timeout: 20000 });
          const content = await page.content();
          if (content && content.trim()) {
            await page.close();
            await browser.close();
            return content;
          }
        } catch (e) {
          continue;
        }
      }
      await browser.close();
    } catch (e) {
      try {
        await browser.close();
      } catch {}
    }
  } catch (e) {
    // puppeteer not available, skipped, or failed
  }

  throw new Error("The job page is blocking automated fetches, so its details could not be parsed automatically.");
}

export default async function handler(req: any, res: any) {
  try {
    // DEBUG: log incoming request method, auth header presence, and body for troubleshooting
    try {
      // avoid logging full tokens in case of sensitive data
      const auth = req.headers?.authorization ? (String(req.headers.authorization).startsWith("Bearer ") ? `Bearer ${String(req.headers.authorization).slice(7, 15)}...` : String(req.headers.authorization)) : null;
      // eslint-disable-next-line no-console
      console.log("/applications/preview incoming", { method: req.method, auth, body: req.body });
    } catch (e) {}
    // CORS
    const origin = req.headers?.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const authHeader = req.headers?.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const username = token ? verifyToken(token) : null;
    if (!username) return res.status(401).json({ error: "Authentication required" });

    const { url } = req.body ?? {};
    if (!url || typeof url !== "string") return res.status(400).json({ error: "A valid job URL is required." });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "The job URL is not valid." });
    }

    try {
      // In production/serverless the outbound fetch often fails or times out.
      // For urgent demos, return a fast canned preview so the UI remains usable.
      if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        // Production-safe quick heuristic preview:
        // 1) Try a fast proxy fetch (r.jina.ai) with a short timeout to get HTML title/description.
        // 2) If that fails, derive company/position heuristically from the URL.
        // This avoids long network/Puppeteer cold-starts while giving useful autofill values for demos.
        // eslint-disable-next-line no-console
        console.log("preview: running production heuristic preview");
        const hostname = parsedUrl.hostname.replace(/^www\./, "");
        const domain = hostname.split(".")[0] || hostname;
        const deriveCompany = () => {
          // Try to get a nicer company name from the host
          return domain.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        };
        const derivePosition = () => {
          // Use path segments as a fallback position
          const parts = parsedUrl.pathname.split("/").filter(Boolean);
          if (parts.length === 0) return "Job application";
          const last = parts[parts.length - 1].replace(/[-_]+/g, " ");
          return last.replace(/\b\w/g, (c) => c.toUpperCase());
        };

        // attempt fast proxy fetch
        try {
          const proxy = `https://r.jina.ai/http://${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const r = await fetch(proxy, { signal: controller.signal, headers: { Accept: "text/html" } });
          clearTimeout(timeout);
          if (r.ok) {
            const html = await r.text();
            // extract title and meta description if present
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
            const title = titleMatch ? titleMatch[1].trim() : null;
            const desc = descMatch ? descMatch[1].trim() : null;
            let company = deriveCompany();
            let position = derivePosition();
            if (title) {
              // If title contains separators, try to split into position/company
              const sep = title.includes(" - ") ? " - " : title.includes(" | ") ? " | " : null;
              if (sep) {
                const [a, b] = title.split(sep).map((s) => s.trim());
                // pick which looks like company (contains domain words)
                if (b && b.toLowerCase().includes(domain)) {
                  company = a;
                  position = b;
                } else if (a && a.toLowerCase().includes(domain)) {
                  company = a;
                  position = b || position;
                } else {
                  // heuristics: longer segment -> position
                  if (a && b) {
                    position = a.length >= b.length ? a : b;
                    company = a.length >= b.length ? b : a;
                  } else {
                    position = a || position;
                  }
                }
              } else {
                // no separator — treat title as position if it's not the domain
                if (!title.toLowerCase().includes(domain)) position = title;
              }
            }

            return res.json({
              company: company || null,
              position: position || null,
              location: null,
              job_description: desc || title || null,
              requirements: [],
              skills: [],
              salary: null,
              employment_type: null,
              source: parsedUrl.origin,
              warning: "Heuristic preview — please verify and adjust any fields.",
            });
          }
        } catch (e) {
          // ignore and fall back to heuristics
          // eslint-disable-next-line no-console
          console.warn("preview: quick proxy fetch failed", e && (e.name || e.message));
        }

        // fallback heuristics
        return res.json({
          company: deriveCompany(),
          position: derivePosition(),
          location: null,
          job_description: null,
          requirements: [],
          skills: [],
          salary: null,
          employment_type: null,
          source: parsedUrl.origin,
          warning: "Heuristic preview — please verify and adjust any fields.",
        });
      }

      const html = await fetchJobPageHtml(parsedUrl.toString());
      const details = extractJobDetailsFromHtml(html, parsedUrl.toString());

      res.json({
        ...details,
        warning: !details.company && !details.position && !details.job_description
          ? "The job page blocked auto-fetching, but the link was saved. Please review and complete the remaining details manually."
          : undefined,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Job URL preview failed:", error);
      res.json({
        company: null,
        position: null,
        location: null,
        job_description: null,
        requirements: [],
        skills: [],
        salary: null,
        employment_type: null,
        source: "Job posting link",
        warning:
          "This job site blocks automated fetching, but the link was still saved. Please fill in the remaining details manually.",
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("applications/preview handler error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
