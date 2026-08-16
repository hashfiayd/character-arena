/**
 * Menerjemahkan event engine menjadi bunyi.
 *
 * Dipisah dari renderer meski keduanya melahap daftar event yang sama.
 * Alasannya: keduanya punya aturan yang berbeda sama sekali. Renderer ingin
 * MENGGAMBAR SEMUANYA — dua puluh percikan sekaligus justru terlihat bagus.
 * Audio sebaliknya harus MEMBUANG sebagian besar; dua puluh benturan yang
 * dibunyikan bersamaan bukan terdengar ramai, tapi terdengar rusak.
 *
 * Pembatasan lajunya sendiri ada di AudioEngine, bukan di sini, supaya aturan
 * "berapa sering bunyi X boleh muncul" tinggal di satu tempat.
 */

export function playBattleEvents(events, audio) {
  if (!audio || !events.length) return;

  for (const e of events) {
    switch (e.type) {
      case 'swing':
        audio.play('swing');
        break;

      // Tongkat sihir: hitscan, jadi bunyinya "mengunci sasaran".
      case 'shot':
        audio.play('cast');
        break;

      // Busur/chakram: proyektil terbang, bunyinya lepasan tali.
      case 'fire':
        audio.play('fire');
        break;

      case 'damage':
        audio.play(e.critical ? 'crit' : 'hit', {
          // Pukulan besar terdengar lebih berat. 60 dipakai sebagai patokan
          // "pukulan berat" karena di sekitar situlah damage senjata dua
          // tangan mendarat.
          strength: Math.min(1, (e.amount ?? 0) / 60),
        });
        break;

      case 'miss':
        audio.play('miss');
        break;

      case 'death':
        audio.play('death');
        break;

      case 'revive':
        audio.play('revive');
        break;

      case 'impact':
        audio.play('impact', { strength: e.strength ?? 0.5 });
        break;

      case 'rockHit':
        audio.play('rock', { strength: e.strength ?? 0.4 });
        break;

      case 'rockShatter':
        audio.play('shatter');
        break;

      case 'suddenDeath':
        audio.play('zone');
        break;

      case 'victory':
        audio.play('victory');
        break;

      // Sengaja dibiarkan diam: 'ember', 'zoneBurn', dan 'phase' muncul
      // berkali-kali per detik dan tidak menandai keputusan apa pun.
      default:
        break;
    }
  }
}
