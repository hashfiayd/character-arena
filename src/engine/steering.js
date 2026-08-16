/**
 * Steering behaviors — "otak" tiap bola.
 *
 * Model yang dipakai adalah Craig Reynolds steering: setiap perilaku
 * menghasilkan DESIRED VELOCITY, lalu gaya = (desired - velocity_sekarang),
 * dibatasi `maxForce`. Ini kenapa gerakannya melengkung dan punya inersia,
 * bukan patah-patah seperti kalau kita langsung men-set posisi.
 *
 * Perilaku yang aktif bersamaan dijumlahkan dengan bobot. Hasilnya: bola bisa
 * mengejar target SAMBIL menjauhi teman SAMBIL menghindari dinding — tanpa
 * satu pun state machine kaku.
 */

import { AI, ARENA, OBSTACLE, STEERING, FighterState } from './constants.js';
import { canSteer, hpRatio, isAlive, isEnemy } from './fighter.js';
import { hasLineOfSight } from './obstacles.js';
import * as V from '../lib/vec.js';

const W = STEERING.weights;

/**
 * Menghitung gaya untuk mencapai kecepatan yang diinginkan.
 * @returns {{x:number, y:number}}
 */
function steerTowards(fighter, desiredDir, speedRatio = 1) {
  const desired = V.scale(desiredDir, fighter.stats.spd * speedRatio);
  const steer = V.sub(desired, fighter.vel);
  return V.limit(steer, STEERING.maxForce);
}

function applyForce(fighter, force, weight) {
  fighter.force.x += force.x * weight;
  fighter.force.y += force.y * weight;
}

/**
 * Memilih target.
 *
 * Skor = 1 / jarak, ditambah bonus kalau musuh sudah sekarat (focus fire),
 * dikurangi penalti kalau target sekarang masih "lengket". Stickiness penting:
 * tanpa itu, fighter di tengah kerumunan akan berganti target tiap frame dan
 * berakhir bergetar di tempat tanpa pernah menyerang.
 */
export function selectTarget(fighter, fighters, dt) {
  fighter.targetTimer -= dt;

  const current = fighters.get(fighter.targetId);
  const currentValid = current && isAlive(current) && isEnemy(fighter, current);

  if (currentValid && fighter.targetTimer > 0) return current;

  let best = null;
  let bestScore = -Infinity;

  for (const other of fighters.values()) {
    if (other === fighter || !isAlive(other) || !isEnemy(fighter, other)) continue;

    const d = Math.max(V.dist(fighter.pos, other.pos), 1);
    let score = 1000 / d;
    score += AI.lowHpTargetBonus * (1 - hpRatio(other)) * (1000 / d);

    // Sedikit preferensi mempertahankan target lama, mencegah target-flicker.
    if (other === current) score *= 1.25;

    if (score > bestScore) {
      bestScore = score;
      best = other;
    }
  }

  if (best) {
    if (best !== current) fighter.targetTimer = AI.targetStickiness;
    fighter.targetId = best.id;
  } else {
    fighter.targetId = null;
  }

  return best;
}

/**
 * Jarak ideal terhadap target.
 *
 * Kuncinya: jarak ini WAJIB dihitung relatif terhadap titik kontak
 * (radius penyerang + radius target), bukan dari angka `range` saja.
 *
 * Kalau tidak, jarak ideal untuk melee (mis. 15 unit) berada jauh DI DALAM
 * tubuh lawan — yang secara fisika tidak mungkin dicapai. Akibatnya AI selalu
 * berada di mode "kejar" dengan kecepatan penuh, menyeruduk, lalu terpental
 * karena restitusi, dan mengulanginya terus. Hasil pengukuran: petarung melee
 * hanya 1-2% waktu berada dalam jangkauan serangnya sendiri, dan senjata
 * berjangkauan pendek seperti Twin Daggers praktis tidak pernah menang.
 *
 * Dengan patokan titik kontak, melee justru MENGITARI lawan pada jarak
 * sentuh — tetap dalam jangkauan, dan jauh lebih enak dilihat.
 */
