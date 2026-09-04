import serverless from "serverless-http";

let cachedHandler: any = null;

export default async function handler(req: any, res: any) {
	if (!cachedHandler) {
		// Dynamically import the app to avoid heavy work at module load time in the serverless runtime
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const mod = await import("../src/index");
		const app = mod.default;
		cachedHandler = serverless(app as any);
	}

	return cachedHandler(req, res);
}
