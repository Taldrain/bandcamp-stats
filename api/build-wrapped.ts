// Configuration from environment variables or command line arguments
const year = parseInt(Deno.args[0] || new Date().getFullYear().toString());
const BANDCAMP_PROFILE = Deno.env.get("BANDCAMP_PROFILE") || Deno.args[1] || "";
const YEAR_START = new Date(`${year}-01-01T00:00:00Z`).getTime();
const YEAR_END = new Date(`${year + 1}-01-01T00:00:00Z`).getTime();

interface Stats {
  year: number;
  totalPlays: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  bandcampProfile: string;
  uniqueTracks: number;
  topArtists: Array<{ artist: string; playCount: number; artistUrl?: string; artistAvatar?: string }>;
  topAlbums: Array<{ album: string; artist: string; albumUrl: string; playCount: number; albumArt?: string }>;
  topTracks: Array<{ track: string; artist: string; playCount: number; albumUrl: string; albumArt?: string }>;
  monthlyPlays: Array<{ month: string; count: number }>;
}

async function queryDatabase(query: string): Promise<string> {
  const cmd = new Deno.Command("sqlite3", {
    args: ["db.sqlite", query],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr } = await cmd.output();
  const error = new TextDecoder().decode(stderr);
  if (error) {
    throw new Error(`SQLite error: ${error}`);
  }

  return new TextDecoder().decode(stdout);
}

async function fetchAlbumArt(albumUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(albumUrl);
    const html = await response.text();

    // Try to find the album art in the meta tags
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (ogImageMatch) {
      return ogImageMatch[1];
    }

    // Fallback: try to find it in the page
    const artMatch = html.match(/id="tralbumArt"[^>]*>\s*<a[^>]*>\s*<img[^>]*src="([^"]+)"/);
    if (artMatch) {
      return artMatch[1];
    }
  } catch (error) {
    console.error(`Failed to fetch album art for ${albumUrl}:`, error);
  }
  return undefined;
}

async function fetchArtistInfo(albumUrl: string): Promise<{ artistUrl?: string; artistAvatar?: string }> {
  try {
    const response = await fetch(albumUrl);
    const html = await response.text();

    // Extract artist page URL from the album page
    const artistLinkMatch = html.match(/<a href="([^"]+)" class="[^"]*band-name-location-title[^"]*">/);
    let artistUrl: string | undefined;

    if (artistLinkMatch) {
      artistUrl = artistLinkMatch[1].startsWith('http')
        ? artistLinkMatch[1]
        : `https://${new URL(albumUrl).hostname}${artistLinkMatch[1]}`;
    }

    // Look for artist photo on the album page itself
    const bandPhotoMatch = html.match(/<img[^>]*class="[^"]*band-photo[^"]*"[^>]*src="([^"]+)"/);
    if (bandPhotoMatch) {
      return { artistUrl, artistAvatar: bandPhotoMatch[1] };
    }

    // Alternative pattern - src might come before class
    const bandPhotoMatch2 = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*band-photo[^"]*"/);
    if (bandPhotoMatch2) {
      return { artistUrl, artistAvatar: bandPhotoMatch2[1] };
    }

    return { artistUrl };
  } catch (error) {
    console.error(`Failed to fetch artist info from ${albumUrl}:`, error);
  }
  return {};
}

