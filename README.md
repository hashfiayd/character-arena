# Character Arena

Spinwheel untuk merakit karakter fantasy RPG, lalu mengadu mereka sebagai bola
berfisika di arena — dengan knockback, kabur, kiting, tumbukan antar bola,
dan batu penghalang yang bisa dihancurkan.

Sepuluh putaran membentuk satu karakter: Ras, Kelas, empat atribut bertingkat,
lalu Senjata, Zirah, Sifat, dan Berkah. Ras dan Kelas tidak cuma memberi stat —
keduanya mengubah **lebar potongan** di roda-roda sesudahnya.

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
│  ├─ weights.js       Bobot roda: affinity (tier) + gearBias (tag)
│  └─ character.js     Agregat Character, hidrasi picks -> stat
│
├─ data/            Seluruh "isi" game.
│  └─ pools.js         10 slot x pilihan, modifier, efek, bias. Ganti file ini
│                      untuk mengganti tema tanpa menyentuh engine.
│
├─ engine/          Simulasi. Framework-agnostic, deterministik dari seed.
│  ├─ constants.js     SEMUA angka tuning ada di sini
│  ├─ fighter.js       State runtime (beda dari Character yang persisten)
│  ├─ steering.js      AI: seek / kite / orbit / flee / separation / zone / batu
│  ├─ physics.js       Integrasi, tumbukan berbasis impuls, pantulan dinding
│  ├─ obstacles.js     Batu: pembangkitan, tumbukan statis, garis pandang
│  ├─ combat.js        Damage, knockback, stagger, efek boon, LOS
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

## Roda berbobot: kenapa potongannya tidak sama besar

Bobot sebuah pilihan bukan konstanta — ia dihitung dari pilihan yang sudah
keluar sebelumnya (`domain/weights.js`). Dua mekanisme:

| Mekanisme  | Untuk apa                    | Bentuk data                        |
|------------|------------------------------|------------------------------------|
| `affinity` | Roda atribut bertingkat      | `{ might: +2, agility: -1 }`       |
| `gearBias` | Roda Senjata / Zirah / Berkah | `{ heavy: 2.2, ranged: 0.35 }`    |

`affinity` menggeser distribusi tier: `weight = base * 2^(affinity * (rank-2)/2)`.
`gearBias` bekerja per **tag**, bukan per id — jadi kamu bisa menambah senjata
baru bertag `heavy` dan semua bias yang sudah ada langsung berlaku tanpa
menyentuh satu pun definisi ras.

Efeknya terukur (dari `npm run sim`):

```
Peluang tier Kekuatan     Rapuh  Lemah  Biasa   Kuat  Legendaris
  Orc   (might +2)         3.0%  11.9%  27.8%  31.8%      25.4%
  Human (netral)          13.9%  27.8%  32.4%  18.5%       7.4%
  Fae   (might 0)         13.9%  27.8%  32.4%  18.5%       7.4%

Peluang senjata   Greataxe  Warhammer  Longbow  Tangan Kosong
  Goliath              29%        29%       2%             6%
  Fae                   2%         2%      15%            27%
```

Dua aturan yang dipegang:

1. **Lebar potongan = peluang sebenarnya.** Bobot yang sama persis dipakai
   untuk menggambar roda dan untuk mengundi (dilewatkan lewat prop `weights`).
   Roda yang potongannya seragam tapi diam-diam berbobot timpang itu menipu
   pemain, dan bikin balancing mustahil dijelaskan.
2. **Bias tidak pernah menjamin.** Orc tetap bisa apes dan dapat Kekuatan
   "Rapuh" (3% peluang). Kalau ras menjamin hasil, tidak ada lagi taruhannya.

Slot Senjata, Zirah, dan Berkah punya opsi "tidak dapat" (Tangan Kosong, Tanpa
Zirah, Tidak Ada). Semuanya tetap bisa bertanding — Tangan Kosong memukul cepat
dengan damage kecil — tapi jelas paling lemah (win rate ~2%).

