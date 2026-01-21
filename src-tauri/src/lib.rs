use std::process::Command;

// Try to find ollama binary in common locations
fn get_ollama_path() -> Option<String> {
    let paths = [
        "ollama",
        "/usr/local/bin/ollama",
        "/opt/homebrew/bin/ollama",
    ];
    
    for path in paths {
        if Command::new(path)
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Some(path.to_string());
        }
    }
    None
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn check_ollama_installed() -> bool {
    get_ollama_path().is_some()
}

#[tauri::command]
fn run_ollama_command(args: Vec<String>) -> String {
    if let Some(ollama_path) = get_ollama_path() {
        let output = Command::new(&ollama_path)
            .args(args)
            .output();
            
        match output {
            Ok(o) => {
                if o.status.success() {
                    String::from_utf8_lossy(&o.stdout).to_string()
                } else {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    format!("Error: {}", stderr)
                }
            },
            Err(e) => format!("Error: {}", e),
        }
    } else {
        "Error: Ollama not found".to_string()
    }
}

use tauri::Emitter;

#[tauri::command]
fn install_ollama() -> bool {
    let _ = opener::open("https://ollama.com/download");
    true
}

#[tauri::command]
async fn setup_muradian_auto(app: tauri::AppHandle) -> Result<String, String> {
    let os = std::env::consts::OS;
    let _ = app.emit("setup-progress", "Starting setup...");

    // Helper to run command and emit progress
    let run_cmd = |cmd: &str, args: &[&str], stage: &str| -> Result<(), String> {
        let _ = app.emit("setup-progress", stage);
        println!("Running: {} {:?}", cmd, args);
        
        let output = std::process::Command::new(cmd)
            .args(args)
            .output()
            .map_err(|e| format!("Failed to run {}: {}", cmd, e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Command failed: {}", stderr));
        }
        Ok(())
    };

    match os {
        "windows" => {
             // Windows setup
             run_cmd("cmd", &["/C", "winget install -e --id Ollama.Ollama"], "Installing Ollama (Windows)...")?;
             run_cmd("cmd", &["/C", "ollama pull deepseek-r1:1.5b"], "Pulling deepseek-r1:1.5b...")?; 
        }
        "macos" | "linux" => {
             // check if ollama exists first to skip install if possible? 
             // Logic says "install via curl script". 
             // We can try to check availability first?
             // But user script was unconditional. Let's rely on script idempotency or check.
             
             // Check if ollama is installed
             let installed = std::process::Command::new("ollama").arg("--version").output().is_ok();
             
             if !installed {
                 run_cmd("sh", &["-c", "curl -fsSL https://ollama.com/install.sh | sh"], "Installing Ollama...")?;
             }
             
             run_cmd("ollama", &["pull", "deepseek-r1:1.5b"], "Pulling Model: deepseek-r1:1.5b (this may take a while)...")?;
        }
        _ => return Err(format!("Unsupported OS: {}", os)),
    }

    let _ = app.emit("setup-progress", "Setup Complete!");
    Ok("Success".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            check_ollama_installed, 
            run_ollama_command,
            install_ollama,
            setup_muradian_auto
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