export function desiredGap(fighter, target) {
  const contact = fighter.radius + target.radius;

  if (!fighter.ranged) {
    return contact + fighter.stats.range * 0.35;
  }

  // Ranged menahan jarak di 72-92% jangkauannya. Angka ini harus cukup besar
  // untuk melampaui jangkauan melee terpanjang (Spear), kalau tidak senjata
  // jarak jauh kehilangan satu-satunya keunggulannya dan selalu kalah.
  // Harganya dibayar lewat damage falloff di COMBAT.rangedFalloff.
  const caution = 1 - fighter.stats.aggression;
  return Math.max(
    contact + 24,
    fighter.stats.range * (0.72 + 0.2 * caution),
  );
}

/** Menjauh dari tepi arena. Tanpa ini, fighter menempel di dinding. */
function wallAvoidance(fighter) {
  const m = ARENA.wallMargin;
  const { x, y } = fighter.pos;
  let fx = 0;
  let fy = 0;

  if (x < m) fx += (m - x) / m;
  if (x > ARENA.width - m) fx -= (x - (ARENA.width - m)) / m;
  if (y < m) fy += (m - y) / m;
  if (y > ARENA.height - m) fy -= (y - (ARENA.height - m)) / m;

  if (fx === 0 && fy === 0) return null;
  return steerTowards(fighter, V.normalize({ x: fx, y: fy }), Math.min(1, Math.hypot(fx, fy)));
}

/**
 * Menjaga jarak dari fighter lain.
 *
 * Target sendiri DIKECUALIKAN sepenuhnya, bukan sekadar diberi bobot kecil.
 *
 * Alasannya khas steering ala Reynolds dan mudah terlewat: besarnya gaya
 * bergantung pada selisih (desired - velocity). Perilaku yang sudah tercapai
 * menghasilkan gaya mendekati nol, sedangkan perilaku yang berlawanan arah
 * menghasilkan gaya maksimum. Jadi separation berbobot 0.15 pun tetap bisa
 * mengalahkan seek berbobot 1.0 ketika si fighter sudah melaju ke arah target.
 * Efeknya: melee mengambang di jarak sedikit di luar jangkauan seranganya dan
 * nyaris tidak pernah memukul (terukur: hanya 2% waktu berada dalam jangkauan).
 */
function separation(fighter, fighters, target) {
  let sx = 0;
  let sy = 0;
  let count = 0;

  for (const other of fighters.values()) {
    if (other === fighter || other === target || !isAlive(other)) continue;

    const threshold = (fighter.radius + other.radius) * STEERING.separationRadius;
    const d = V.dist(fighter.pos, other.pos);
    if (d >= threshold || d < 1e-4) continue;

    const push = (threshold - d) / threshold;
    sx += ((fighter.pos.x - other.pos.x) / d) * push;
    sy += ((fighter.pos.y - other.pos.y) / d) * push;
    count++;
  }

  if (!count) return null;
  return steerTowards(fighter, V.normalize({ x: sx, y: sy }), Math.min(1, Math.hypot(sx, sy)));
}

/** Gerak bebas saat tidak ada target — bola tidak pernah benar-benar diam. */
function wander(fighter, rng, dt) {
  fighter.wanderAngle += (rng.next() - 0.5) * STEERING.wanderJitter * dt * 6;
  return steerTowards(fighter, V.fromAngle(fighter.wanderAngle), 0.55);
}

/**
 * Perilaku tempur: maju, mundur, atau mengitari.
 *
 * Tiga zona:
 *   jauh  -> SEEK  (kecepatan penuh)
 *   dekat -> BACK OFF (mundur; ini yang bikin ranged terlihat "kiting")
 *   pas   -> ORBIT (bergerak menyamping)
 *
 * Zona ORBIT adalah kunci rasa "immersif": tanpa itu, dua melee akan berhenti
 * total begitu bersentuhan dan pertarungan terlihat seperti dua bola macet.
 */
