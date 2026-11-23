use std::path::PathBuf;
use std::sync::Mutex;

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

static LAST_SUCCESS: Mutex<Option<Option<String>>> = Mutex::new(None);

pub fn remember(browser: Option<String>) {
    *LAST_SUCCESS.lock().unwrap() = Some(browser);
}

pub fn preferred() -> Option<String> {
    match LAST_SUCCESS.lock().unwrap().clone() {
        Some(inner) => inner,
        None => installed_browsers().into_iter().next(),
    }
}

/// Ordem: último navegador que funcionou, depois os instalados, por fim sem cookies.
pub fn attempts() -> Vec<Option<String>> {
    let installed = installed_browsers();
    let mut out: Vec<Option<String>> = Vec::new();

    if let Some(Some(browser)) = LAST_SUCCESS.lock().unwrap().clone() {
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

fn chrome_dir() -> Option<PathBuf> {
    exists_dir(
        env_dir("LOCALAPPDATA")?
            .join("Google")
            .join("Chrome")
            .join("User Data"),
    )
}

fn edge_dir() -> Option<PathBuf> {
    exists_dir(
        env_dir("LOCALAPPDATA")?
            .join("Microsoft")
            .join("Edge")
            .join("User Data"),
    )
}

fn firefox_dir() -> Option<PathBuf> {
    exists_dir(
        env_dir("APPDATA")?
            .join("Mozilla")
            .join("Firefox")
            .join("Profiles"),
    )
}

fn brave_dir() -> Option<PathBuf> {
    exists_dir(
        env_dir("LOCALAPPDATA")?
            .join("BraveSoftware")
            .join("Brave-Browser")
            .join("User Data"),
    )
}

fn opera_dir() -> Option<PathBuf> {
    exists_dir(
        env_dir("APPDATA")?
            .join("Opera Software")
            .join("Opera Stable"),
    )
}

fn opera_gx_dir() -> Option<PathBuf> {
    exists_dir(
        env_dir("APPDATA")?
            .join("Opera Software")
            .join("Opera GX Stable"),
    )
}

fn vivaldi_dir() -> Option<PathBuf> {
    exists_dir(env_dir("LOCALAPPDATA")?.join("Vivaldi").join("User Data"))
}

fn chromium_dir() -> Option<PathBuf> {
    exists_dir(env_dir("LOCALAPPDATA")?.join("Chromium").join("User Data"))
}

fn whale_dir() -> Option<PathBuf> {
    exists_dir(
        env_dir("LOCALAPPDATA")?
            .join("Naver")
            .join("Naver Whale")
            .join("User Data"),
    )
}
