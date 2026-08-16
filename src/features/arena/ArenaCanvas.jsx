import { useEffect, useRef } from 'react';
import { ARENA, SIM } from '../../engine/constants.js';
import { ArenaRenderer } from './renderer.js';

/**
 * Menjalankan game loop dan menggambar simulasi.
 *
 * Pola yang dipakai: FIXED TIMESTEP dengan akumulator.
 *
 *   waktu nyata (dt bervariasi)  ->  akumulator  ->  N x step(1/60)
 *
 * Kenapa tidak langsung `sim.step(dtFrame)`? Karena dt yang bervariasi membuat
 * fisika tidak deterministik dan tumbukan bisa "tembus" saat frame drop —
 * bola cepat bisa melewati bola lain dalam satu frame panjang. Dengan langkah
 * tetap, hasil di monitor 60Hz dan 144Hz identik.
 *
 * Efek visual (partikel, angka damage) sengaja diperbarui dengan dt NYATA,
 * bukan dt simulasi, supaya animasinya tetap mulus dan tidak ikut terpotong.
 */
export function ArenaCanvas({ simulation, running, speed = 1, onUpdate, onFinish }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const stateRef = useRef({ running, speed, onUpdate, onFinish });

  // Menyimpan props terbaru di ref agar loop rAF tidak perlu dibuat ulang
  // setiap render — membuat ulang loop akan mereset akumulator dan bikin patah.
  stateRef.current = { running, speed, onUpdate, onFinish };

  if (!rendererRef.current) rendererRef.current = new ArenaRenderer();

  // Simulasi baru = arena baru: bersihkan semua efek sisa pertandingan lalu.
  useEffect(() => {
    rendererRef.current.reset();
  }, [simulation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = ARENA.width * dpr;
    canvas.height = ARENA.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let sinceNotify = 0;
    let finished = false;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);

      const dtReal = Math.min((now - last) / 1000, 0.25);
      last = now;

      const { running: isRunning, speed: rate, onUpdate: notify, onFinish: finish } =
        stateRef.current;
      const renderer = rendererRef.current;
      const sim = simulation;

      if (sim && isRunning && !sim.isOver) {
        accumulator += dtReal * rate;

        let steps = 0;
        while (accumulator >= SIM.dt && steps < SIM.maxStepsPerFrame) {
          sim.step(SIM.dt);
          accumulator -= SIM.dt;
          steps++;
        }
        // Tab yang lama di background bisa menumpuk akumulator sampai puluhan
        // detik. Membuangnya lebih baik daripada memicu "spiral of death".
        if (accumulator > SIM.dt * SIM.maxStepsPerFrame) accumulator = 0;

        renderer.ingest(sim.drainEvents());

        sinceNotify += dtReal;
        if (sinceNotify > 0.12) {
          sinceNotify = 0;
          notify?.(sim);
        }

        if (sim.isOver && !finished) {
          finished = true;
          notify?.(sim);
          finish?.(sim.result);
        }
      }

      renderer.update(dtReal);
      if (sim) renderer.draw(ctx, sim);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [simulation]);

  return (
    <canvas
      ref={canvasRef}
      className="arena-canvas"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
