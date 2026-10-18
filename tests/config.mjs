import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const projectPath = (...parts) => path.join(projectRoot, ...parts);
export const baseUrl = process.env.ECHOFORM_URL || 'http://127.0.0.1:5178/';
const systemBrowser = process.platform === 'win32'
  ? [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p))
  : process.env.CHROME_PATH;
export const launchOptions = {
  headless: true,
  ...(systemBrowser ? { executablePath: systemBrowser } : {}),
  ...(process.platform === 'linux' ? { args: ['--enable-unsafe-swiftshader'] } : {}),
};
mkdirSync(projectPath('shots'), { recursive: true });
mkdirSync(projectPath('tests', 'artifacts'), { recursive: true });
