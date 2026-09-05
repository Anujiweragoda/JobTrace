import serverless from "serverless-http";
import { disconnectPrisma } from "../src/prismaClient";

let cachedHandler: any = null;

export default async function handler(req: any, res: any) {
	try {
		// eslint-disable-next-line no-console
		console.log("serverless handler invoked:", req?.method, req?.url);
	} catch {}

	// Short-circuit common read-only endpoints that must not touch the DB
	// so the function stays fast when the DB is unavailable. This is a
	// temporary safety shim for production to avoid FUNCTION_INVOCATION_TIMEOUT
	// while the underlying DB/connectivity is fixed.
	try {
		const url = req?.url || "";
		const method = (req?.method || "GET").toUpperCase();
		if (method === "OPTIONS") {
			res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
			res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
			res.setHeader("Access-Control-Allow-Credentials", "true");
			return res.status(204).end();
		}

		// Fast fallback for GET /api/applications and GET /api/cv-versions to return
		// empty lists without importing the app or touching the DB. This ensures
		// the frontend's initial `loadAll()` (which waits for both endpoints)
		// completes quickly when the DB is unavailable so tabs and routing work.
		if (method === "GET" && typeof url === "string") {
			if (url.startsWith("/api/applications") || url.startsWith("/api/cv-versions")) {
				res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
				res.setHeader("Access-Control-Allow-Credentials", "true");
				return res.status(200).json([]);
			}
		}

		// For production/demo: short-circuit POST /api/applications/preview to avoid
		// lazy-importing the app and any DB/network calls that may cause 504s.
		if (method === "POST" && typeof url === "string" && url.startsWith("/api/applications/preview")) {
			// eslint-disable-next-line no-console
			console.warn("serverless handler: short-circuiting POST /api/applications/preview in entry shim");
			res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
			res.setHeader("Access-Control-Allow-Credentials", "true");
			return res.status(200).json({
				company: null,
				position: null,
				location: null,
				job_description: null,
				requirements: [],
				skills: [],
				salary: null,
				employment_type: null,
				source: "Job posting link",
				warning: "Preview is disabled in this deployment to avoid timeouts. Please fill in details manually.",
			});
		}
	} catch (e) {
		// ignore and fall through to normal handler
	}

	if (!cachedHandler) {
		try {
			// eslint-disable-next-line no-console
			console.log("serverless handler: lazy-importing app");
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const mod = await import("../src/index");
			const app = mod.default;
			// eslint-disable-next-line no-console
			console.log("serverless handler: app imported, wrapping with serverless-http");
			cachedHandler = serverless(app as any);
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error("serverless handler: failed to import app:", e);
			throw e;
		}
	}

	try {
		// eslint-disable-next-line no-console
		console.log("serverless handler: invoking cached handler");
	} catch {}

	try {
		// Instrument response to detect when the handler finishes.
		// Hook response methods and finish event to detect when response completes.
		try {
			if (res) {
				res.once && res.once("finish", () => {
					try {
						// eslint-disable-next-line no-console
						console.log("serverless handler: response finished, statusCode:", res.statusCode);
					} catch {}
				});

				const origEnd = res.end;
				if (typeof origEnd === "function") {
					res.end = function (...args: any[]) {
						try {
							// eslint-disable-next-line no-console
							console.log("serverless handler: res.end called");
						} catch {}
						// @ts-ignore
						return origEnd.apply(this, args);
					};
				}
			}
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error("serverless handler: response hook setup failed:", e);
		}

		try {
			// eslint-disable-next-line no-console
			console.log("serverless handler: req.headers:", req && req.headers ? JSON.stringify(req.headers) : "(no headers)");
		} catch {}

		const longWarn = setTimeout(() => {
			// eslint-disable-next-line no-console
			console.warn("serverless handler: still running after 15s for", req?.method, req?.url);
		}, 15000);

		const maybePromise = cachedHandler(req, res);
		if (maybePromise && typeof maybePromise.then === "function") {
			try {
				await maybePromise;
			} finally {
				clearTimeout(longWarn);
			}
		} else {
			clearTimeout(longWarn);
		}

		try {
			// eslint-disable-next-line no-console
			console.log("serverless handler: cached handler finished invocation");
		} catch {}

		try {
			// Attempt to disconnect Prisma to avoid leaving open sockets in serverless.
			await disconnectPrisma().catch(() => {});
			// eslint-disable-next-line no-console
			console.log("serverless handler: prisma disconnect attempted");
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error("serverless handler: prisma disconnect failed:", e);
		}

		return;
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("serverless handler: cached handler threw:", e);
		throw e;
	}
}
