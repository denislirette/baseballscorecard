// MLB Stats API client

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';
const MLB_API_FEED = 'https://statsapi.mlb.com/api/v1.1';

/**
 * Check if dev mode is enabled via URL param or localhost.
 */
export function isDevMode() {
  const params = new URLSearchParams(window.location.search);
  return params.has('dev');
}

/**
 * Fetch the MLB schedule for a given date.
 * @param {string} date - YYYY-MM-DD format
 * @returns {Promise<Object>} Schedule response
 */
export async function fetchSchedule(date) {
  if (isDevMode()) {
    const resp = await fetch(`/fixtures/schedule-${date}.json`);
    if (!resp.ok) throw new Error(`No fixture for schedule ${date}`);
    return resp.json();
  }

  // Fetch MLB (sportId=1) and WBC (sportId=51) schedules in parallel
  const [mlbResp, wbcResp] = await Promise.all([
    fetch(`${MLB_API_BASE}/schedule?sportId=1&date=${date}`),
    fetch(`${MLB_API_BASE}/schedule?sportId=51&date=${date}`),
  ]);
  if (!mlbResp.ok) throw new Error(`Failed to fetch schedule: ${mlbResp.status}`);
  const mlb = await mlbResp.json();
  if (wbcResp.ok) {
    const wbc = await wbcResp.json();
    // Merge WBC dates into MLB schedule
    for (const wbcDate of wbc.dates || []) {
      const existing = mlb.dates?.find(d => d.date === wbcDate.date);
      if (existing) {
        existing.games.push(...wbcDate.games);
      } else {
        (mlb.dates = mlb.dates || []).push(wbcDate);
      }
    }
  }
  return mlb;
}

/**
 * Fetch the full GUMBO live feed for a game.
 * @param {number} gamePk - Game ID
 * @returns {Promise<Object>} Live feed response
 */
export async function fetchLiveFeed(gamePk) {
  if (isDevMode()) {
    // Load fixture index to map gamePk to filename
    const indexResp = await fetch('/fixtures/index.json');
    if (indexResp.ok) {
      const index = await indexResp.json();
      const filename = index[String(gamePk)];
      if (filename) {
        const resp = await fetch(`/fixtures/${filename}`);
        if (resp.ok) return resp.json();
      }
    }
    throw new Error(`No fixture for game ${gamePk}`);
  }

  const resp = await fetch(`${MLB_API_FEED}/game/${gamePk}/feed/live`);
  if (!resp.ok) throw new Error(`Failed to fetch live feed: ${resp.status}`);
  return resp.json();
}

/**
 * Fetch MLB standings for a given season.
 * @param {number} season - e.g. 2025
 * @returns {Promise<Object>} Standings response
 */
export async function fetchStandings(season) {
  if (isDevMode()) {
    const resp = await fetch(`/fixtures/standings-${season}.json`);
    if (!resp.ok) throw new Error(`No fixture for standings ${season}`);
    return resp.json();
  }

  const resp = await fetch(`${MLB_API_BASE}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`);
  if (!resp.ok) throw new Error(`Failed to fetch standings: ${resp.status}`);
  return resp.json();
}

/**
 * Get the games array from a schedule response.
 * @param {Object} scheduleData - Raw schedule API response
 * @returns {Array} Array of game objects
 */
export function getGames(scheduleData) {
  if (!scheduleData.dates || scheduleData.dates.length === 0) return [];
  return scheduleData.dates[0].games || [];
}

/**
 * Fetch all 30 teams' pitching/fielding stats for ranking.
 * In dev mode, loads from a single pre-baked fixture.
 * @param {number} season
 * @returns {Promise<Object>} Map of teamId → {era, errors, doublePlays, fielding}
 */
export async function fetchAllTeamStats(season) {
  if (isDevMode()) {
    const resp = await fetch(`/fixtures/team-stats-all-${season}.json`);
    if (!resp.ok) throw new Error(`No fixture for team stats ${season}`);
    return resp.json();
  }

  const teamIds = [108,109,110,111,112,113,114,115,116,117,118,119,120,121,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,158];
  const fetches = teamIds.flatMap(id => [
    fetch(`${MLB_API_BASE}/teams/${id}/stats?stats=season&season=${season}&group=pitching`).then(r => r.json()).then(d => ({ id, type: 'pitching', stat: d.stats[0].splits[0].stat })),
    fetch(`${MLB_API_BASE}/teams/${id}/stats?stats=season&season=${season}&group=fielding`).then(r => r.json()).then(d => ({ id, type: 'fielding', stat: d.stats[0].splits[0].stat })),
  ]);

  const results = await Promise.all(fetches);
  const map = {};
  for (const r of results) {
    if (!map[r.id]) map[r.id] = {};
    if (r.type === 'pitching') {
      map[r.id].era = r.stat.era || '-.--';
    } else {
      map[r.id].errors = r.stat.errors || 0;
      map[r.id].doublePlays = r.stat.doublePlays || 0;
      map[r.id].fielding = r.stat.fielding || '.000';
    }
  }
  return map;
}

/**
 * Fetch coaches roster for a team.
 * @param {number} teamId
 * @param {number} season
 * @returns {Promise<Object>} Coaches API response
 */
export async function fetchCoaches(teamId, season) {
  if (isDevMode()) {
    const resp = await fetch(`/fixtures/coaches-${teamId}.json`);
    if (!resp.ok) throw new Error(`No fixture for coaches ${teamId}`);
    return resp.json();
  }

  const resp = await fetch(`${MLB_API_BASE}/teams/${teamId}/coaches?season=${season}`);
  if (!resp.ok) throw new Error(`Failed to fetch coaches: ${resp.status}`);
  return resp.json();
}

