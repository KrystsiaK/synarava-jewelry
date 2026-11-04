import type { AnalyticsSnapshotPayload } from "@/lib/mission-control/analytics/types";

/**
 * One markdown block for paste into Claude/bot.
 * No secrets, tokens, emails, or other PII.
 */
export function formatAnalyticsMarkdownReport(
  payload: AnalyticsSnapshotPayload,
): string {
  const lines: string[] = [
    "# Mission Control — Analytics report",
    "",
    `- Date (UTC): ${payload.checkedAt}`,
    `- Status: ${payload.connection === "not_connected" ? "not connected" : payload.level}`,
    `- Message: ${payload.message}`,
    "",
    "## Data limits & caveats",
    "",
    `- ${payload.gaConsentNote}`,
    `- ${payload.clarityBotNote}`,
    `- Clarity API calls used today: ${payload.limits.clarityCallsUsedToday} / budget ${payload.limits.clarityBudgetPerDay} (hard limit ${payload.limits.clarityHardLimitPerDay}/project/day)`,
    `- GA lookback: ${payload.limits.gaLookbackDays} days`,
    `- Clarity window: ${payload.limits.clarityNumOfDays} days`,
    `- Sources: GA=${payload.sources.ga}, Clarity=${payload.sources.clarity}`,
  ];

  if (payload.clarityDataAsOf) {
    lines.push(`- Clarity data as of ${payload.clarityDataAsOf}`);
  }

  lines.push("", "## Figures", "");

  if (payload.figures.length === 0) {
    lines.push("_No figures in this snapshot._", "");
  } else {
    for (const figure of payload.figures) {
      lines.push(
        `- ${figure.label}: **${figure.value}** · period: ${figure.period} · source: ${figure.source}`,
      );
    }
    lines.push("");
  }

  if (payload.notices.length > 0) {
    lines.push("## Notices (informational)", "");
    for (const notice of payload.notices) {
      lines.push(`- [${notice.tone}] ${notice.title}`);
      lines.push(`  ${notice.detail}`);
    }
    lines.push("");
  }

  lines.push("## Issues", "");

  if (payload.issues.length === 0) {
    lines.push(
      payload.connection === "not_connected"
        ? "_Not connected — set collector env (CLARITY_API_TOKEN, GA_PROPERTY_ID, GA_SERVICE_ACCOUNT_JSON)._"
        : "_No issues above threshold._",
      "",
    );
  } else {
    for (const issue of payload.issues) {
      lines.push(`### [${issue.severity}] ${issue.title}`);
      lines.push(`- Kind: ${issue.kind}`);
      lines.push(`- Since: ${issue.since}`);
      lines.push(`- Period/source: ${issue.period} (${issue.source})`);
      const numberParts = Object.entries(issue.numbers).map(
        ([key, value]) => `${key}=${value}`,
      );
      lines.push(`- Numbers: ${numberParts.join(", ")}`);
      lines.push(`- Where to look: ${issue.whereToLook}`);
      lines.push(`- How to fix: ${issue.fixHint}`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
