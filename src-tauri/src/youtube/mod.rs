pub mod cookies;
pub mod download;
pub mod manager;
pub mod probe;

pub use manager::YoutubeManager;

use crate::error::{AppError, AppResult};

/// Validates that a user-supplied media URL uses HTTP(S) and is non-empty.
pub(crate) fn validate_media_url(url: &str) -> AppResult<&str> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation("Cole um link de vídeo para continuar"));
    }
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err(AppError::validation(
            "URL inválida: use um link http:// ou https://",
        ));
    }
    Ok(trimmed)
}
