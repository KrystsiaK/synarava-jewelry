/** Browser stub — Storybook must not load the real Prisma client. */
const handler: ProxyHandler<object> = {
  get(_target, prop) {
    if (prop === "then") return undefined;
    return (..._args: unknown[]) => Promise.resolve(null);
  },
};

export const PrismaClient = class PrismaClient {
  constructor() {
    return new Proxy({}, handler) as this;
  }
};

export const Prisma = new Proxy(
  {},
  {
    get: () => "STORYBOOK_PRISMA_ENUM",
  },
);

export default { PrismaClient, Prisma };
