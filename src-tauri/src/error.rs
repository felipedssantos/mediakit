use serde::Serialize;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

/// Unified application error returned by backend modules and Tauri commands.
/// Serializes as its display string so frontend error handling stays unchanged.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    NotFound(&'static str),
    #[error("{name} sidecar indisponível: {detail}")]
    SidecarUnavailable { name: &'static str, detail: String },
    #[error("Falha ao executar {name}: {detail}")]
    SidecarExec { name: &'static str, detail: String },
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Message(String),
}

impl AppError {
    pub fn message(msg: impl Into<String>) -> Self {
        Self::Message(msg.into())
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<String> for AppError {
    fn from(value: String) -> Self {
        Self::Message(value)
    }
}

impl From<&str> for AppError {
    fn from(value: &str) -> Self {
        Self::Message(value.to_string())
    }
}
