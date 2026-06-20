import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { activityMessage, emitActivity } from "@/lib/activity";
import type {
  PublishResponse,
  Report,
  ReportsResponse,
  StatusResponse
} from "@/lib/types";

const STATUS_KEY = ["status"] as const;
const REPORTS_KEY = ["reports"] as const;

export function useStatus() {
  return useQuery<StatusResponse>({
    queryKey: STATUS_KEY,
    queryFn: api.getStatus,
    // Connect/publish flows can change account + project state out of band.
    refetchInterval: 15_000
  });
}

export function useReports() {
  return useQuery<Report[]>({
    queryKey: REPORTS_KEY,
    queryFn: async () => (await api.getReports()).reports,
    refetchInterval: 15_000
  });
}

function invalidateReports(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: REPORTS_KEY });
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function useAddPath() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.addPath(path),
    onSuccess: (data) => {
      toast.success(`Added "${data.report.name}".`);
      emitActivity({
        status: "success",
        title: "Page added",
        message: data.report.name
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not add report.");
      toast.error(message);
      emitActivity({ status: "error", title: "Add page failed", message });
    }
  });
}

export function useAddFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addFolder,
    onSuccess: (data) => {
      toast.success(`Added "${data.report.name}".`);
      emitActivity({
        status: "success",
        title: "Folder added",
        message: data.report.name
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not add folder.");
      toast.error(message);
      emitActivity({ status: "error", title: "Add folder failed", message });
    }
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadFile(file),
    onSuccess: (data) => {
      toast.success(`Uploaded "${data.report.name}".`);
      emitActivity({
        status: "success",
        title: "File uploaded",
        message: data.report.name
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not upload file.");
      toast.error(message);
      emitActivity({ status: "error", title: "Upload failed", message });
    }
  });
}

export function useUploadFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => api.uploadFolder(files),
    onSuccess: (data) => {
      toast.success(`Uploaded "${data.report.name}".`);
      emitActivity({
        status: "success",
        title: "Folder uploaded",
        message: data.report.name
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not upload folder.");
      toast.error(message);
      emitActivity({ status: "error", title: "Folder upload failed", message });
    }
  });
}

export function useBuildReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.buildReport(id),
    onSuccess: (data) => {
      toast.success(`Built "${data.report.name}".`);
      emitActivity({
        status: "success",
        title: "Build complete",
        message: data.report.buildOutputDir || data.report.name
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Build failed.");
      toast.error(message);
      emitActivity({ status: "error", title: "Build failed", message });
    }
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReport(id),
    onSuccess: () => {
      toast.success("Report deleted.");
      emitActivity({ status: "success", title: "Page deleted" });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not delete report.");
      toast.error(message);
      emitActivity({ status: "error", title: "Delete failed", message });
    }
  });
}

export function usePublishSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.publishSnapshot(id),
    onSuccess: (data: PublishResponse) => {
      toast.success("Page published.", {
        description: data.publication.publicUrl ?? undefined
      });
      emitActivity({
        status: "success",
        title: "Page published",
        message: data.publication.publicUrl ?? data.publication.slug
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Publish failed.");
      toast.error(message);
      emitActivity({ status: "error", title: "Publish failed", message });
    }
  });
}

export function useRevokeAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.revokeAll(id),
    onSuccess: (data) => {
      toast.success(
        data.revokedCount === 1
          ? "Revoked 1 link."
          : `Revoked ${data.revokedCount} links.`
      );
      emitActivity({
        status: "success",
        title: "Links revoked",
        message:
          data.revokedCount === 1
            ? "1 link taken offline."
            : `${data.revokedCount} links taken offline.`
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not revoke links.");
      toast.error(message);
      emitActivity({ status: "error", title: "Revoke failed", message });
    }
  });
}

export function useAutoSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.setAutoSync(id, enabled),
    onSuccess: (data) => {
      toast.success(
        data.report.autoSync ? "Auto-sync on." : "Auto-sync off."
      );
      emitActivity({
        status: "success",
        title: data.report.autoSync ? "Auto-sync on" : "Auto-sync off",
        message: data.report.name
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not toggle auto-sync.");
      toast.error(message);
      emitActivity({ status: "error", title: "Auto-sync failed", message });
    }
  });
}

export function usePasswordProtection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      enabled,
      password
    }: {
      id: string;
      enabled: boolean;
      password?: string;
    }) => api.setPasswordProtection(id, enabled, password),
    onSuccess: (data) => {
      toast.success(
        data.report.passwordProtected
          ? "Password protection on."
          : "Password protection off."
      );
      emitActivity({
        status: "success",
        title: data.report.passwordProtected
          ? "Password protection on"
          : "Password protection off",
        message: data.report.name
      });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not update password protection.");
      toast.error(message);
      emitActivity({
        status: "error",
        title: "Password protection failed",
        message
      });
    }
  });
}

