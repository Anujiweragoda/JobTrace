import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient | null = null;

function initPrisma() {
	if (!_prisma) {
		// eslint-disable-next-line no-console
		console.log("Prisma lazy init: creating client");
		_prisma = new PrismaClient();

		// Try to connect in the background and log results so we can detect connection problems early.
		try {
			_prisma.$connect()
				.then(() => {
					// eslint-disable-next-line no-console
					console.log("Prisma lazy init: connected to database");
				})
				.catch((e) => {
					// eslint-disable-next-line no-console
					console.error("Prisma lazy init: $connect() failed:", e);
				});

			// If connection hasn't resolved after 15s, warn in logs.
			setTimeout(() => {
				// eslint-disable-next-line no-console
				console.warn("Prisma lazy init: connection still pending after 15s");
			}, 15000);
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error("Prisma lazy init: connect attempt threw:", e);
		}
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