function engage(fighter, target, losBlocked) {
  const toTarget = V.sub(target.pos, fighter.pos);
  const d = V.len(toTarget);
  if (d < 1e-4) return null;

  const dir = V.scale(toTarget, 1 / d);
  const gap = desiredGap(fighter, target);
  const dead = STEERING.distanceDeadzone;

  const orbit = V.scale(V.perp(dir), fighter.orbitDir);

  // Ranged dengan garis pandang terhalang: mencari sudut tembak.
  //
  // Gerakannya dominan menyamping dengan sedikit merapat — persis yang
  // dilakukan orang saat batu menghalangi pandangan. Menjaga jarak di sini
  // justru salah: makin jauh, makin besar peluang batu menutupi target.
  if (losBlocked) {
    const around = V.normalize({
      x: dir.x * 0.55 + orbit.x,
      y: dir.y * 0.55 + orbit.y,
    });
    return { force: steerTowards(fighter, around), weight: W.kite };
  }

  if (d > gap + dead) {
    const urgency = Math.min(1, (d - gap) / 140);
    const blend = V.normalize({
      x: dir.x + orbit.x * 0.25 * (1 - urgency),
      y: dir.y + orbit.y * 0.25 * (1 - urgency),
    });
    return { force: steerTowards(fighter, blend), weight: W.seek };
  }

  if (d < gap - dead) {
    // Mundur sambil tetap menyamping supaya tidak terjebak di dinding.
    const away = V.normalize({
      x: -dir.x + orbit.x * 0.55,
      y: -dir.y + orbit.y * 0.55,
    });
    return { force: steerTowards(fighter, away, 0.9), weight: W.kite };
  }

  return { force: steerTowards(fighter, orbit, 0.75), weight: W.orbit };
}

/** Kabur: menjauhi ancaman terdekat, bukan cuma target. */
function flee(fighter, fighters) {
  let nearest = null;
  let nearestD = Infinity;

  for (const other of fighters.values()) {
    if (other === fighter || !isAlive(other) || !isEnemy(fighter, other)) continue;
    const d = V.dist(fighter.pos, other.pos);
    if (d < nearestD) {
      nearestD = d;
      nearest = other;
    }
  }
  if (!nearest) return null;

  const away = V.normalize(V.sub(fighter.pos, nearest.pos));
  // Sedikit condong ke pusat arena supaya tidak lari ke pojok dan terpojok.
  const toCenter = V.normalize(
    V.sub({ x: ARENA.width / 2, y: ARENA.height / 2 }, fighter.pos),
  );
  const dir = V.normalize({
    x: away.x + toCenter.x * 0.35,
    y: away.y + toCenter.y * 0.35,
  });
  // 0.92, bukan 1.0: petarung yang sekarat sedikit lebih lambat, sehingga
  // pengejar dengan kecepatan setara masih punya peluang menyusul.
  return steerTowards(fighter, dir, 0.92);
}

/** Ancaman terdekat yang masih hidup dan bermusuhan. */
function nearestThreat(fighter, fighters) {
  let nearest = null;
  let nearestD = Infinity;
  for (const other of fighters.values()) {
    if (other === fighter || !isAlive(other) || !isEnemy(fighter, other)) continue;
    const d = V.dist(fighter.pos, other.pos);
    if (d < nearestD) {
      nearestD = d;
      nearest = other;
    }
  }
  return { threat: nearest, distance: nearestD };
}

/**
 * Perkiraan detik sampai `target` tumbang oleh `attacker`.
 * Kasar — mengabaikan regen, kritikal, dan waktu tempuh — tapi cukup untuk
 * membandingkan dua sisi dengan rumus yang sama.
 */
function timeToKill(attacker, target) {
  const mitigation = 100 / (100 + target.stats.def);
  const dps = attacker.rawDps * mitigation;
  return dps > 0.001 ? target.hp / dps : Infinity;
}

