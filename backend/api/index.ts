import serverless from "serverless-http";

let cachedHandler: any = null;

export default async function handler(req: any, res: any) {
	try {
		// eslint-disable-next-line no-console
		console.log("serverless handler invoked:", req?.method, req?.url);
	} catch {}

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
		const originalEnd = res && res.end;
		let finished = false;
		if (originalEnd) {
			res.end = function (...args: any[]) {
				if (!finished) {
					finished = true;
					try {
						// eslint-disable-next-line no-console
						console.log("serverless handler: response end called, statusCode:", res.statusCode);
					} catch {}
				}
				// @ts-ignore
				return originalEnd.apply(this, args);
			};
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

		return;
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("serverless handler: cached handler threw:", e);
		throw e;
	}
}
