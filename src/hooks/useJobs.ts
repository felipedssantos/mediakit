import { useEffect } from "react";
import { create } from "zustand";

import {
  addJobs,
  cancelJob,
  detectHw,
  getJobs,
  getMaxConcurrency,
  onJobsChanged,
  retryJob,
  setMaxConcurrency,
} from "../lib/tauri";
import type { AddJobRequest, Job } from "../types/job";

interface JobsState {
  jobs: Job[];
  loading: boolean;
  nvenc: boolean;
  maxConcurrency: number;
  error: string | null;
  hydrate: () => Promise<void>;
  enqueue: (items: AddJobRequest[]) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
  setConcurrency: (value: number) => Promise<void>;
}

export const useJobs = create<JobsState>((set, get) => ({
  jobs: [],
  loading: true,
  nvenc: false,
  maxConcurrency: 1,
  error: null,
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
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  enqueue: async (items) => {
    set({ error: null });
    try {
      await addJobs(items);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
  cancel: async (id) => {
    await cancelJob(id);
    const jobs = get().jobs.map((job) =>
      job.id === id && job.status === "queued"
        ? { ...job, status: "cancelled" as const }
        : job,
    );
    set({ jobs });
  },
  retry: async (id) => {
    await retryJob(id);
  },
  setConcurrency: async (value) => {
    const next = await setMaxConcurrency(value);
    set({ maxConcurrency: next });
  },
}));

export function useJobEvents(): void {
  const hydrate = useJobs((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
    let unlisten: (() => void) | undefined;
    void onJobsChanged((jobs) => {
      useJobs.setState({ jobs, loading: false });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [hydrate]);
}
