import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient | null = null;

function initPrisma() {
	if (!_prisma) {
		// eslint-disable-next-line no-console
		console.log("Prisma lazy init: creating client");
		_prisma = new PrismaClient();
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