export function useSyncPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.syncPublication(token),
    onSuccess: () => {
      toast.success("Published link synced.");
      emitActivity({ status: "success", title: "Published link synced" });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Sync failed.");
      toast.error(message);
      emitActivity({ status: "error", title: "Sync failed", message });
    }
  });
}

export function useRevokePublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.revokePublication(token),
    onSuccess: () => {
      toast.success("Link revoked.");
      emitActivity({ status: "success", title: "Link taken offline" });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not revoke link.");
      toast.error(message);
      emitActivity({ status: "error", title: "Revoke failed", message });
    }
  });
}

// Per-link expiry change. Returns the publish response shape (report +
// publication), so reports must be refreshed. Surfaces the server's 400
// (invalid duration) message verbatim.
export function useSetExpiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, expires }: { token: string; expires: string }) =>
      api.setExpiry(token, expires),
    onSuccess: () => {
      toast.success("Link expiry updated.");
      emitActivity({ status: "success", title: "Link expiry updated" });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not update link expiry.");
      toast.error(message);
      emitActivity({ status: "error", title: "Link expiry failed", message });
    }
  });
}

// App-level default link lifetime. The new default lives on the config in the
// status query, so that's what must be refreshed.
export function useSetDefaultExpiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: string) => api.setDefaultExpiry(value),
    onSuccess: () => {
      toast.success("Default expiry updated.");
      emitActivity({ status: "success", title: "Default expiry updated" });
      void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not update default expiry.");
      toast.error(message);
      emitActivity({ status: "error", title: "Default expiry failed", message });
    }
  });
}

export function useSaveContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, html }: { id: string; html: string }) =>
      api.saveContent(id, html),
    onSuccess: () => {
      toast.success("Saved. Live snapshots updated.");
      emitActivity({ status: "success", title: "Saved and republished" });
      invalidateReports(queryClient);
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not save edits.");
      toast.error(message);
      emitActivity({ status: "error", title: "Save failed", message });
    }
  });
}

// Optimistic reorder: reflect the new order immediately, roll back on error.
export function useReorder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.reorder(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: REPORTS_KEY });
      const previous = queryClient.getQueryData<Report[]>(REPORTS_KEY);
      if (previous) {
        const byId = new Map(previous.map((report) => [report.id, report]));
        const next = ids
          .map((id) => byId.get(id))
          .filter((report): report is Report => Boolean(report));
        queryClient.setQueryData<Report[]>(REPORTS_KEY, next);
      }
      return { previous };
    },
    onError: (error, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(REPORTS_KEY, context.previous);
      }
      const message = errorMessage(error, "Could not save order.");
      toast.error(message);
      emitActivity({ status: "error", title: "Reorder failed", message });
    },
    onSettled: () => invalidateReports(queryClient)
  });
}

// Optimistic slug rename: patch the matching publication in place. Surfaces the
// server's 400 (invalid) / 409 (taken) messages on failure.
export function useRenameSlug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, slug }: { token: string; slug: string }) =>
      api.renameSlug(token, slug),
    onMutate: async ({ token, slug }: { token: string; slug: string }) => {
      await queryClient.cancelQueries({ queryKey: REPORTS_KEY });
      const previous = queryClient.getQueryData<Report[]>(REPORTS_KEY);
      if (previous) {
        const next = previous.map((report) => ({
          ...report,
          publications: report.publications.map((publication) =>
            publication.token === token
              ? { ...publication, slug }
              : publication
          )
        }));
        queryClient.setQueryData<Report[]>(REPORTS_KEY, next);
      }
      return { previous };
    },
    onSuccess: () => {
      toast.success("Custom URL updated.");
      emitActivity({ status: "success", title: "Custom URL updated" });
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(REPORTS_KEY, context.previous);
      }
      // 400 invalid, 409 taken — surface the precise server message.
      const message = activityMessage(error, "Could not update custom URL.");
      toast.error(message);
      emitActivity({ status: "error", title: "Custom URL failed", message });
    },
    onSettled: () => invalidateReports(queryClient)
  });
}

export function useFeedbackSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId?: string) => api.feedbackSetup(accountId),
    onSuccess: (data) => {
      toast.success("Reactions & analytics enabled.");
      emitActivity({
        status: "success",
        title: "Feedback enabled",
        message: data.feedback?.url ?? undefined
      });
      void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (error) => {
      const message = errorMessage(error, "Could not set up feedback.");
      toast.error(message);
      emitActivity({ status: "error", title: "Feedback setup failed", message });
    }
  });
}

export function useFeedbackStats(slug: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["feedback-stats", slug],
    queryFn: () => api.feedbackStats(slug as string),
    enabled: Boolean(slug) && enabled,
    refetchInterval: 30_000
  });
}

export type ReportsResult = ReportsResponse;
