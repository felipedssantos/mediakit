import { useEffect } from "react";
import { create, type StateCreator, type StoreApi, type UseBoundStore } from "zustand";

import type { JobStatus } from "../types/job";

export interface QueueJobBase {
  id: string;
  status: JobStatus;
}

export interface BaseQueueSlice<J extends QueueJobBase> {
  jobs: J[];
  error: string | null;
  cancel: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
}

export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Creates a Zustand store with shared job list, cancel, and retry behavior. */
export function createJobQueueStore<
  J extends QueueJobBase,
  Extra extends object,
>(
  cancelFn: (id: string) => Promise<unknown>,
  retryFn: (id: string) => Promise<unknown>,
  extend: StateCreator<BaseQueueSlice<J> & Extra, [], [], Extra>,
): UseBoundStore<StoreApi<BaseQueueSlice<J> & Extra>> {
  return create<BaseQueueSlice<J> & Extra>((set, get, api) => ({
    jobs: [],
    error: null,
    cancel: async (id) => {
      await cancelFn(id);
      set((state) => ({
        ...state,
        jobs: state.jobs.map((job) =>
          job.id === id && job.status === "queued"
            ? { ...job, status: "cancelled" as const }
            : job,
        ),
      }));
    },
    retry: async (id) => {
      await retryFn(id);
    },
    ...extend(set, get, api),
  }));
}

/** Hydrates a queue store on mount and subscribes to live backend updates. */
export function useQueueEvents<J>(
  hydrate: () => Promise<void>,
  subscribe: (handler: (jobs: J[]) => void) => Promise<() => void>,
  onJobs: (jobs: J[]) => void,
): void {
  useEffect(() => {
    void hydrate();
    let unlisten: (() => void) | undefined;
    void subscribe(onJobs).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [hydrate, onJobs, subscribe]);
}
