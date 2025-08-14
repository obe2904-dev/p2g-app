import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

function classifyAspect(w: number, h: number): string {
  const r = w / Math.max(h, 1);
  const near = (x: number, y: number, tol = 0.04) => Math.abs(x - y) < tol;
  if (near(r, 1)) return '1:1';
  if (near(r, 4 / 5)) return '4:5';
  if (near(r, 9 / 16)) return '9:16';
  if (near(r, 16 / 9)) return '16:9';
  if (near(r, 3 / 2)) return '3:2';
  return 'other';
}

function meanStd(pixels: Uint8Array): { mean: number; std: number } {
  let s = 0, s2 = 0;
  const n = pixels.length;
  for (let i = 0; i < n; i++) { const v = pixels[i]; s += v; s2 += v * v; }
  const mean = s / n;
  const variance = Math.max(0, (s2 / n) - (mean * mean));
  const std = Math.sqrt(variance);
  return { mean, std };
}

function sharpnessScore(pixels: Uint8Array, w: number, h: number): number {
  let sum = 0; let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = pixels[i];
      if (x + 1 < w) { sum += Math.abs(p - pixels[i + 1]); count++; }
      if (y + 1 < h) { sum += Math.abs(p - pixels[i + w]); count++; }
    }
  }
  const meanDiff = count ? (sum / count) : 0;
  return Math.max(0, Math.min(1, meanDiff / 64));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const { image_url, post_id } = req.body || {};
    if (!image_url || typeof image_url !== 'string') return res.status(400).send('image_url required');

    const response = await fetch(image_url);
    if (!response.ok) return res.status(400).send('Unable to fetch image');
    const buf = Buffer.from(await response.arrayBuffer());

    const meta = await sharp(buf).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;

    const size = 96;
    const { data: gray, info } = await sharp(buf)
      .resize({ width: size, height: size, fit: 'inside' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width; const h = info.height;

    const { mean, std } = meanStd(gray);
    const sharpness = sharpnessScore(gray, w, h);

    const aspect_label = classifyAspect(width, height);
    const brightness = mean;      // 0..255
    const contrast = std;         // ~0..128

    const verdicts: string[] = [];
    const minShortSide = 1080;    // god minimum for IG‑kvalitet
    if (Math.min(width, height) < minShortSide) verdicts.push('resize');
    if (brightness < 90) verdicts.push('improve_brightness');
    if (contrast < 35) verdicts.push('improve_contrast');
    if (sharpness < 0.18) verdicts.push('improve_sharpness');
    if (!['1:1', '4:5', '9:16'].includes(aspect_label)) verdicts.push('crop_recommendation');
    const verdict = verdicts.length ? verdicts.join(',') : 'ok';

    // Find user_email via post_id (hvis medsendt)
    let user_email: string | null = null;
    if (post_id) {
      const { data: post } = await admin
        .from('posts_app')
        .select('user_email')
        .eq('id', post_id)
        .single();
      user_email = post?.user_email ?? null;
    }

    await admin.from('media_scores').insert([{
      post_id: post_id ?? null,
      image_url,
      width, height, aspect_label,
      brightness, contrast, sharpness,
      verdict,
      user_email
    }]);

    const suggestions: string[] = [];
    if (verdict.includes('resize')) suggestions.push('Brug mindst 1080 px på den korteste led for skarp visning.');
    if (verdict.includes('improve_brightness')) suggestions.push('Øg lysstyrke lidt eller fotografer tættere ved vindue/bedre lys.');
    if (verdict.includes('improve_contrast')) suggestions.push('Tilføj en anelse kontrast (undgå over‑filtering).');
    if (verdict.includes('improve_sharpness')) suggestions.push('Hold kameraet mere stabilt eller brug et skarpere foto.');
    if (verdict.includes('crop_recommendation')) suggestions.push('Overvej beskæring til 1:1, 4:5 eller 9:16 afhængigt af kanal.');
    if (suggestions.length === 0) suggestions.push('Ser godt ud!');

    return res.status(200).json({
      width, height, aspect_label,
      brightness: Math.round(brightness),
      contrast: Math.round(contrast),
      sharpness: +sharpness.toFixed(2),
      verdict,
      suggestions
    });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Server error');
  }
}
