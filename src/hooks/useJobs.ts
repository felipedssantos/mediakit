import {
  addJobs,
  cancelJob,
  detectHw,
  getJobs,
  getMaxConcurrency,
  onJobsChanged,
  retryJob,
  setMaxConcurrency,
} from "../lib/api/jobs";
import type { AddJobRequest, Job } from "../types/job";
import {
  createJobQueueStore,
  formatErrorMessage,
  useQueueEvents,
} from "./createJobQueueStore";

interface JobsExtra {
  loading: boolean;
  nvenc: boolean;
  maxConcurrency: number;
  hydrate: () => Promise<void>;
  enqueue: (items: AddJobRequest[]) => Promise<void>;
  setConcurrency: (value: number) => Promise<void>;
}

export const useJobs = createJobQueueStore<Job, JobsExtra>(
  cancelJob,
  retryJob,
  (set) => ({
    loading: true,
    nvenc: false,
    maxConcurrency: 1,
    hydrate: async () => {
      try {
        const [jobs, concurrency, hw] = await Promise.all([
          getJobs(),
          getMaxConcurrency(),
          detectHw(),
        ]);
        set({
          jobs,
          maxConcurrency: concurrency,
          nvenc: hw.nvenc,
          loading: false,
          error: null,
        });
      } catch (error) {
        set({
          loading: false,
          error: formatErrorMessage(error),
        });
      }
    },
    enqueue: async (items) => {
      set({ error: null });
      try {
        await addJobs(items);
      } catch (error) {
        set({ error: formatErrorMessage(error) });
        throw error;
      }
    },
    setConcurrency: async (value) => {
      const next = await setMaxConcurrency(value);
      set({ maxConcurrency: next });
    },
  }),
);

function handleJobsChanged(jobs: Job[]) {
  useJobs.setState({ jobs, loading: false });
}

export function useJobEvents(): void {
  const hydrate = useJobs((state) => state.hydrate);
  useQueueEvents(hydrate, onJobsChanged, handleJobsChanged);
}
