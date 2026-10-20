import type { MissionControlNodeConfig } from "@/lib/mission-control/wiring";

type NodeWidgetProps = { node: MissionControlNodeConfig };
type NodeWidgetRenderer = (props: NodeWidgetProps) => React.ReactNode;

const NODE_WIDGETS: Partial<Record<MissionControlNodeConfig["type"], NodeWidgetRenderer>> = {
  database: ({ node }) => (
    <section className="mc-node-detail__extension" aria-labelledby="mc-db-extension-title">
      <p className="mc-node-detail__eyebrow">Database</p>
      <h3 id="mc-db-extension-title">Operational context</h3>
      <dl>
        <div><dt>Engine</dt><dd>{node.engine || "Owner TODO"}</dd></div>
        <div><dt>Used by</dt><dd>{node.usedBy?.join(", ") || "Owner TODO"}</dd></div>
      </dl>
    </section>
  ),
};

export function MissionControlNodeWidget({ node }: NodeWidgetProps) {
  const Widget = NODE_WIDGETS[node.type];
  return Widget ? <>{Widget({ node })}</> : null;
}
