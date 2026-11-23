import {
  addYoutubeDownload,
  cancelYoutubeDownload,
  getYoutubeDownloads,
  onYoutubeJobsChanged,
  retryYoutubeDownload,
} from "../lib/api/youtube";
import type {
  YoutubeDownloadJob,
  YoutubeDownloadOptions,
} from "../types/youtube";
import {
  createJobQueueStore,
  formatErrorMessage,
  useQueueEvents,
} from "./createJobQueueStore";

interface EnqueueYoutubeItem {
  url: string;
  title: string;
  outputDir: string;
  options: YoutubeDownloadOptions;
}

interface YoutubeJobsExtra {
  hydrate: () => Promise<void>;
  enqueue: (params: EnqueueYoutubeItem) => Promise<void>;
  enqueueMany: (items: EnqueueYoutubeItem[]) => Promise<void>;
}

export const useYoutubeJobs = createJobQueueStore<
  YoutubeDownloadJob,
  YoutubeJobsExtra
>(cancelYoutubeDownload, retryYoutubeDownload, (set) => ({
  hydrate: async () => {
    try {
      const jobs = await getYoutubeDownloads();
      set({ jobs, error: null });
    } catch (error) {
      set({ error: formatErrorMessage(error) });
    }
  },
  enqueue: async (params) => {
    set({ error: null });
    try {
      await addYoutubeDownload(params);
    } catch (error) {
      set({ error: formatErrorMessage(error) });
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
        set({ error: formatErrorMessage(error) });
        throw error;
      }
    }
  },
}));

function handleYoutubeJobsChanged(jobs: YoutubeDownloadJob[]) {
  useYoutubeJobs.setState({ jobs });
}

export function useYoutubeJobEvents(): void {
  const hydrate = useYoutubeJobs((state) => state.hydrate);
  useQueueEvents(hydrate, onYoutubeJobsChanged, handleYoutubeJobsChanged);
}