async function generateStats(): Promise<Stats> {
  // Total plays
  const totalPlaysStr = await queryDatabase(
    `SELECT COUNT(*) FROM plays WHERE timestamp >= ${YEAR_START} AND timestamp < ${YEAR_END}`
  );
  const totalPlays = parseInt(totalPlaysStr.trim());

  // Unique artists
  const uniqueArtistsStr = await queryDatabase(
    `SELECT COUNT(DISTINCT artist) FROM plays WHERE timestamp >= ${YEAR_START} AND timestamp < ${YEAR_END}`
  );
  const uniqueArtists = parseInt(uniqueArtistsStr.trim());

  // Unique albums
  const uniqueAlbumsStr = await queryDatabase(
    `SELECT COUNT(DISTINCT album) FROM plays WHERE timestamp >= ${YEAR_START} AND timestamp < ${YEAR_END}`
  );
  const uniqueAlbums = parseInt(uniqueAlbumsStr.trim());

  // Unique tracks
  const uniqueTracksStr = await queryDatabase(
    `SELECT COUNT(DISTINCT track) FROM plays WHERE timestamp >= ${YEAR_START} AND timestamp < ${YEAR_END}`
  );
  const uniqueTracks = parseInt(uniqueTracksStr.trim());

  // Top 10 artists - get an album URL for each to fetch artist info
  const topArtistsStr = await queryDatabase(
    `SELECT artist, COUNT(*) as playCount, MIN(albumUrl) as albumUrl FROM plays WHERE timestamp >= ${YEAR_START} AND timestamp < ${YEAR_END} GROUP BY artist ORDER BY playCount DESC LIMIT 10`
  );
  const topArtistsRaw = topArtistsStr.trim().split('\n').map(line => {
    const parts = line.split('|');
    return { artist: parts[0], playCount: parseInt(parts[1]), albumUrl: parts[2] };
  });

  // Fetch artist avatars
  console.log('Fetching artist avatars...');
  const topArtists: Array<{ artist: string; playCount: number; artistUrl?: string; artistAvatar?: string }> = [];
  for (const artistRaw of topArtistsRaw) {
    const { artistUrl, artistAvatar } = await fetchArtistInfo(artistRaw.albumUrl);
    topArtists.push({
      artist: artistRaw.artist,
      playCount: artistRaw.playCount,
      artistUrl,
      artistAvatar
    });
  }

  // Top 10 albums
  const topAlbumsStr = await queryDatabase(
    `SELECT album, artist, albumUrl, COUNT(*) as playCount FROM plays WHERE timestamp >= ${YEAR_START} AND timestamp < ${YEAR_END} GROUP BY album, artist ORDER BY playCount DESC LIMIT 10`
  );
  const topAlbumsRaw = topAlbumsStr.trim().split('\n').map(line => {
    const parts = line.split('|');
    return { album: parts[0], artist: parts[1], albumUrl: parts[2], playCount: parseInt(parts[3]) };
  });

  // Fetch album art for top albums
  console.log('Fetching album artwork...');
  const topAlbums: Array<{ album: string; artist: string; albumUrl: string; playCount: number; albumArt?: string }> = [];
  for (const albumRaw of topAlbumsRaw) {
    const albumArt = await fetchAlbumArt(albumRaw.albumUrl);
    topAlbums.push({
      album: albumRaw.album,
      artist: albumRaw.artist,
      albumUrl: albumRaw.albumUrl,
      playCount: albumRaw.playCount,
      albumArt
    });
  }

  // Top 10 tracks (with album URLs for artwork)
  const topTracksStr = await queryDatabase(
    `SELECT track, artist, albumUrl, COUNT(*) as playCount FROM plays WHERE timestamp >= ${YEAR_START} AND timestamp < ${YEAR_END} GROUP BY track, artist ORDER BY playCount DESC LIMIT 10`
  );
  const topTracksRaw = topTracksStr.trim().split('\n').map(line => {
    const parts = line.split('|');
    return { track: parts[0], artist: parts[1], albumUrl: parts[2], playCount: parseInt(parts[3]) };
  });

  // Fetch album art for top tracks
  const topTracks: Array<{ track: string; artist: string; albumUrl: string; playCount: number; albumArt?: string }> = [];
  for (const trackRaw of topTracksRaw) {
    const albumArt = await fetchAlbumArt(trackRaw.albumUrl);
    topTracks.push({
      track: trackRaw.track,
      artist: trackRaw.artist,
      albumUrl: trackRaw.albumUrl,
      playCount: trackRaw.playCount,
      albumArt
    });
  }

  // Monthly breakdown
  const monthlyPlaysStr = await queryDatabase(
    `SELECT strftime('%Y-%m', datetime(timestamp / 1000, 'unixepoch')) as month, COUNT(*) as count FROM plays WHERE timestamp >= ${YEAR_START} AND timestamp < ${YEAR_END} GROUP BY month ORDER BY month`
  );
  const monthlyPlaysRaw = monthlyPlaysStr.trim().split('\n').map(line => {
    const parts = line.split('|');
    return { month: parts[0], count: parseInt(parts[1]) };
  });

  // Create array with all 12 months, filling in zero for missing months
  const monthlyPlays = [];
  for (let i = 1; i <= 12; i++) {
    const monthStr = `${year}-${i.toString().padStart(2, '0')}`;
    const existing = monthlyPlaysRaw.find(m => m.month === monthStr);
    monthlyPlays.push({
      month: monthStr,
      count: existing ? existing.count : 0
    });
  }

  return {
    year,
    totalPlays,
    uniqueArtists,
    uniqueAlbums,
    uniqueTracks,
    topArtists,
    topAlbums,
    topTracks,
    monthlyPlays,
    bandcampProfile: BANDCAMP_PROFILE,
  };
}

