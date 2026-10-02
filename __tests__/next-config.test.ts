describe("Next.js deployment identity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the Railway commit SHA that produced the build", async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "commit-sha-123");
    vi.stubEnv("RAILWAY_DEPLOYMENT_ID", "deployment-456");

    const { default: config } = await import("@/next.config");

    expect(config.deploymentId).toBe("commit-sha-123");
  });

  it("falls back to the Railway deployment ID outside a Git-triggered build", async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "");
    vi.stubEnv("RAILWAY_DEPLOYMENT_ID", "deployment-456");

    const { default: config } = await import("@/next.config");

    expect(config.deploymentId).toBe("deployment-456");
  });

  it("keeps proxy body buffering aligned with Server Action uploads", async () => {
    const { default: config } = await import("@/next.config");

    expect(config.experimental?.proxyClientMaxBodySize).toBe("12mb");
    expect(config.experimental?.serverActions?.bodySizeLimit).toBe("12mb");
  });

  it("adds an X-Robots-Tag guard to Railway staging", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "staging");
    const { default: config } = await import("@/next.config");

    const rules = await config.headers?.();
    expect(rules?.[0]?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive",
    });
  });

  it("does not send a noindex header from Railway production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
    const { default: config } = await import("@/next.config");

    const rules = await config.headers?.();
    expect(rules?.[0]?.headers).not.toContainEqual(expect.objectContaining({
      key: "X-Robots-Tag",
    }));
  });
});