/**
 * Keputusan kabur.
 *
 * Versi lama memakai ambang HP absolut: "HP di bawah X persen, lari." Itu
 * menghasilkan kebuntuan yang jelas begitu terlihat — dua petarung sekarat
 * sama-sama diperintahkan lari, tidak ada yang menyerang, dan pertandingan
 * membeku sampai zona menghabisi keduanya. Terukur: 19.2% waktu petarung
 * habis untuk kabur, dengan 118 detik (dari 200 match) di mana SEMUA yang
 * hidup kabur bersamaan.
 *
 * Sekarang pertanyaannya bukan "apakah HP-ku rendah" melainkan
 * "APAKAH AKU AKAN MATI DULUAN". Perbandingan itu tidak bisa membeku, karena
 * secara definisi hanya satu pihak yang bisa kalah balapan.
 *
 * Kenapa bukan sekadar membandingkan HP (yang lebih rendah kabur)?
 * Karena HP saja menyesatkan. Berserker ber-HP 30 dengan 80 DPS melawan
 * Cleric ber-HP 60 dengan 15 DPS akan diperintahkan kabur oleh perbandingan
 * HP — padahal ia membunuh dalam 0.8 detik dan baru mati dalam 4 detik.
 * Ia seharusnya menyerang, dan perbandingan balapan memberitahu itu.
 *
 * Dua pengaman tambahan:
 *   - Tidak bisa lari dari yang lebih cepat -> berbalik melawan (last stand).
 *     Ini sekaligus menghapus kejar-kejaran panjang yang membosankan.
 *   - Kabur punya batas waktu dan jeda, jadi tidak ada yang lari selamanya.
 */
function updateFleeState(fighter, fighters, dt) {
  fighter.fleeCooldown = Math.max(0, fighter.fleeCooldown - dt);

  const wasFleeing = fighter.state === FighterState.FLEEING;

  if (wasFleeing) {
    fighter.fleeTimer += dt;
    if (fighter.fleeTimer > AI.maxFleeDuration) {
      fighter.state = FighterState.ACTIVE;
      fighter.fleeTimer = 0;
      fighter.fleeCooldown = AI.fleeCooldown;
      return false;
    }
  }

  const ratio = hpRatio(fighter);
  // Histeresis: sudah terlanjur kabur boleh bertahan sedikit lebih lama.
  const threshold =
    AI.fleeThreshold(fighter.stats.courage) + (wasFleeing ? 0.12 : 0);

  if (ratio > threshold || (!wasFleeing && fighter.fleeCooldown > 0)) {
    if (wasFleeing) {
      fighter.state = FighterState.ACTIVE;
      fighter.fleeTimer = 0;
    }
    return false;
  }

  const { threat, distance } = nearestThreat(fighter, fighters);

  // Tidak ada yang mengancam, atau ancamannya masih jauh: tidak perlu lari.
  if (!threat || distance > AI.fleeThreatRange) {
    if (wasFleeing) {
      fighter.state = FighterState.ACTIVE;
      fighter.fleeTimer = 0;
    }
    return false;
  }

  const myTimeLeft = timeToKill(threat, fighter);
  const hisTimeLeft = timeToKill(fighter, threat);
  const losingRace = myTimeLeft < hisTimeLeft * AI.fleeMargin(fighter.stats.courage);

  const canEscape =
    fighter.stats.spd > threat.stats.spd * AI.escapeSpeedRatio;

  const shouldFlee = losingRace && canEscape;

  if (shouldFlee && !wasFleeing) {
    fighter.state = FighterState.FLEEING;
    fighter.fleeTimer = 0;
  } else if (!shouldFlee && wasFleeing) {
    fighter.state = FighterState.ACTIVE;
    fighter.fleeTimer = 0;
    fighter.fleeCooldown = AI.fleeCooldown;
  }

  return fighter.state === FighterState.FLEEING;
}

/**
 * Kembali ke dalam zona aman.
 *
 * Diberi bobot tertinggi dan mulai bekerja sedikit SEBELUM tepi zona
 * (`0.86 * radius`), supaya fighter tidak baru bereaksi setelah mulai
 * kehilangan HP. Antisipasi ini yang membuat gerakannya terlihat seperti
 * keputusan, bukan seperti reaksi panik.
 *
 * @param {{ x:number, y:number, radius:number }} zone
 */
function zoneReturn(fighter, zone) {
  const toCenter = V.sub(zone, fighter.pos);
  const d = V.len(toCenter);
  const safe = zone.radius * 0.86;
  if (d < safe) return null;

  const urgency = Math.min(1, (d - safe) / Math.max(zone.radius * 0.3, 40));
  return {
    force: steerTowards(fighter, V.normalize(toCenter)),
    urgency,
  };
}

