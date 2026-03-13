// FanGraphs proxy — stub for future implementation
// Will fetch and cache FanGraphs leaderboard data (wRC+, wOBA, pitch arsenal)
// to work around CORS restrictions on the FanGraphs API.

export default async function handler(req, res) {
  res.status(501).json({ error: 'Not implemented yet' });
}
