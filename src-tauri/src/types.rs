use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Finalizing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamInfo {
    pub codec_type: String,
    pub codec_name: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub bit_rate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaInfo {
    pub path: String,
    pub duration: f64,
    pub size: u64,
    pub format_name: String,
    pub bit_rate: Option<u64>,
    pub video: Option<StreamInfo>,
    pub audio: Option<StreamInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncodeOptions {
    pub preset_id: String,
    pub crf: Option<u32>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub audio_bitrate: Option<String>,
    pub resolution: Option<String>,
    pub use_gpu: Option<bool>,
    #[serde(default)]
    pub quality: Option<u32>,
    #[serde(default)]
    pub image_format: Option<String>,
    #[serde(default)]
    pub container: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub input_path: String,
    pub output_path: String,
    pub preset_id: String,
    pub options: EncodeOptions,
    pub status: JobStatus,
    pub progress: f32,
    pub speed: Option<String>,
    pub error: Option<String>,
    pub duration: f64,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddJobRequest {
    pub input_path: String,
    pub output_path: String,
    pub options: EncodeOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressPayload {
    pub id: String,
    pub progress: f32,
    pub speed: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GpuVendor {
    Nvidia,
    Amd,
    Intel,
    Apple,
    Vaapi,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HwCapabilities {
    pub nvenc: bool,
    pub gpu: Option<GpuVendor>,
    pub available_gpus: Vec<GpuVendor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YoutubeVideo {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub duration: f64,
    pub thumbnail: Option<String>,
    pub url: String,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YoutubeDownloadOptions {
    pub mode: String,
    pub quality: String,
    pub audio_format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YoutubeDownloadJob {
    pub id: String,
    pub url: String,
    pub title: String,
    pub output_dir: String,
    pub output_path: Option<String>,
    pub options: YoutubeDownloadOptions,
    pub status: JobStatus,
    pub progress: f32,
    pub speed: Option<String>,
    pub error: Option<String>,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddYoutubeDownloadRequest {
    pub url: String,
    pub title: String,
    pub output_dir: String,
    pub options: YoutubeDownloadOptions,
}
