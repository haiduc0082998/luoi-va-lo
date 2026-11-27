// Âm thanh tổng hợp bằng WebAudio, không cần file nào:
// - tiếng ù máy biến áp ở tần số 2 × tần số lưới (≈100 Hz), nghe được khi lưới lệch tần số;
// - gió và mưa từ nhiễu trắng qua bộ lọc, to nhỏ theo tốc độ gió / cơn bão;
// - sấm sau mỗi tia sét (trễ vài trăm ms), còi báo động khi có tin xấu, tiếng "bíp" khi cảnh báo,
//   tiếng nổ trầm khi có vụ nổ, chuông nhẹ khi hoàn thành nhiệm vụ, tiếng tách khi bấm nút.
// Trình duyệt chỉ cho phát âm thanh sau thao tác đầu tiên của người chơi, nên chỉ khởi tạo khi đó.
const MUTE_KEY = 'luoi-va-lo/muted';

export function createAudio(G) {
  let ctx = null, master, hum, humGain, windGain, windFilter, rainGain;
  let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
  let lastNews = null, lastStrikes = G.weather.strikes, alarmUntil = 0;

  function noiseBuffer() {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function loopNoise(filterType, freq) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master); src.start();
    return [g, f];
  }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
    hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 100;
    const humF = ctx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 400;
    humGain = ctx.createGain(); humGain.gain.value = 0;
    hum.connect(humF).connect(humGain).connect(master); hum.start();
    [windGain, windFilter] = loopNoise('bandpass', 500);
    [rainGain] = loopNoise('highpass', 2500);
  }

  // Âm ngắn: tạo dao động + đường bao âm lượng
  function tone(freq, dur, { type = 'sine', vol = 0.2, delay = 0, slide = 0 } = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(dur, freq, vol, delay = 0) { // tiếng nổ / sấm: nhiễu qua lọc thông thấp
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(60, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + dur);
  }

  const sfx = {
    click: () => tone(1800, 0.04, { type: 'square', vol: 0.03 }),
    warn: () => { tone(880, 0.12, { vol: 0.08 }); tone(880, 0.12, { vol: 0.08, delay: 0.18 }); },
    alarm: () => { for (let i = 0; i < 3; i++) { tone(740, 0.22, { type: 'square', vol: 0.06, delay: i * 0.5 }); tone(560, 0.22, { type: 'square', vol: 0.06, delay: i * 0.5 + 0.25 }); } },
    good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.09, delay: i * 0.09 })),
    boom: () => { burst(2.8, 900, 0.9); tone(55, 2.2, { type: 'sine', vol: 0.5, slide: -25 }); },
    thunder: (d) => burst(2.2 + Math.random(), 700, 0.5, d),
  };

  // Theo dõi bản tin để phát âm báo
  G.listeners.add((items) => {
    const n = items[0];
    if (!n || n === lastNews) return;
    lastNews = n;
    if (/nổ|Nổ/.test(n.text) && n.level === 'bad') sfx.boom();
    else if (n.level === 'bad' && performance.now() > alarmUntil) { sfx.alarm(); alarmUntil = performance.now() + 4000; }
    else if (n.level === 'warn') sfx.warn();
    else if (n.level === 'good') sfx.good();
  });

  /** Mỗi khung hình: cập nhật âm nền theo trạng thái game. */
  function update() {
    if (!ctx || muted) return;
    const t = ctx.currentTime, hz = G.net.summary?.hz ?? 0, w = G.windNow ?? 4;
    // Máy biến áp kêu ở 2f; lưới lệch tần số thì tiếng ù to hơn và lệch cao độ rõ rệt
    hum.frequency.setTargetAtTime(hz > 0 ? 2 * hz : 100, t, 0.3);
    humGain.gain.setTargetAtTime(hz > 0 ? 0.012 + Math.min(0.05, Math.abs(hz - 50) * 0.04) : 0, t, 0.5);
    windGain.gain.setTargetAtTime(Math.min(0.25, 0.015 + w * 0.009), t, 1);
    windFilter.frequency.setTargetAtTime(300 + w * 35, t, 1);
    rainGain.gain.setTargetAtTime(G.weather.id === 'storm' ? 0.06 : 0, t, 1.5);
    if (G.weather.strikes > lastStrikes) { lastStrikes = G.weather.strikes; sfx.thunder(0.3 + Math.random() * 0.8); }
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* chế độ riêng tư */ }
    if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
  }

  const unlock = () => { init(); ctx?.resume(); };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('click', (e) => { if (e.target.closest('button')) sfx.click(); });

  return { update, setMuted, get muted() { return muted; }, sfx };
}
