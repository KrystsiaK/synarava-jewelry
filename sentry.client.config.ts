import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only report from real deployments; dev/sandbox runs must not pollute the project.
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,

  // ponytail: sample rate 0.1 in prod; raise to 1 only for debugging a specific issue
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // PII reduction per user choice during setup
  dataCollection: {
    userInfo: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    httpBodies: [],
    httpHeaders: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    cookies: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
