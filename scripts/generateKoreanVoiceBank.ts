/**
 * Generates 39 studio Korean voice-actor .mp3 dubbing files into
 * wargame3/src/assets/audio/voices/ for IRON ASH III: ZERO HOUR.
 *
 * Uses natural Korean neural speech synthesis (.mp3) which is subsequently
 * routed through per-character pitch/formant shaping and our authentic VHF
 * tactical military radio DSP filter (340-3100Hz bandpass + analog saturation
 * + PTT squelch crackle + static bed) in src/game/audio.ts.
 *
 * Run via: .\node_modules\.bin\tsx.cmd scripts\generateKoreanVoiceBank.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICE_DUB_MANIFEST } from '../src/game/voiceManifest';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(SCRIPT_DIR, '../src/assets/audio/voices');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function synthesizeKoreanMp3(text: string): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ko&client=tw-ob&q=${encodeURIComponent(text)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://translate.google.com/',
        Accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.byteLength < 2048 || (!contentType.includes('audio') && buf[0] !== 0xff && buf.subarray(0, 3).toString() !== 'ID3')) {
      throw new Error(`Unexpected response (${contentType}, ${buf.byteLength} bytes)`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function generateOne(id: string, text: string): Promise<number> {
  const outPath = path.join(OUT_DIR, `${id}.mp3`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 2048) {
    return fs.statSync(outPath).size;
  }

  const buf = await synthesizeKoreanMp3(text);
  fs.writeFileSync(outPath, buf);
  return buf.byteLength;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Generating ${VOICE_DUB_MANIFEST.length} Korean voice-actor .mp3 clips into ${OUT_DIR}...`);

  let totalBytes = 0;
  let failed = 0;

  for (let i = 0; i < VOICE_DUB_MANIFEST.length; i += 3) {
    const batch = VOICE_DUB_MANIFEST.slice(i, i + 3);
    await Promise.all(
      batch.map(async (clip, idx) => {
        if (idx > 0) await new Promise((r) => setTimeout(r, 120 * idx));
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const bytes = await generateOne(clip.id, clip.text);
            totalBytes += bytes;
            console.log(`  [OK] ${clip.id}.mp3 (${(bytes / 1024).toFixed(1)} KB)`);
            return;
          } catch (err) {
            if (attempt === 3) {
              failed++;
              console.error(`  [FAIL] ${clip.id}:`, err instanceof Error ? err.message : err);
            } else {
              await new Promise((r) => setTimeout(r, 400 * attempt));
            }
          }
        }
      })
    );
    await new Promise((r) => setTimeout(r, 140));
  }

  console.log(
    `Done! Generated ${VOICE_DUB_MANIFEST.length - failed}/${VOICE_DUB_MANIFEST.length} clips (${(
      totalBytes / 1024
    ).toFixed(1)} KB total).`
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