function generateHTML(stats: Stats): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyLabels = stats.monthlyPlays.map(m => {
    const [_, month] = m.month.split('-');
    return monthNames[parseInt(month) - 1];
  });
  const monthlyData = stats.monthlyPlays.map(m => m.count);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bandcamp Wrapped ${stats.year}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%230cacd7'/%3E%3Cpath d='M35 30 L35 70 L45 60 L45 40 Z M55 35 Q65 30 70 40 Q75 50 70 60 Q65 70 55 65' fill='none' stroke='white' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E" type="image/svg+xml">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #0cacd7 0%, #0a7a99 50%, #0cacd7 100%);
      background-attachment: fixed;
      color: #fff;
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      padding: 80px 20px 40px;
      position: relative;
    }

    .header h1 {
      font-size: 4rem;
      font-weight: 900;
      margin-bottom: 15px;
      background: linear-gradient(135deg, #fff 0%, #0cacd7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -2px;
    }

    .header .year {
      font-size: 6rem;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 15px;
      text-shadow: 0 0 40px rgba(12, 172, 215, 0.5);
    }

    .header p {
      font-size: 1.4rem;
      opacity: 0.9;
      font-weight: 300;
    }

    .profile-link {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 30px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50px;
      font-weight: 600;
      transition: all 0.3s ease;
      text-decoration: none;
      color: white;
    }

    .profile-link:hover {
      background: rgba(12, 172, 215, 0.2);
      border-color: #0cacd7;
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(12, 172, 215, 0.3);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 25px;
      margin-bottom: 50px;
    }

    .stat-card {
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 40px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #0cacd7, #0ea5cd);
    }

    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 50px rgba(12, 172, 215, 0.2);
      border-color: rgba(12, 172, 215, 0.3);
    }

    .stat-card h3 {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.7;
      margin-bottom: 15px;
      font-weight: 600;
    }

    .stat-card .number {
      font-size: 3.5rem;
      font-weight: 800;
      line-height: 1;
      background: linear-gradient(135deg, #fff 0%, #0cacd7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .section {
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 50px;
      margin-bottom: 40px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .section h2 {
      font-size: 2.5rem;
      margin-bottom: 40px;
      text-align: center;
      font-weight: 800;
      letter-spacing: -1px;
    }

    .top-list {
      list-style: none;
      display: grid;
      gap: 15px;
    }

    .top-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      transition: all 0.3s ease;
    }

    .top-item:hover {
      background: rgba(12, 172, 215, 0.1);
      border-color: rgba(12, 172, 215, 0.3);
      transform: translateX(8px);
    }

    .album-art {
      width: 80px;
      height: 80px;
      border-radius: 12px;
      object-fit: cover;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      flex-shrink: 0;
    }

    .album-art-placeholder {
      width: 80px;
      height: 80px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(12, 172, 215, 0.3) 0%, rgba(10, 122, 153, 0.3) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      flex-shrink: 0;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }

    .rank {
      font-size: 2.5rem;
      font-weight: 900;
      min-width: 60px;
      opacity: 0.4;
      letter-spacing: -1px;
    }

    .item-info {
      flex: 1;
      min-width: 0;
    }

    .item-name {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-name a {
      transition: color 0.2s;
    }

    .item-name a:hover {
      color: #0cacd7;
    }

    .item-artist {
      opacity: 0.6;
      font-size: 1rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .play-count {
      font-size: 1.4rem;
      font-weight: 700;
      opacity: 0.8;
      white-space: nowrap;
    }

    .chart-container {
      margin-top: 30px;
      height: 350px;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .footer {
      text-align: center;
      padding: 60px 20px;
      opacity: 0.5;
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 2.5rem;
      }

      .header .year {
        font-size: 4rem;
      }

      .stat-card .number {
        font-size: 2.8rem;
      }

      .section {
        padding: 30px 20px;
      }

      .album-art, .album-art-placeholder {
        width: 60px;
        height: 60px;
      }

      .item-name {
        font-size: 1.1rem;
      }

      .rank {
        font-size: 1.8rem;
        min-width: 40px;
      }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bandcamp Wrapped</h1>
      <div class="year">${stats.year}</div>
      <p>A year in music</p>
      ${stats.bandcampProfile ? `<a href="https://bandcamp.com/${escapeHtml(stats.bandcampProfile)}" target="_blank" class="profile-link">${escapeHtml(stats.bandcampProfile)} on Bandcamp</a>` : ''}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Plays</h3>
        <div class="number">${stats.totalPlays.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <h3>Artists</h3>
        <div class="number">${stats.uniqueArtists.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <h3>Albums</h3>
        <div class="number">${stats.uniqueAlbums.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <h3>Tracks</h3>
        <div class="number">${stats.uniqueTracks.toLocaleString()}</div>
      </div>
    </div>

    <div class="section">
      <h2>Listening Activity</h2>
      <div class="chart-container">
        <canvas id="monthlyChart"></canvas>
      </div>
    </div>

    <div class="section">
      <h2>Top Artists</h2>
      <ul class="top-list">
        ${stats.topArtists.map((item, index) => `
        <li class="top-item">
          <div class="rank">#${index + 1}</div>
          ${item.artistAvatar
            ? `<img src="${escapeHtml(item.artistAvatar)}" alt="${escapeHtml(item.artist)}" class="album-art">`
            : '<div class="album-art-placeholder">🎤</div>'
          }
          <div class="item-info">
            <div class="item-name">${item.artistUrl
              ? `<a href="${escapeHtml(item.artistUrl)}" target="_blank">${escapeHtml(item.artist)}</a>`
              : escapeHtml(item.artist)
            }</div>
          </div>
          <div class="play-count">${item.playCount.toLocaleString()} plays</div>
        </li>
        `).join('')}
      </ul>
    </div>

    <div class="section">
      <h2>Top Albums</h2>
      <ul class="top-list">
        ${stats.topAlbums.map((item, index) => `
        <li class="top-item">
          <div class="rank">#${index + 1}</div>
          ${item.albumArt
            ? `<img src="${escapeHtml(item.albumArt)}" alt="${escapeHtml(item.album)}" class="album-art">`
            : '<div class="album-art-placeholder">💿</div>'
          }
          <div class="item-info">
            <div class="item-name">
              <a href="${escapeHtml(item.albumUrl)}" target="_blank">${escapeHtml(item.album)}</a>
            </div>
            <div class="item-artist">${escapeHtml(item.artist)}</div>
          </div>
          <div class="play-count">${item.playCount.toLocaleString()} plays</div>
        </li>
        `).join('')}
      </ul>
    </div>

    <div class="section">
      <h2>Top Tracks</h2>
      <ul class="top-list">
        ${stats.topTracks.map((item, index) => `
        <li class="top-item">
          <div class="rank">#${index + 1}</div>
          ${item.albumArt
            ? `<img src="${escapeHtml(item.albumArt)}" alt="${escapeHtml(item.track)}" class="album-art">`
            : '<div class="album-art-placeholder">🎵</div>'
          }
          <div class="item-info">
            <div class="item-name">${escapeHtml(item.track)}</div>
            <div class="item-artist">${escapeHtml(item.artist)}</div>
          </div>
          <div class="play-count">${item.playCount.toLocaleString()} plays</div>
        </li>
        `).join('')}
      </ul>
    </div>

    <div class="footer">
      <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>
  </div>

  <script>
    const ctx = document.getElementById('monthlyChart');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(monthlyLabels)},
        datasets: [{
          label: 'Plays',
          data: ${JSON.stringify(monthlyData)},
          backgroundColor: 'rgba(12, 172, 215, 0.6)',
          borderColor: 'rgba(12, 172, 215, 1)',
          borderWidth: 2,
          borderRadius: 10,
          hoverBackgroundColor: 'rgba(12, 172, 215, 0.8)',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            borderColor: 'rgba(12, 172, 215, 0.5)',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            }
          },
          x: {
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: 12
              }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Main execution
console.log(`Generating Bandcamp Wrapped for ${year}...`);
const stats = await generateStats();
const html = generateHTML(stats);

const outputFile = `../bandcamp-wrapped-${year}.html`;
await Deno.writeTextFile(outputFile, html);

console.log(`\n✅ Generated bandcamp-wrapped-${year}.html`);
console.log(`📊 Stats: ${stats.totalPlays.toLocaleString()} plays, ${stats.uniqueArtists} artists, ${stats.uniqueAlbums} albums, ${stats.uniqueTracks} tracks`);
