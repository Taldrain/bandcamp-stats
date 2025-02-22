import { apiCall } from './utils.js';

(() => {
  if (window.bandcampStatAlbumHasRun === true) {
    return;
  }

  window.bandcampStatAlbumHasRun = true;

  function watchPlay() {
    let timeoutId = -1;

    const el = document.querySelector('div.playbutton');
    const observer = new MutationObserver(async (mutations) => {
      const lastMutation = mutations.at(-1);

      clearTimeout(timeoutId);

      if (lastMutation.target.classList.contains('playing')) {
        timeoutId = setTimeout(() => {
          const {
            artist,
            album,
            track,
            albumUrl,
          } = getTrackInfo();

          apiCall(artist, album, track, albumUrl);
        }, 5 * 1000); // 5 seconds
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function getTrackInfo() {
    const artist = document.querySelector('h3 span a').innerText;
    const album = document.querySelector('h2.trackTitle').innerText
    const track = document.querySelector('div.track_info span.title').innerText;
    const currentUrl = new URL(document.URL);
    const albumUrl = `${currentUrl.origin}${currentUrl.pathname}`;

    return { artist, album, track, albumUrl };
  }

  watchPlay();
})();
