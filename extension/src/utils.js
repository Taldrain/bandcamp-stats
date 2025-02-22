async function apiCall(artist, album, track, url) {
  const { apiKey, apiUrl } = await browser.storage.sync.get(['apiKey', 'apiUrl']);
  if (apiKey === undefined || apiUrl === undefined) {
    return;
  }

  const request = new Request(apiUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ artist, album, track, url }),
  });

  return fetch(request);
}

export {
  apiCall,
}
