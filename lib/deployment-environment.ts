export type DeploymentEnvironmentSource = {
  NODE_ENV?: string;
  RAILWAY_ENVIRONMENT_NAME?: string;
};

/**
 * Railway runs every deployed environment as a production Node build, so
 * NODE_ENV cannot distinguish the public shop from staging. Railway provides
 * the environment name to both builds and deployments; outside Railway we
 * preserve the conventional NODE_ENV behavior.
 */
export function isProductionDeployment(
  source: DeploymentEnvironmentSource = process.env,
): boolean {
  const railwayEnvironment = source.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
  if (railwayEnvironment) return railwayEnvironment === "production";
  return source.NODE_ENV === "production";
}

export function allowNonProductionAnalytics(
  source: DeploymentEnvironmentSource & { ENABLE_NON_PRODUCTION_ANALYTICS?: string } = process.env,
): boolean {
  return isProductionDeployment(source) || source.ENABLE_NON_PRODUCTION_ANALYTICS === "true";
}
