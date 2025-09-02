use std::env;
use std::fs;

pub fn load_environment() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file from project root (similar to Electron)
    let env_path = env::current_dir()?.join("..").join(".env");

    if env_path.exists() {
        let contents = fs::read_to_string(env_path)?;
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once('=') {
                env::set_var(key.trim(), value.trim());
            }
        }
    }

    Ok(())
}


