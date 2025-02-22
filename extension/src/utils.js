async function apiCall(artist, album, track, albumUrl) {
  const { apiKey, apiUrl } = await browser.storage.sync.get(['apiKey', 'apiUrl']);
  if (apiKey === undefined || apiUrl === undefined) {
    return;
  }

  const request = new Request(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ artist, album, track, albumUrl }),
  });

  return fetch(request);
}

export {
  apiCall,
}
