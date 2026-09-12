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
});
