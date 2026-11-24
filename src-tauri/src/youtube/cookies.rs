use std::path::PathBuf;

use parking_lot::Mutex;

type BrowserProbe = (&'static str, fn() -> Option<PathBuf>);

/// Nomes aceitos pelo `--cookies-from-browser` do yt-dlp (Windows).
const CANDIDATES: &[BrowserProbe] = &[
    ("chrome", chrome_dir),
    ("edge", edge_dir),
    ("firefox", firefox_dir),
    ("brave", brave_dir),
    ("opera", opera_dir),
    ("opera_gx", opera_gx_dir),
    ("vivaldi", vivaldi_dir),
    ("chromium", chromium_dir),
    ("whale", whale_dir),
];

/// Managed Tauri state caching the last browser profile that succeeded for yt-dlp cookies.
pub struct CookieCache {
    last_success: Mutex<Option<Option<String>>>,
}

impl CookieCache {
    pub fn new() -> Self {
        Self {
            last_success: Mutex::new(None),
        }
    }

    pub fn remember(&self, browser: Option<String>) {
        *self.last_success.lock() = Some(browser);
    }

    pub fn preferred(&self) -> Option<String> {
        match self.last_success.lock().clone() {
            Some(inner) => inner,
            None => installed_browsers().into_iter().next(),
        }
    }

    /// Ordem: último navegador que funcionou, depois os instalados, por fim sem cookies.
    pub fn attempts(&self) -> Vec<Option<String>> {
        let installed = installed_browsers();
        let mut out: Vec<Option<String>> = Vec::new();

        if let Some(Some(browser)) = self.last_success.lock().clone() {
            out.push(Some(browser));
        }

        for name in installed {
            if !out
                .iter()
                .any(|item| item.as_deref() == Some(name.as_str()))
            {
                out.push(Some(name));
            }
        }

        if !out.iter().any(Option::is_none) {
            out.push(None);
        }
        out
    }
}

pub fn installed_browsers() -> Vec<String> {
    CANDIDATES
        .iter()
        .filter_map(|(name, locate)| locate().map(|_| (*name).to_string()))
        .collect()
}

pub fn should_try_next_browser(detail: &str) -> bool {
    let lower = detail.to_lowercase();
    if lower.contains("unsupported url")
        || lower.contains("is not a valid url")
        || lower.contains("playlist")
    {
        return false;
    }
    lower.contains("cookie")
        || lower.contains("sign in")
        || lower.contains("login")
        || lower.contains("decrypt")
        || lower.contains("could not copy")
        || lower.contains("could not find")
        || lower.contains("unknown browser")
        || lower.contains("failed to load cookies")
        || lower.contains("age")
        || lower.contains("private")
        || lower.contains("403")
}

fn env_dir(var: &str) -> Option<PathBuf> {
    std::env::var_os(var).map(PathBuf::from)
}

fn exists_dir(path: PathBuf) -> Option<PathBuf> {
    path.is_dir().then_some(path)
}

#[cfg(not(windows))]
fn config_base_dir() -> Option<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        if let Some(xdg) = env_dir("XDG_CONFIG_HOME") {
            return Some(xdg);
        }
        env_dir("HOME").map(|h| h.join(".config"))
    }
    #[cfg(target_os = "macos")]
    {
        env_dir("HOME").map(|h| h.join("Library").join("Application Support"))
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        None
    }
}

fn chrome_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(
            env_dir("LOCALAPPDATA")?
                .join("Google")
                .join("Chrome")
                .join("User Data"),
        )
    }
    #[cfg(target_os = "linux")]
    {
        exists_dir(config_base_dir()?.join("google-chrome"))
    }
    #[cfg(target_os = "macos")]
    {
        exists_dir(config_base_dir()?.join("Google").join("Chrome"))
    }
}

fn edge_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(
            env_dir("LOCALAPPDATA")?
                .join("Microsoft")
                .join("Edge")
                .join("User Data"),
        )
    }
    #[cfg(target_os = "linux")]
    {
        exists_dir(config_base_dir()?.join("microsoft-edge"))
    }
    #[cfg(target_os = "macos")]
    {
        exists_dir(config_base_dir()?.join("Microsoft Edge"))
    }
}

fn firefox_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(
            env_dir("APPDATA")?
                .join("Mozilla")
                .join("Firefox")
                .join("Profiles"),
        )
    }
    #[cfg(target_os = "linux")]
    {
        exists_dir(env_dir("HOME")?.join(".mozilla").join("firefox"))
    }
    #[cfg(target_os = "macos")]
    {
        exists_dir(config_base_dir()?.join("Firefox").join("Profiles"))
    }
}

fn brave_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(
            env_dir("LOCALAPPDATA")?
                .join("BraveSoftware")
                .join("Brave-Browser")
                .join("User Data"),
        )
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        exists_dir(
            config_base_dir()?
                .join("BraveSoftware")
                .join("Brave-Browser"),
        )
    }
}

fn opera_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(
            env_dir("APPDATA")?
                .join("Opera Software")
                .join("Opera Stable"),
        )
    }
    #[cfg(target_os = "linux")]
    {
        exists_dir(config_base_dir()?.join("opera"))
    }
    #[cfg(target_os = "macos")]
    {
        exists_dir(config_base_dir()?.join("com.operasoftware.Opera"))
    }
}

fn opera_gx_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(
            env_dir("APPDATA")?
                .join("Opera Software")
                .join("Opera GX Stable"),
        )
    }
    #[cfg(target_os = "macos")]
    {
        exists_dir(config_base_dir()?.join("com.operasoftware.OperaGX"))
    }
    #[cfg(target_os = "linux")]
    {
        None
    }
}

fn vivaldi_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(env_dir("LOCALAPPDATA")?.join("Vivaldi").join("User Data"))
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        exists_dir(config_base_dir()?.join("vivaldi"))
    }
}

fn chromium_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(env_dir("LOCALAPPDATA")?.join("Chromium").join("User Data"))
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        exists_dir(config_base_dir()?.join("chromium"))
    }
}

fn whale_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        exists_dir(
            env_dir("LOCALAPPDATA")?
                .join("Naver")
                .join("Naver Whale")
                .join("User Data"),
        )
    }
    #[cfg(target_os = "macos")]
    {
        exists_dir(config_base_dir()?.join("Naver").join("Whale"))
    }
    #[cfg(target_os = "linux")]
    {
        None
    }
}
