/**
 * Gambar senjata dan zirah di atas bola.
 *
 * Seluruhnya vektor Canvas — tidak ada sprite. Alasannya sama dengan audio:
 * tidak ada aset yang harus dilisensikan atau dimuat, dan bentuknya bisa
 * dianimasikan sebagai fungsi waktu alih-alih dipilih dari lembar frame.
 *
 * Aturan yang dipegang seluruh berkas ini:
 *
 * 1. Setiap fungsi menggambar di ruang koordinat LOKAL — titik (0,0) adalah
 *    pusat bola dan sumbu +X menghadap ke target. Rotasi dan translasi
 *    ditangani pemanggil. Tanpa aturan ini, tiap senjata harus mengulang
 *    matematika sudut yang sama dan pasti ada yang salah tanda.
 *
 * 2. Ukurannya relatif terhadap radius bola, bukan piksel tetap. Goliath
 *    berjari-jari 25 dan Fae berjari-jari 15 harus sama-sama terlihat memegang
 *    senjata, bukan tertimbun olehnya.
 *
 * 3. Fase serangan `t` berjalan 1 -> 0. Nilai 1 berarti serangan baru dimulai.
 *    Tiap senjata bebas menafsirkannya: pedang mengayun, busur menarik tali,
 *    tongkat mengumpulkan cahaya.
 */

const TAU = Math.PI * 2;

/**
 * Kurva ayunan: cepat di awal, melambat di akhir.
 * Ayunan linear terlihat seperti animasi robot; senjata sungguhan punya
 * percepatan.
 */
const swingCurve = (t) => 1 - Math.pow(1 - t, 2.4);

/** Metal terang dengan sedikit gradasi, dipakai banyak senjata. */
function steel(ctx, length) {
  const g = ctx.createLinearGradient(0, 0, length, 0);
  g.addColorStop(0, '#94a3b8');
  g.addColorStop(0.5, '#e2e8f0');
  g.addColorStop(1, '#cbd5e1');
  return g;
}

function grip(ctx, from, to, width = 3) {
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from, 0);
  ctx.lineTo(to, 0);
  ctx.stroke();
}

// --------------------------------------------------------------- senjata

/**
 * Tiap entri menerima (ctx, r, phase) dan menggambar di ruang lokal.
 * `phase` sudah 0..1 dengan 1 = awal serangan.
 */