---

## Batu penghalang

Batu punya tiga peran, dan ketiganya mengubah taktik:

1. **Benda padat** — bola memantul; massanya dianggap tak hingga.
2. **Bahaya** — terlempar menghantam batu memberi damage tambahan. Ini yang
   membuat knockback punya konteks ruang: mendorong lawan ke tanah lapang cuma
   memberi jarak, mendorongnya ke batu memberi damage.
3. **Perlindungan** — memblokir garis pandang serangan jarak jauh.

Peran ketiga adalah perubahan balance terbesar sejak arena dibuat. Sebelumnya
senjata ranged menang lewat menjaga jarak tanpa risiko; sekarang jarak saja
tidak cukup, harus jarak **dengan garis pandang bersih**. AI ranged yang
terhalang akan bergerak menyamping mencari sudut tembak alih-alih menembak ke
batu.

Batu bisa hancur (retakannya bertambah seiring kerusakan), dan bentuk
visualnya poligon tidak beraturan sementara tumbukannya tetap lingkaran —
selisihnya beberapa piksel, tapi menghemat banyak kerumitan dan menghindari
bug bola nyangkut di sudut cekung.

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

## Empat bug yang ditemukan lewat simulasi headless

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

**4. Senjata ber-DPS tertinggi kedua yang tidak pernah menang.** Setelah slot
"tidak dapat senjata" ditambahkan, Tangan Kosong tercatat **0.3% win rate
padahal DPS-nya nomor dua dari sembilan senjata**. Penyebabnya bukan damage
tapi jangkauan: jarak kontak dua bola ~41 unit sementara jangkauan efektifnya
cuma 49, jadi jendela untuk memukul lebarnya 8 unit — dan restitusi tumbukan
melempar bola keluar dari jendela itu tiap benturan. Menaikkan damage dua kali
sama sekali tidak menolong; yang menolong adalah menambah 10 unit jangkauan.

Aturan yang lahir dari sini, dan sudah ditulis di `data/pools.js`: **senjata
melee baru harus punya jangkauan efektif setidaknya ~18 unit di atas titik
kontak.** Lebih sempit dari itu, berapa pun DPS-nya, senjatanya mati.

Keempatnya mustahil terlihat dengan menonton satu pertandingan.

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
| `OBSTACLE.countRange`          | Padat-jarangnya batu — makin padat, makin lemah ranged |
| `OBSTACLE.fighterDamageFactor` | Damage saat terlempar ke batu                     |

Untuk bias roda, angka-angkanya ada di `data/pools.js` (`affinity`, `gearBias`)
dan kekuatan pergeserannya di `domain/weights.js` (`TIER_BIAS`).

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
  dengan bergerak, dan panah nyasar bisa merusak batu) tapi butuh entitas baru
  di engine.
- **Batu hanya rusak oleh benturan fisik**, bukan oleh serangan. Serangan yang
  terhalang sekadar tidak terjadi. Membuat serangan nyasar merusak batu akan
  lebih intuitif, tapi butuh proyektil lebih dulu.
- **Tumbukan batu memakai lingkaran** meski digambar sebagai poligon.
- **Deteksi tumbukan discrete.** Pada kecepatan sangat tinggi bola teoretis
  bisa tembus. `PHYSICS.maxSpeed` dan fixed timestep menahannya di praktik;
  kalau kamu menaikkan `maxSpeed` jauh, pertimbangkan swept collision.
- **Tumbukan O(n²).** Aman sampai belasan bola. Untuk ratusan, butuh spatial hash.
- **Belum ada unit test.** Lapisan `domain/` dan `engine/` sudah pure sehingga
  siap di-test; `npm run sim` saat ini berperan sebagai regression test kasar.
- **Storage pakai localStorage**, jadi roster terikat ke satu browser.
  Repository-nya sudah diisolasi di `src/storage/` kalau nanti mau pindah ke
  Firebase.
