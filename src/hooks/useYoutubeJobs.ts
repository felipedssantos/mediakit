import { useEffect } from "react";
import { create } from "zustand";

import {
  addYoutubeDownload,
  cancelYoutubeDownload,
  getYoutubeDownloads,
  onYoutubeJobsChanged,
  retryYoutubeDownload,
} from "../lib/youtube";
import type {
  YoutubeDownloadJob,
  YoutubeDownloadOptions,
} from "../types/youtube";

interface YoutubeJobsState {
  jobs: YoutubeDownloadJob[];
  error: string | null;
  hydrate: () => Promise<void>;
  enqueue: (params: {
    url: string;
    title: string;
    outputDir: string;
    options: YoutubeDownloadOptions;
  }) => Promise<void>;
  enqueueMany: (
    items: Array<{
      url: string;
      title: string;
      outputDir: string;
      options: YoutubeDownloadOptions;
    }>,
  ) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
}

export const useYoutubeJobs = create<YoutubeJobsState>((set, get) => ({
  jobs: [],
  error: null,
  hydrate: async () => {
    try {
      const jobs = await getYoutubeDownloads();
      set({ jobs, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  enqueue: async (params) => {
    set({ error: null });
    try {
      await addYoutubeDownload(params);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  enqueueMany: async (items) => {
    if (items.length === 0) return;
    set({ error: null });
    for (const item of items) {
      try {
        await addYoutubeDownload(item);
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    }
  },
  cancel: async (id) => {
    await cancelYoutubeDownload(id);
    set({
      jobs: get().jobs.map((job) =>
        job.id === id && job.status === "queued"
          ? { ...job, status: "cancelled" as const }
          : job,
      ),
    });
  },
  retry: async (id) => {
    await retryYoutubeDownload(id);
  },
}));

export function useYoutubeJobEvents(): void {
  const hydrate = useYoutubeJobs((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
    let unlisten: (() => void) | undefined;
    void onYoutubeJobsChanged((jobs) => {
      useYoutubeJobs.setState({ jobs });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [hydrate]);
}
