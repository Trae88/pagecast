import { Check, Loader2, MessageCircleHeart } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFeedbackSetup } from "@/hooks/use-pagecast";
import type { FeedbackConfig } from "@/lib/types";

interface FeedbackCardProps {
  connected: boolean;
  feedback: FeedbackConfig | null;
}

export function FeedbackCard({ connected, feedback }: FeedbackCardProps) {
  const setup = useFeedbackSetup();
  const enabled = Boolean(feedback?.url);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircleHeart className="h-4 w-4" />
            Reactions &amp; analytics
          </CardTitle>
          <CardDescription>
            Let viewers react, and see views by country, referrer, and device —
            on your own free Cloudflare account, cookieless.
          </CardDescription>
        </div>
        {enabled ? (
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" />
            Enabled
          </Badge>
        ) : (
          <Badge variant="outline">Off</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {enabled ? (
          <p className="text-sm text-muted-foreground">
            A reactions bar and view tracking now attach to every page you
            publish. Stats appear on each page in the workspace.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {connected
                ? "One-time setup deploys a tiny Worker + KV store to your Cloudflare account. New publishes include the widget automatically."
                : "Connect Cloudflare first — feedback is deployed to your own account."}
            </p>
            <Button
              className="w-full"
              disabled={!connected || setup.isPending}
              onClick={() => setup.mutate(undefined)}
            >
              {setup.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deploying feedback Worker…
                </>
              ) : (
                "Enable reactions & analytics"
              )}
            </Button>
            {setup.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Setup didn't complete. Make sure a workers.dev subdomain is
                enabled in your Cloudflare dashboard, then try again.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