const WEAPONS = {
  longsword(ctx, r, phase) {
    // Ayunan menyapu dari atas ke bawah.
    const angle = -1.1 + swingCurve(1 - phase) * 2.0;
    ctx.rotate(angle);
    const len = r * 2.1;

    grip(ctx, r * 0.5, r * 0.85);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r * 0.8, -5);
    ctx.lineTo(r * 0.8, 5);
    ctx.stroke();

    ctx.strokeStyle = steel(ctx, len);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.85, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
  },

  greataxe(ctx, r, phase) {
    const angle = -1.5 + swingCurve(1 - phase) * 2.7;
    ctx.rotate(angle);
    const shaft = r * 1.9;

    grip(ctx, r * 0.4, shaft, 4);

    // Bilah kapak: busur tebal di ujung gagang.
    ctx.fillStyle = steel(ctx, shaft);
    ctx.beginPath();
    ctx.moveTo(shaft * 0.72, 0);
    ctx.quadraticCurveTo(shaft * 1.05, -r * 0.95, shaft, -r * 0.15);
    ctx.quadraticCurveTo(shaft * 1.05, r * 0.95, shaft * 0.72, 0);
    ctx.fill();
  },

  warhammer(ctx, r, phase) {
    const angle = -1.6 + swingCurve(1 - phase) * 2.9;
    ctx.rotate(angle);
    const shaft = r * 1.75;

    grip(ctx, r * 0.4, shaft, 4);
    ctx.fillStyle = steel(ctx, shaft);
    ctx.fillRect(shaft * 0.85, -r * 0.55, r * 0.75, r * 1.1);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(shaft * 0.85, -r * 0.55, r * 0.2, r * 1.1);
  },

  daggers(ctx, r, phase) {
    // Dua belati menusuk bergantian — tempo tinggi harus terlihat.
    const thrust = swingCurve(1 - phase) * r * 0.7;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * 0.45);
      grip(ctx, r * 0.55, r * 0.8, 2.5);
      ctx.strokeStyle = steel(ctx, r);
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.8 + thrust, 0);
      ctx.lineTo(r * 1.35 + thrust, 0);
      ctx.stroke();
      ctx.restore();
    }
  },

  spear(ctx, r, phase) {
    // Menusuk lurus, bukan mengayun.
    const thrust = swingCurve(1 - phase) * r * 1.1;
    const shaft = r * 2.4 + thrust;

    grip(ctx, r * 0.3 + thrust, shaft * 0.86, 3);
    ctx.fillStyle = steel(ctx, shaft);
    ctx.beginPath();
    ctx.moveTo(shaft, 0);
    ctx.lineTo(shaft * 0.84, -r * 0.22);
    ctx.lineTo(shaft * 0.84, r * 0.22);
    ctx.closePath();
    ctx.fill();
  },

  longbow(ctx, r, phase) {
    // phase 1 = tali baru dilepas. Jadi tarikan digambar terbalik: makin
    // mendekati 0, busurnya makin siap menarik lagi.
    const draw = phase * r * 0.55;

    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r * 0.35, 0, r * 0.95, -1.15, 1.15);
    ctx.stroke();

    const tipX = r * 0.35 + Math.cos(1.15) * r * 0.95;
    const tipY = Math.sin(1.15) * r * 0.95;
    ctx.strokeStyle = 'rgba(226,232,240,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tipX, -tipY);
    ctx.lineTo(r * 0.3 - draw, 0);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    if (draw > 1) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 0.3 - draw, 0);
      ctx.lineTo(r * 1.2, 0);
      ctx.stroke();
    }
  },

  staff(ctx, r, phase) {
    const shaft = r * 2.0;
    grip(ctx, r * 0.3, shaft * 0.88, 3.5);

    // Bola sihir membesar dan menyala saat mengumpulkan tenaga.
    const charge = 0.45 + phase * 0.85;
    const orbR = r * 0.3 * charge;
    const glow = ctx.createRadialGradient(shaft, 0, 0, shaft, 0, orbR * 2.4);
    glow.addColorStop(0, `rgba(196,181,253,${0.5 + phase * 0.5})`);
    glow.addColorStop(1, 'rgba(196,181,253,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(shaft, 0, orbR * 2.4, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#ddd6fe';
    ctx.beginPath();
    ctx.arc(shaft, 0, orbR, 0, TAU);
    ctx.fill();
  },

  chakram(ctx, r, phase) {
    // Cincin berputar; perputarannya melambat setelah dilempar.
    ctx.rotate(phase * 6);
    ctx.strokeStyle = steel(ctx, r);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r * 1.15, 0, r * 0.42, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(226,232,240,0.5)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(r * 1.15 + Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
      ctx.lineTo(r * 1.15 + Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.stroke();
    }
  },

  fists(ctx, r, phase) {
    const thrust = swingCurve(1 - phase) * r * 0.5;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * 0.5);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(r * 0.9 + thrust, 0, r * 0.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },
};

// ----------------------------------------------------------------- zirah

/**
 * Zirah digambar sebagai cincin dengan karakter berbeda, bukan sebagai bentuk
 * di atas bola. Cincin tidak pernah menutupi wajah bola maupun bertabrakan
 * dengan senjata — dan tetap terbaca meski bolanya kecil dan bergerak cepat.
 */
const ARMORS = {
  plate(ctx, r) {
    ctx.strokeStyle = 'rgba(203,213,225,0.85)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.6, 0, TAU);
    ctx.stroke();
    // Sambungan pelat.
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(15,23,42,0.55)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1));
      ctx.lineTo(Math.cos(a) * (r + 3.4), Math.sin(a) * (r + 3.4));
      ctx.stroke();
    }
  },

  chainmail(ctx, r) {
    ctx.save();
    ctx.setLineDash([3, 2.4]);
    ctx.strokeStyle = 'rgba(148,163,184,0.9)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.4, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },

  leather(ctx, r) {
    ctx.strokeStyle = 'rgba(146,64,14,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.2, 0, TAU);
    ctx.stroke();
  },

  robe(ctx, r) {
    // Kain: busur lembut yang tidak menutup penuh.
    ctx.strokeStyle = 'rgba(196,181,253,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 0.5, Math.PI - 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, Math.PI + 0.5, TAU - 0.5);
    ctx.stroke();
  },

  runic(ctx, r, time) {
    ctx.save();
    ctx.rotate(time * 0.8);
    ctx.strokeStyle = 'rgba(125,211,252,0.85)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, r + 2.4, a, a + 0.45);
      ctx.stroke();
    }
    ctx.restore();
  },

  // 'bare' sengaja tidak ada: tanpa zirah berarti tidak ada apa pun di sana,
  // dan ketiadaan itu justru informasi yang berguna.
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} fighter
 * @param {number} time detik simulasi, untuk zirah yang beranimasi sendiri
 */
export function drawGear(ctx, fighter, time) {
  const r = fighter.radius;

  const armor = ARMORS[fighter.armorId];
  if (armor) {
    ctx.save();
    ctx.translate(fighter.renderX, fighter.renderY);
    armor(ctx, r, time);
    ctx.restore();
  }

  const weapon = WEAPONS[fighter.weaponId];
  if (!weapon) return;

  const phase =
    fighter.attackAnimDuration > 0
      ? Math.max(0, Math.min(1, fighter.attackAnim / fighter.attackAnimDuration))
      : 0;

  ctx.save();
  ctx.translate(fighter.renderX, fighter.renderY);
  ctx.rotate(fighter.aimAngle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  weapon(ctx, r, phase);
  ctx.restore();
}

/** Dipakai kartu karakter untuk menampilkan ikon senjata kecil. */
export function drawWeaponIcon(ctx, weaponId, size) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return;
  ctx.save();
  ctx.translate(size * 0.22, size / 2);
  ctx.lineCap = 'round';
  weapon(ctx, size * 0.3, 0);
  ctx.restore();
}
