import { CollapsibleCard } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/display";
import { CreateWebhookDialog } from "./CreateWebhookDialog";
import { EndpointItem } from "./EndpointItem";
import type { EndpointRow } from "./types";

export function WebhooksPanel({ slug, endpoints, max }: { slug: string; endpoints: EndpointRow[]; max: number }) {
  return (
    <CollapsibleCard id="webhooks" title="Webhooks" count={endpoints.length} description="Signed events for loans, stock, transfers, repairs, payments and the finance ledger. Payloads carry ids, numbers and quantities, never emails or remarks." action={<CreateWebhookDialog slug={slug} disabled={endpoints.length >= max} />}>
      {endpoints.length === 0 ? (
        <EmptyState title="No webhooks yet.">Add one to send events to another app.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-5">
          {endpoints.map((endpoint) => <EndpointItem key={endpoint.id} slug={slug} endpoint={endpoint} />)}
        </ul>
      )}
    </CollapsibleCard>
  );
}
