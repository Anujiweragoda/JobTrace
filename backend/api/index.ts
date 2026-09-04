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

	return cachedHandler(req, res);
}
