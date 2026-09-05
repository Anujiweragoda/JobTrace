import { PrismaClient } from "@prisma/client";
import config from "../prisma/prisma.config";

let _prisma: PrismaClient | null = null;

function initPrisma() {
	if (!_prisma) {
		// eslint-disable-next-line no-console
		console.log("Prisma lazy init: creating client");
		const options: any = {};
		if (config && config.adapter) {
			options.adapter = config.adapter;
		}
		_prisma = new PrismaClient(options);

		// Note: Do NOT call $connect() here in serverless environments —
		// opening persistent DB connections can keep the process alive and
		// cause function timeouts. Let Prisma connect lazily on first query.
		// eslint-disable-next-line no-console
		console.log("Prisma lazy init: client created");
	}
	return _prisma;
}

const handler: ProxyHandler<any> = {
	get(_, prop) {
		const client = initPrisma();
		// @ts-ignore
		return (client as any)[prop];
	},
	apply(_, thisArg, args) {
		const client = initPrisma();
		// @ts-ignore
		return (client as any).apply(thisArg, args);
	},
};

// Export a proxy that lazily initializes Prisma on first property access.
const proxy = new Proxy(function () {}, handler) as unknown as PrismaClient;

export default proxy;

export async function disconnectPrisma() {
	if (_prisma) {
		try {
			// eslint-disable-next-line no-console
			console.log("Prisma: disconnecting client");
			await _prisma.$disconnect();
			// eslint-disable-next-line no-console
			console.log("Prisma: disconnected");
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error("Prisma: $disconnect() failed:", e);
		}
		_prisma = null;
	}
}
