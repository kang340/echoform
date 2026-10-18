import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const env={...process.env};
const bundled='C:/Users/hkang/anaconda3/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
if(!env.HYPERFRAMES_FFMPEG_PATH && existsSync(bundled))env.HYPERFRAMES_FFMPEG_PATH=bundled;
const probe=path.join(root,'.hyperframes/bin/ffprobe.exe');
if(!env.HYPERFRAMES_FFPROBE_PATH && existsSync(probe))env.HYPERFRAMES_FFPROBE_PATH=probe;
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
if(!env.HYPERFRAMES_BROWSER_PATH && existsSync(chrome))env.HYPERFRAMES_BROWSER_PATH=chrome;
const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['--yes','hyperframes@0.8.170','render','--fps','30','--quality','high','--workers','2','--output','../media/ECHOFORM-promo-X.mp4',...process.argv.slice(2)],{cwd:root,env,stdio:'inherit',shell:process.platform==='win32'});
process.exit(result.status??1);
