/**
 * Tuning knob untuk seluruh engine.
 *
 * Semua "angka ajaib" dikumpulkan di sini supaya kamu bisa mengubah rasa
 * permainan tanpa membaca ulang logika fisika. Kalau kamu menemukan angka
 * telanjang di file engine lain, itu bug arsitektural — pindahkan ke sini.
 */

export const ARENA = {
  width: 960,
  height: 600,
  /** Ketebalan zona di tepi tempat AI mulai didorong balik ke tengah. */
  wallMargin: 70,
};

export const SIM = {
  /**
   * Fixed timestep. Fisika WAJIB dijalankan dengan dt tetap; kalau dt ikut
   * fluktuasi frame rate, hasil tumbukan jadi tidak deterministik dan bisa
   * "tembus" saat frame drop.
   */
  dt: 1 / 60,
  /** Batas akumulator supaya tab yang di-background tidak memicu spiral of death. */
  maxStepsPerFrame: 5,
  /** Batas durasi pertandingan (detik) sebelum sudden death. */
  softTimeLimit: 45,
  /** Setelah ini, semua fighter kehilangan HP terus-menerus supaya match selesai. */
  hardTimeLimit: 70,
  /**
   * Harus lebih besar dari regen maksimum (clamp regen = 25/detik), kalau tidak
   * build full-regen bisa bertahan tanpa batas dan sudden death jadi percuma.
   */
  suddenDeathDps: 22,
};

export const PHYSICS = {
  /** Gesekan udara per detik. 0.86 = kehilangan 14% kecepatan tiap detik. */
  linearDamping: 0.86,
  /**
   * Restitusi tumbukan bola-vs-bola. > 0.5 supaya benturan terasa "memantul",
   * bukan saling menempel — ini permintaan utama dari desainnya.
   */
  restitution: 0.82,
  /** Restitusi terhadap dinding arena. */
  wallRestitution: 0.7,
  /** Seberapa agresif overlap dikoreksi per step (0..1). */
  positionalCorrection: 0.6,
  /** Overlap sekecil ini dibiarkan, mencegah jitter. */
  slop: 0.4,
  /** Damage dari tabrakan fisik keras (bukan serangan). */
  ramDamageFactor: 0.035,
  ramMinSpeed: 260,
  /** Kecepatan maksimum absolut, mencegah ledakan numerik. */
  maxSpeed: 900,
};

/**
 * Zona aman yang menyusut.
 *
 * Ini bukan hiasan, tapi perbaikan struktural.
 * Tanpa zona, arena FFA punya masalah teori permainan: bertahan hidup sudah
 * cukup untuk menang, sehingga strategi optimal adalah menghindari semua orang.
 * Di uji headless, `trait:coward` mencapai win rate 27% (baseline 16.7%) dan
 * hampir semua match berakhir di sudden death, bukan di pertarungan. Zona yang
 * menyusut memaksa jarak antar petarung mengecil sehingga bentrokan pasti
 * terjadi — dan pemenangnya kembali ditentukan oleh build, bukan oleh siapa
 * yang paling pandai kabur.
 */
export const ZONE = {
  /** Detik pertama tanpa tekanan — memberi ruang untuk manuver pembuka. */
  startTime: 10,
  /** Lama penyusutan dari radius penuh ke radius akhir. */
  shrinkDuration: 34,
  /** Radius akhir dalam unit arena. Cukup sempit untuk memaksa kontak. */
  finalRadius: 115,
  /** Damage per detik untuk yang berada di luar zona. */
  dps: 15,
  /** Damage di luar zona naik seiring waktu supaya match pasti selesai. */
  dpsRamp: 0.4,
};

