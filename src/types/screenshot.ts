export interface ScreenshotWindowInfo {
  id: number;
  title: string;
  app_name: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface RegionSession {
  session_id: number;
  overlay_label: string;
  path: string;
  width: number;
  height: number;
  monitor_x: number;
  monitor_y: number;
  windows: ScreenshotWindowInfo[];
}

export interface ScreenshotHistoryItem {
  id: string;
  path: string;
  width: number;
  height: number;
  created_at: number;
  action: string;
}

export type SnipMode = "fullscreen" | "window" | "region";
