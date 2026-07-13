import fs from "fs";
import os from "os";
import path from "path";

export type Config = {
  db_url: string;
  current_user_name?: string;
};

function getConfigFilePath(): string {
  return path.join(os.homedir(), ".gatorconfig.json");
}

export function readConfig(): Config {
  const filePath = getConfigFilePath();
  const rawText = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(rawText) as Config;
}

export function writeConfig(cfg: Config): void {
  const filePath = getConfigFilePath();
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), "utf-8");
}
export function setUser(cfg: Config, userName: string): void {
  cfg.current_user_name = userName;
  writeConfig(cfg);
}