export const STEERING = {
  /** Gaya dorong maksimum yang bisa dikeluarkan AI (unit/detik^2). */
  maxForce: 900,
  /** Bobot tiap perilaku. Ubah ini untuk mengubah "kepribadian" arena. */
  weights: {
    seek: 1.0,
    kite: 1.35,
    orbit: 0.55,
    flee: 1.6,
    separation: 1.1,
    wall: 2.2,
    wander: 0.35,
    /** Paling tinggi: berada di luar zona selalu lebih buruk dari apa pun. */
    zone: 3.2,
  },
  /** Radius di mana fighter mulai saling menghindar. */
  separationRadius: 1.45,
  /** Kecepatan perubahan arah wander (radian/detik). */
  wanderJitter: 3.2,
  /** Toleransi jarak sebelum AI menganggap perlu maju/mundur. */
  distanceDeadzone: 12,
};

export const COMBAT = {
  /** Variasi damage acak: 0.9x - 1.1x. */
  damageVariance: 0.1,
  /**
   * Damage falloff untuk senjata jarak jauh.
   *
   * Tanpa ini, kiting adalah strategi dominan tanpa risiko: AI ranged menjaga
   * jarak maksimum, melee tidak pernah sampai, dan seluruh pool senjata melee
   * jadi pilihan yang salah. Dengan falloff, menembak dari ujung jangkauan
   * tetap mungkin tapi ada harganya — jadi ada alasan untuk maju.
   */
  rangedFalloff: {
    /** Di bawah rasio jarak ini, damage penuh. */
    startRatio: 0.35,
    /** Pengali damage di jangkauan maksimum. */
    minMultiplier: 0.28,
  },
  /** Impuls dasar knockback sebelum dikalikan stat. */
  baseKnockback: 120,
  /** Bagian knockback yang berasal dari damage yang masuk. */
  knockbackPerDamage: 3.0,
  /** Recoil yang dirasakan penyerang melee — bikin benturan terasa punya berat. */
  attackerRecoil: 0.16,
  /** Durasi kehilangan kendali (detik) per satuan impuls relatif. */
  staggerPerImpulse: 0.0016,
  maxStagger: 0.3,
  /** Kebal sesaat setelah kena, mencegah lawan attackSpeed tinggi mengunci total. */
  invulnAfterHit: 0.06,

  lifestealRatio: 0.28,
  thornsRatio: 0.3,
  burnAuraDps: 5,
  burnAuraRadius: 38,
  secondWindHpRatio: 0.5,
  /** Phase Step: dorongan menjauh saat berhasil menghindar. */
  phaseImpulse: 220,
  /** Frenzy: attackSpeed bertambah maksimum sekian x saat HP mendekati nol. */
  frenzyMaxBonus: 0.9,
  /** Juggernaut: knockback yang diterima dikalikan ini. */
  juggernautKnockbackTaken: 0.35,
};

export const AI = {
  /**
   * Ambang HP untuk kabur, diturunkan dari `courage`.
   * courage 0   -> kabur di bawah 38% HP
   * courage 1   -> praktis tidak pernah kabur
   *
   * Angkanya sengaja tidak tinggi. Saat diuji di 0.55, mode battle royale
   * dimenangkan oleh siapa pun yang paling penakut: semua orang kabur di
   * separuh HP, nyaris tidak ada yang mati, dan match selalu berakhir di
   * sudden death. Kabur harus menunda kekalahan, bukan menjadi strategi menang.
   */
  fleeThreshold: (courage) => 0.38 * (1 - courage),
  /** Seberapa lama target dipertahankan sebelum boleh ganti (detik). */
  targetStickiness: 1.4,
  /** Bonus skor untuk target yang sudah sekarat (fokus api). */
  lowHpTargetBonus: 0.55,
};

/** Status runtime seorang fighter. */
export const FighterState = Object.freeze({
  ACTIVE: 'ACTIVE',
  STAGGERED: 'STAGGERED',
  FLEEING: 'FLEEING',
  DEAD: 'DEAD',
});

/** Mode pertandingan. */
export const BattleMode = Object.freeze({
  FFA: 'ffa',
  DUEL: 'duel',
  TEAM: 'team',
});
