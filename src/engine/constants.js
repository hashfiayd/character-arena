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

/**
 * Ukuran arena mengikuti jumlah peserta.
 *
 * Yang dijaga konstan adalah KEPADATAN, bukan ukuran. Delapan bola di arena
 * seukuran duel bukan cuma sesak secara visual — ia mengubah permainan:
 * separation saling bertabrakan, semua orang selalu dalam jangkauan semua
 * orang, dan senjata berjangkauan jauh kehilangan seluruh keunggulannya.
 * Arena yang ikut tumbuh membuat jarak tetap punya arti berapa pun pesertanya.
 *
 * Rasio 1.6 dipertahankan di semua ukuran supaya tata letak kanvas dan
 * proporsi di layar tidak berubah-ubah.
 */
export function arenaFor(fighterCount) {
  const n = Math.max(2, Math.min(10, fighterCount));
  const width = Math.round(Math.min(1360, 700 + n * 96));
  return {
    width,
    height: Math.round(width / 1.6),
    wallMargin: ARENA.wallMargin,
  };
}

export const SIM = {
  /**
   * Fixed timestep. Fisika WAJIB dijalankan dengan dt tetap; kalau dt ikut
   * fluktuasi frame rate, hasil tumbukan jadi tidak deterministik dan bisa
   * "tembus" saat frame drop.
   */
  dt: 1 / 60,
  /** Batas akumulator supaya tab yang di-background tidak memicu spiral of death. */
  maxStepsPerFrame: 5,

  /**
   * Jeda setelah pukulan terakhir sebelum hasil diumumkan.
   *
   * Tanpa ini, layar pemenang muncul di frame yang sama dengan pukulan
   * mematikan — ledakan partikelnya, mayat yang terpental, dan siapa saja yang
   * masih berdiri semuanya tertutup sebelum sempat terlihat. Momen paling
   * memuaskan dari sebuah pertandingan justru yang paling cepat dihapus.
   *
   * Selama jeda ini simulasi TETAP berjalan (bola masih bergerak, efek masih
   * memudar) tapi semua sumber damage dimatikan, supaya pemenang tidak mati
   * oleh zona setelah menang.
   */
  outroDuration: 2.6,
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

/**
 * Batu penghalang.
 *
 * Perannya tiga sekaligus, dan ketiganya mengubah taktik:
 *   1. Benda padat  — bola memantul darinya.
 *   2. Bahaya       — terlempar menghantam batu menambah damage.
 *   3. Perlindungan — memblokir garis pandang serangan jarak jauh.
 *
 * Poin ketiga adalah perubahan balance terbesar sejak arena dibuat: sebelum
 * ada batu, senjata ranged menang lewat menjaga jarak tanpa risiko. Sekarang
 * jarak saja tidak cukup — harus jarak DENGAN garis pandang bersih.
 */
export const OBSTACLE = {
  /** Jumlah batu per pertandingan (inklusif). */
  countRange: [4, 8],
  radiusRange: [16, 44],
  /** HP batu = radius * ini. Batu besar jauh lebih awet. */
  hpPerRadius: 3.2,
  /** Pantulan bola dari batu. Sedikit di bawah pantulan antar bola. */
  restitution: 0.75,
  /** Di bawah kecepatan ini, benturan dianggap senggolan biasa. */
  impactMinSpeed: 200,
  /** Bagian kelebihan kecepatan yang jadi damage ke petarung. */
  fighterDamageFactor: 0.05,
  /** ...dan ke batunya. Batu jauh lebih cepat rusak daripada petarung. */
  rockDamageFactor: 0.3,
  /** Jarak bebas minimum dari titik spawn dan dari batu lain. */
  minSpacing: 46,
  /** Radius di mana AI mulai menghindari batu (dikali radius batu). */
  avoidRadius: 1.8,
};

/**
 * Proyektil (busur, chakram). Tongkat sihir sengaja TIDAK memakai ini —
 * itulah yang membedakan keduanya secara mekanik, bukan cuma angka.
 */
export const PROJECTILE = {
  radius: 4,
  trailLength: 8,
  /**
   * Seberapa jauh penembak mengantisipasi gerak target.
   * 0 = membidik posisi sekarang (target bergerak selalu lolos)
   * 1 = bidikan sempurna (tidak pernah meleset, gunanya proyektil hilang)
   */
  leadFactor: 0.45,
  /**
   * Sebaran bidikan dalam radian.
   *
   * Ini pengendali utama tingkat meleset — bukan `leadFactor`. Diukur di
   * simulasi: mengubah leadFactor dari 0.62 ke 0.0 hanya menggeser tingkat
   * kena dari 91.4% ke 89.6%, karena pada jarak tempur biasa waktu terbang
   * panah cuma ~0.17 detik dan target tidak sempat menyingkir. Sudut simpangan
   * bekerja terlepas dari jarak, jadi jauh lebih bisa disetel.
   */
  spread: 0.3,
  /** Proyektil boleh terbang sedikit melewati jangkauan nominal. */
  rangeMultiplier: 1.15,
  /**
   * Evasion dihitung separuh terhadap proyektil.
   * Alasannya: proyektil sudah bisa meleset secara fisik. Menerapkan evasion
   * penuh di atasnya berarti menghukum busur dua kali untuk hal yang sama.
   */
  evasionScale: 0.5,
  /** Damage proyektil ke batu yang tertancap. */
  obstacleDamage: 9,
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
    /** Menghindari batu — sedikit di bawah dinding. */
    obstacle: 1.9,
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
   * Ambang HP untuk MEMPERTIMBANGKAN kabur. Ini cuma gerbang pertama —
   * keputusan sebenarnya dibuat lewat perbandingan siapa mati duluan.
   *
   * courage 0   -> mulai mempertimbangkan di bawah 38% HP
   * courage 1   -> praktis tidak pernah
   */
  fleeThreshold: (courage) => 0.38 * (1 - courage),

  /**
   * Margin "aku kalah balapan".
   *
   * Kabur baru dipilih kalau waktu-sampai-aku-mati lebih pendek dari
   * waktu-sampai-dia-mati DIKALI margin ini. Petarung pemberani butuh selisih
   * yang jauh lebih meyakinkan sebelum mundur.
   *
   * Ini inti perbaikan atas bug "dua-duanya kabur". Ambang HP absolut
   * memerintahkan KEDUA petarung sekarat untuk lari, dan pertarungan membeku —
   * terukur 19.2% waktu petarung habis untuk kabur, dengan 118 detik (dari 200
   * match) di mana semua yang hidup kabur bersamaan.
   *
   * Perbandingan balapan tidak bisa membeku, karena secara definisi hanya
   * salah satu pihak yang bisa kalah balapan.
   */
  fleeMargin: (courage) => 0.9 - courage * 0.45,

  /**
   * Kalau musuh lebih cepat dari ini (relatif terhadap kecepatan kita),
   * kabur cuma berarti mati kelelahan. Lebih baik berbalik dan melawan.
   *
   * Efek sampingnya bagus: kejar-kejaran panjang antara yang lambat dan yang
   * cepat — pemandangan paling membosankan di arena — jadi hilang sendiri.
   */
  escapeSpeedRatio: 0.95,

  /** Kabur maksimal sekian detik sebelum dipaksa berbalik melawan. */
  maxFleeDuration: 3.2,
  /** Setelah berhenti kabur, tidak boleh kabur lagi selama ini. */
  fleeCooldown: 2.5,
  /** Ancaman yang lebih jauh dari ini tidak layak dikaburi. */
  fleeThreatRange: 260,
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
