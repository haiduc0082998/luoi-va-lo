// Hậu kỳ hình ảnh bằng CameraFrame của PlayCanvas: tone mapping ACES, bloom cho vật phát sáng
// (vòng Cherenkov, đèn đường, lửa, đèn pha), che sáng môi trường SSAO, chỉnh màu và viền tối.
// Đồ hoạ thấp tắt SSAO và MSAA, giảm bloom. Màu thay đổi theo không khí: bão thì xám lạnh,
// có phóng xạ thì ngả xanh vàng, bạc màu.
import * as pc from 'playcanvas';

export function createPost(app, camEntity) {
  let cf;
  try {
    cf = new pc.CameraFrame(app, camEntity.camera);
  } catch (err) {
    console.warn('Không bật được hậu kỳ, dùng hình gốc', err);
    camEntity.camera.toneMapping = pc.TONEMAP_ACES;
    return { setQuality() {}, mood() {} };
  }
  const r = cf.rendering;
  r.toneMapping = pc.TONEMAP_ACES;
  r.sharpness = 0.25;
  cf.bloom.threshold = 1.0; cf.bloom.blurLevel = 14;
  cf.grading.enabled = true;
  cf.vignette.inner = 0.55; cf.vignette.outer = 1.15; cf.vignette.curvature = 0.6; cf.vignette.intensity = 0.32;
  cf.ssao.radius = 7; cf.ssao.samples = 12; cf.ssao.power = 4; cf.ssao.blurEnabled = true; cf.ssao.minAngle = 10;
  let high = true;
  const tint = new pc.Color(1, 1, 1), want = new pc.Color(1, 1, 1);
  let sat = 1.08, con = 1.05;

  function setQuality(h) {
    high = h;
    r.samples = h ? 4 : 1;
    cf.ssao.type = h ? 'combine' : 'none';
    cf.ssao.intensity = 0.45;
    cf.bloom.intensity = h ? 0.03 : 0.018;
    cf.update();
  }

  /** Không khí khung cảnh: night 0..1, storm, rad (mức phóng xạ 0..1), dt để chuyển mượt. */
  function mood({ night = 0, storm = false, rad = 0, dt = 0.016 }) {
    want.set(1, 1, 1);
    if (storm) want.set(0.92, 0.96, 1.04);
    if (rad > 0) want.set(1 + 0.05 * rad, 1 + 0.08 * rad, 1 - 0.18 * rad);
    const k = Math.min(1, dt * 1.5);
    tint.lerp(tint, want, k);
    sat += ((storm ? 0.88 : 1.08) - 0.35 * rad - sat) * k;
    con += ((1.05 + 0.08 * night) - con) * k;
    cf.grading.tint = tint; cf.grading.saturation = sat; cf.grading.contrast = con; cf.grading.brightness = 1;
    cf.vignette.intensity = 0.32 + 0.2 * rad + 0.08 * night;
    cf.bloom.intensity = (high ? 0.03 : 0.018) * (1 + 0.6 * night);
    cf.update();
  }

  setQuality(true);
  return { setQuality, mood };
}
