# Character Arena

Spinwheel untuk merakit karakter fantasy RPG, lalu mengadu mereka sebagai bola
berfisika di arena — dengan knockback, kabur, kiting, dan tumbukan antar bola.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run sim      # analisis balance headless (lihat bagian bawah)
```

---

## Arsitektur

Aturan utamanya satu: **engine tidak boleh tahu apa-apa soal React, canvas, atau
storage.** Semua yang ada di `src/engine` dan `src/domain` adalah JavaScript
biasa yang bisa dijalankan di Node tanpa DOM. Itulah yang membuat `npm run sim`
mungkin — dan `npm run sim` yang menemukan tiga bug serius selama pengembangan.

```
src/
├─ domain/          Aturan murni. Tidak punya dependensi ke mana pun.
│  ├─ stats.js         Model stat, penggabungan modifier, clamp, power score
│  └─ character.js     Agregat Character, hidrasi picks -> stat
│
├─ data/            Seluruh "isi" game.
│  └─ pools.js         6 slot x pilihan, modifier, efek. Ganti file ini
│                      untuk mengganti tema tanpa menyentuh engine.
│
├─ engine/          Simulasi. Framework-agnostic, deterministik dari seed.
│  ├─ constants.js     SEMUA angka tuning ada di sini
│  ├─ fighter.js       State runtime (beda dari Character yang persisten)
│  ├─ steering.js      AI: seek / kite / orbit / flee / separation / zone
│  ├─ physics.js       Integrasi, tumbukan berbasis impuls, pantulan dinding
│  ├─ combat.js        Damage, knockback, stagger, efek boon
│  └─ simulation.js    Orkestrator + kondisi menang + zona menyusut
│
├─ storage/         Satu-satunya yang menyentuh localStorage
├─ hooks/           Jembatan React <-> domain
├─ features/        UI per fitur (spinwheel, roster, arena)
├─ ui/              Primitif visual
└─ lib/             Vektor 2D, seeded RNG
```

### Kenapa Character dan Fighter dipisah

`Character` adalah data persisten: nama, warna, dan **daftar id pilihan** —
bukan stat yang sudah jadi. `Fighter` adalah state runtime yang berubah 60x per
detik: posisi, kecepatan, HP, cooldown.

Konsekuensi yang disengaja: stat selalu dihitung ulang dari `data/pools.js`.
Kalau kamu me-rebalance angka, seluruh roster lama ikut ter-rebalance. Kalau
stat di-snapshot ke storage, karakter lama akan membeku di balance versi lama.

---

## Bagaimana gerakannya dibuat "hidup"

### Steering, bukan pathfinding

Tiap bola memakai model **Craig Reynolds steering**: setiap perilaku
menghasilkan *desired velocity*, lalu gaya = `desired - velocity_sekarang`,
dibatasi `maxForce`. Beberapa perilaku aktif bersamaan dan dijumlahkan dengan
bobot, sehingga satu bola bisa mengejar target **sambil** menjauhi bola lain
**sambil** menghindari dinding, tanpa satu pun state machine kaku.

Perilaku yang ada:

| Perilaku      | Kapan aktif                                | Efek yang terlihat        |
|---------------|--------------------------------------------|---------------------------|
| `seek`        | Jarak ke target > jarak ideal               | Mengejar                  |
| `kite`        | Jarak < jarak ideal                         | Mundur (khas ranged)      |
| `orbit`       | Jarak pas                                   | Mengitari lawan           |
| `flee`        | HP di bawah ambang (dari stat `courage`)    | Kabur, garis putus kuning |
| `separation`  | Ada bola lain terlalu dekat                 | Tidak menggumpal          |
| `wallAvoid`   | Dekat tepi arena                            | Tidak menempel dinding    |
| `zoneReturn`  | Di luar / mendekati tepi zona aman          | Balik ke tengah           |

### Kenapa knockback terasa nyata

Saat terkena serangan, target mendapat **impuls** (dibagi massanya) *dan*
`staggerTimer`. Selama stagger, `computeSteering` langsung return — bola benar-benar
kehilangan kendali dan hanya meluncur mengikuti fisika. Itu bedanya dengan
sekadar animasi dorongan.

Massa punya konsekuensi berantai yang konsisten:
massa besar → radius besar → target lebih gampang kena, tapi jauh lebih susah
didorong, dan saat menabrak bola ringan justru melontarkannya. Semua ini keluar
dari satu rumus tumbukan lenting sebagian yang sama:

```
j = -(1 + restitution) * v_relatif_normal / (1/m1 + 1/m2)
```

---

## Tiga bug yang ditemukan lewat simulasi headless

Ini bagian yang paling berguna untuk dipahami sebelum kamu mengubah engine.

**1. Zombie ber-HP nol.** `applyKnockback` dipanggil setelah `applyDamage`, dan
ia menimpa `state = DEAD` menjadi `STAGGERED`. Pukulan mematikan langsung
"menghidupkan kembali" korbannya di HP 0. Akibatnya tidak ada yang pernah mati
karena pertarungan — satu-satunya pembunuh adalah zona. Gejalanya sangat halus:
semua senjata terlihat punya total damage identik, karena semuanya mentok di
`maxHp` lawan.

**2. Jarak ideal yang mustahil dicapai.** Jarak ideal melee dihitung dari
`range` saja (misal 15 unit), padahal dua bola tidak mungkin lebih dekat dari
jumlah radiusnya (~41 unit). AI karenanya selalu berada di mode kejar dengan
kecepatan penuh, menyeruduk, terpental, dan mengulanginya. Terukur: melee hanya
**1-2%** waktu berada dalam jangkauan serangnya sendiri. Sekarang jarak ideal
dipatok relatif terhadap titik kontak, dan melee mengitari lawan.

**3. Separation mengalahkan seek meski bobotnya 1/6.** Di steering Reynolds,
besarnya gaya bergantung pada selisih `desired - velocity`. Perilaku yang sudah
tercapai menghasilkan gaya ~0, sedangkan perilaku berlawanan arah menghasilkan
gaya maksimum. Jadi separation berbobot 0.15 tetap bisa mengalahkan seek
berbobot 1.0. Solusinya: target sendiri dikecualikan total dari separation,
bukan sekadar diberi bobot kecil.

Ketiganya mustahil terlihat dengan menonton satu pertandingan.

---

## Menyetel balance

```bash
npm run sim -- --matches 600 --mode ffa --count 6
npm run sim -- --matches 400 --mode duel
npm run sim -- --matches 400 --mode team --count 6
```

Outputnya: durasi rata-rata, jumlah seri, anomali (NaN / match tidak selesai),
dan win rate tiap opsi terhadap baseline. Opsi yang menyimpang lebih dari ~55%
dari baseline ditandai otomatis.

Yang perlu diperhatikan saat membaca hasilnya:

- **Durasi rata-rata mendekati `SIM.softTimeLimit`** berarti mayoritas match
  berakhir di sudden death, bukan di pertarungan. Itu sinyal TTK kepanjangan.
- **Win rate tidak akan pernah rata.** Target realistisnya sekitar
  ±5 poin dari baseline, bukan nol. Beberapa opsi memang sengaja dibuat sebagai
  kutukan (`boon:hollow`).
- **Duel dan FFA memberi jawaban berbeda.** Senjata dengan knockback besar jauh
  lebih kuat di FFA (mendorong lawan keluar zona) daripada di duel.

Titik tuning utama ada di `src/engine/constants.js`. Beberapa yang paling
berpengaruh:

| Konstanta                      | Efek                                              |
|--------------------------------|---------------------------------------------------|
| `PHYSICS.restitution`          | Seberapa memantul tumbukan antar bola             |
| `COMBAT.baseKnockback`         | Kekuatan dorongan dasar                           |
| `COMBAT.maxStagger`            | Seberapa lama korban kehilangan kendali           |
| `COMBAT.rangedFalloff`         | Hukuman damage untuk menembak dari jarak maksimum |
| `AI.fleeThreshold`             | Kapan karakter mulai kabur                        |
| `STEERING.weights`             | "Kepribadian" seluruh arena                       |
| `ZONE.*`                       | Tekanan yang memaksa pertarungan terjadi          |

### Kenapa ada zona menyusut

Bukan sekadar meniru battle royale. Tanpa zona, FFA punya masalah teori
permainan yang serius: bertahan hidup sudah cukup untuk menang, jadi strategi
optimal adalah menghindari semua orang. Terukur: `trait:coward` mencapai win
rate 27% terhadap baseline 16.7%, dan hampir semua match berakhir di sudden
death. Zona mengembalikan penentuan pemenang ke pertarungan.

---

## Menambah konten

Menambah Race/Class/Weapon/Armor/Trait/Boon cukup di `src/data/pools.js`. UI,
roda, dan engine akan otomatis menyesuaikan.

Menambah **efek baru** butuh dua langkah:

1. Tambahkan id-nya di `EFFECT_IDS` (`src/data/pools.js`)
2. Tambahkan handler-nya di `src/engine/combat.js`

Kalau langkah 2 terlewat, efeknya diam-diam tidak melakukan apa-apa — tidak ada
error yang muncul.

---

## Batasan yang diketahui

- **Serangan ranged bersifat hitscan**, bukan proyektil. Tracer-nya visual saja.
  Menjadikannya proyektil akan menambah kedalaman (bisa meleset, bisa dihindari
  dengan bergerak) tapi butuh entitas baru di engine.
- **Deteksi tumbukan discrete.** Pada kecepatan sangat tinggi bola teoretis
  bisa tembus. `PHYSICS.maxSpeed` dan fixed timestep menahannya di praktik;
  kalau kamu menaikkan `maxSpeed` jauh, pertimbangkan swept collision.
- **Tumbukan O(n²).** Aman sampai belasan bola. Untuk ratusan, butuh spatial hash.
- **Belum ada unit test.** Lapisan `domain/` dan `engine/` sudah pure sehingga
  siap di-test; `npm run sim` saat ini berperan sebagai regression test kasar.
- **Storage pakai localStorage**, jadi roster terikat ke satu browser.
  Repository-nya sudah diisolasi di `src/storage/` kalau nanti mau pindah ke
  Firebase.
