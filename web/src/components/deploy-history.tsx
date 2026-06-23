import { useState } from "react";
import {
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Trash2
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  useDeleteDeployment,
  useDeployments,
  usePruneDeployments
} from "@/hooks/use-pagecast";
import { relativeTime } from "@/lib/format";
import type { Deployment } from "@/lib/types";

interface DeployHistoryProps {
  connected: boolean;
}

export function DeployHistory({ connected }: DeployHistoryProps) {
  const deployments = useDeployments(connected);
  const remove = useDeleteDeployment();
  const prune = usePruneDeployments();

  const [pendingDelete, setPendingDelete] = useState<Deployment | null>(null);
  const [pruneOpen, setPruneOpen] = useState(false);
  const [keep, setKeep] = useState(5);

  const rows = deployments.data?.deployments ?? [];
  const deletable = rows.filter((deployment) => !deployment.isLive);
  // The server keeps the N newest (incl. live); estimate how many this prune
  // would remove so the confirmation can name a concrete count.
  const pruneCount = rows
    .slice(Math.max(0, keep))
    .filter((deployment) => !deployment.isLive).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Deploy history
          </CardTitle>
          <CardDescription>
            Every publish creates a snapshot — a full copy of your whole site at
            that moment, not a single page. Remove old ones to tidy up.
          </CardDescription>
        </div>
        {connected ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={deployments.isFetching}
            onClick={() => deployments.refetch()}
            aria-label="Refresh deploy history"
          >
            <RefreshCw
              className={`h-4 w-4 ${deployments.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {!connected ? (
          <p className="text-sm text-muted-foreground">
            Connect Cloudflare to see your deploy history.
          </p>
        ) : deployments.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading deployments…
          </div>
        ) : deployments.isError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Couldn't load deploy history. {(deployments.error as Error)?.message}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deployments yet.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Showing recent deployments, newest first.
            </p>
            <div className="space-y-1.5">
              {rows.map((deployment) => (
                <DeployRow
                  key={deployment.id}
                  deployment={deployment}
                  onDelete={() => setPendingDelete(deployment)}
                  // Drive the in-flight spinner from the mutation's own
                  // variables: pendingDelete is cleared as soon as the dialog
                  // closes, so it can't track the deployment being deleted.
                  deleting={remove.isPending && remove.variables?.id === deployment.id}
                />
              ))}
            </div>
            {deletable.length > 0 ? (
              <div className="flex items-center gap-2 border-t pt-3">
                <span className="text-xs text-muted-foreground">Keep newest</span>
                <Input
                  type="number"
                  min={1}
                  value={keep}
                  onChange={(event) =>
                    setKeep(Math.max(1, Number(event.target.value) || 1))
                  }
                  className="h-8 w-16"
                  aria-label="Number of recent deployments to keep"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={prune.isPending || pruneCount === 0}
                  onClick={() => setPruneOpen(true)}
                >
                  {prune.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Clean up old snapshots"
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This deployment{" "}
              {pendingDelete
                ? `from ${
                    relativeTime(pendingDelete.createdOn) ||
                    pendingDelete.status ||
                    "an earlier publish"
                  } `
                : ""}
              ({pendingDelete?.shortId}) will be permanently removed, and its
              .pages.dev address will stop working. It's a full copy of your
              whole site at that time — your current live site and your pages in
              Pagecast are not affected. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete) {
                  remove.mutate({
                    id: pendingDelete.id,
                    force: pendingDelete.environment !== "production"
                  });
                  setPendingDelete(null);
                }
              }}
            >
              Delete snapshot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pruneOpen} onOpenChange={setPruneOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clean up old snapshots?</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps your {keep} most recent snapshot(s) — including the live
              one — and permanently deletes the rest ({pruneCount} snapshot(s)).
              Their .pages.dev addresses will stop working. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                prune.mutate(keep);
                setPruneOpen(false);
              }}
            >
              Delete {pruneCount} snapshot(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function DeployRow({
  deployment,
  onDelete,
  deleting
}: {
  deployment: Deployment;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
      {deployment.isLive ? (
        <Badge variant="default" className="shrink-0">
          Live
        </Badge>
      ) : (
        <Badge variant="outline" className="shrink-0 text-muted-foreground">
          Snapshot
        </Badge>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{deployment.shortId}</span>
          {deployment.environment ? (
            <span className="text-xs capitalize text-muted-foreground">
              {deployment.environment}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {relativeTime(deployment.createdOn) || deployment.status}
        </span>
      </div>
      {deployment.url ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => window.open(deployment.url, "_blank", "noopener")}
          aria-label="Open snapshot URL"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        disabled={deployment.isLive || deleting}
        title={
          deployment.isLive
            ? "The live deployment can't be deleted."
            : "Delete snapshot"
        }
        onClick={onDelete}
        aria-label="Delete snapshot"
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
