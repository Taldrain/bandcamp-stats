import { apiCall } from './utils.js';

(() => {
  if (window.bandcampStatHasRun === true) {
    return;
  }

  window.bandcampStatHasRun = true;

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
            url
          } = getTrackInfo();

          apiCall(artist, album, track, url);
        }, 5 * 1000); // 5 seconds
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function getTrackInfo() {
    const artist = document.querySelector('h3 span a').innerText;
    const album = document.querySelector('h2.trackTitle').innerText
    const track = document.querySelector('div.track_info span.title').innerText;
    const url = document.querySelector('div.track_info a.title_link.primaryText').href;

    return { artist, album, track, url };
  }

  watchPlay();
})();
