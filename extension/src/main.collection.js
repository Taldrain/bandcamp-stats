import { apiCall } from './utils.js';

(() => {
  if (window.bandcampStatCollectionHasRun === true) {
    return;
  }

  let previousPlayObserver = null;
  let timeoutId = -1;

  function watchPlay() {
    const el = document.querySelector('div.carousel-player-inner div.playpause .pause');
    if (previousPlayObserver !== null) {
      previousPlayObserver.disconnect();
    }

    previousPlayObserver = new MutationObserver(async (mutations) => {
      const lastMutation = mutations.at(-1);

      clearTimeout(timeoutId);

      if (lastMutation.target.style.display != 'none') {
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

    previousPlayObserver.observe(el, { attributes: true, attributeFilter: ['style'] });
  }

  function watchCarouselPlayer() {
    const el = document.querySelector('div#collection-player');
    const observer = new MutationObserver(async (mutations) => {
      const lastMutation = mutations.at(-1);

      if (lastMutation.target.classList.contains('show-player')) {
        watchPlay();
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function getTrackInfo() {
    const artist = document.querySelector('div#collection-player div.info div.artist span').innerText;
    const album = document.querySelector('div#collection-player div.info div.title').innerText;
    const track = document.querySelector('div#collection-player div.info-progress div.title span:nth-child(2)').innerText;
    const albumUrl = document.querySelector('div#collection-player div.info div.item-collection-controls span.buy-now a').href;

    return { artist, album, track, albumUrl };
  }

  watchCarouselPlayer();
})();