/**
 * Menghindari batu.
 *
 * Bobotnya sengaja lebih rendah dari dinding: menabrak batu tidak fatal dan
 * kadang justru menguntungkan (memantul menjauh dari kerumunan). Yang ingin
 * dicegah cuma satu — bola menggesek batu terus-menerus sambil mencoba
 * menembusnya.
 */
function obstacleAvoidance(fighter, obstacles) {
  let sx = 0;
  let sy = 0;
  let count = 0;

  for (const o of obstacles) {
    if (o.destroyed) continue;

    const threshold = o.radius * OBSTACLE.avoidRadius + fighter.radius;
    const d = V.dist(fighter.pos, o.pos);
    if (d >= threshold || d < 1e-4) continue;

    const push = (threshold - d) / threshold;
    sx += ((fighter.pos.x - o.pos.x) / d) * push;
    sy += ((fighter.pos.y - o.pos.y) / d) * push;
    count++;
  }

  if (!count) return null;
  return steerTowards(
    fighter,
    V.normalize({ x: sx, y: sy }),
    Math.min(1, Math.hypot(sx, sy)),
  );
}

/**
 * Entry point per-fighter. Mengisi `fighter.force`, tidak menyentuh posisi.
 * Integrasi posisi ada di physics.js — pemisahan ini membuat urutan
 * force -> integrate -> collide selalu jelas.
 *
 * @param {{ zone: {x:number,y:number,radius:number}, obstacles: Array }} world
 */
export function computeSteering(fighter, fighters, rng, dt, world = {}) {
  fighter.force.x = 0;
  fighter.force.y = 0;

  // Fighter yang sedang terpental tidak bisa mengendalikan dirinya.
  // Inilah yang membuat knockback terasa nyata dan bukan sekadar animasi.
  if (!canSteer(fighter)) return null;

  const { zone, obstacles } = world;
  const target = selectTarget(fighter, fighters, dt);
  const fleeing = updateFleeState(fighter, fighters, dt);

  // Cek garis pandang hanya untuk yang memang butuh: petarung ranged yang
  // sedang menyerang. Melee tidak peduli, dan yang sedang kabur juga tidak.
  const losBlocked =
    !fleeing &&
    target &&
    fighter.ranged &&
    obstacles?.length > 0 &&
    !hasLineOfSight(fighter.pos, target.pos, obstacles);

  if (fleeing) {
    const f = flee(fighter, fighters);
    if (f) applyForce(fighter, f, W.flee);
  } else if (target) {
    const result = engage(fighter, target, losBlocked);
    if (result) applyForce(fighter, result.force, result.weight);
  } else {
    applyForce(fighter, wander(fighter, rng, dt), W.wander);
  }

  const sep = separation(fighter, fighters, target);
  if (sep) applyForce(fighter, sep, W.separation);

  const wall = wallAvoidance(fighter);
  if (wall) applyForce(fighter, wall, W.wall);

  if (obstacles?.length) {
    const rock = obstacleAvoidance(fighter, obstacles);
    if (rock) applyForce(fighter, rock, W.obstacle);
  }

  // Arah hadap: ke target kalau ada, kalau tidak ke arah gerak. Dipakai
  // renderer untuk mengarahkan senjata — tanpa ini pedang menghadap ke arah
  // acak dan langsung terbaca sebagai salah.
  if (target) {
    fighter.aimAngle = Math.atan2(
      target.pos.y - fighter.pos.y,
      target.pos.x - fighter.pos.x,
    );
  } else if (Math.hypot(fighter.vel.x, fighter.vel.y) > 8) {
    fighter.aimAngle = Math.atan2(fighter.vel.y, fighter.vel.x);
  }

  if (zone) {
    const zoneForce = zoneReturn(fighter, zone);
    if (zoneForce) {
      applyForce(fighter, zoneForce.force, W.zone * (0.4 + zoneForce.urgency));
    }
  }

  return target;
}
