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
    // Merge WBC dates into MLB schedule, tag games as WBC
    for (const wbcDate of wbc.dates || []) {
      for (const g of wbcDate.games) g._isWBC = true;
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
 * Fetch coaching staff for a team.
 * @param {number} teamId - MLB team ID
 * @returns {Promise<Object>} Key coaches: manager, pitching, first base, third base
 */
export async function fetchCoaches(teamId) {
  try {
    const resp = await fetch(`${MLB_API_BASE}/teams/${teamId}/coaches`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const roster = data.roster || [];
    const find = (title) => roster.find(c => c.title === title)?.person?.fullName || null;
    const findStartsWith = (prefix) => roster.find(c => c.title?.startsWith(prefix))?.person?.fullName || null;
    const findIncludes = (keyword) => roster.find(c => c.title?.includes(keyword))?.person?.fullName || null;
    return {
      manager: find('Manager'),
      pitching: find('Pitching Coach') || findIncludes('Pitching Coach'),
      firstBase: findStartsWith('First Base'),
      thirdBase: findStartsWith('Third Base'),
    };
  } catch {
    return null;
  }
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
 * Fetch season batting and pitching stats for a team.
 * @param {number} teamId - MLB team ID
 * @param {number} season - e.g. 2025
 * @returns {Promise<Object>} { batting: {...}, pitching: {...} }
 */
export async function fetchTeamSeasonStats(teamId, season) {
  async function tryFetch(yr) {
    const [batResp, pitResp, fldResp] = await Promise.all([
      fetch(`${MLB_API_BASE}/teams/${teamId}/stats?stats=season&season=${yr}&group=hitting`),
      fetch(`${MLB_API_BASE}/teams/${teamId}/stats?stats=season&season=${yr}&group=pitching`),
      fetch(`${MLB_API_BASE}/teams/${teamId}/stats?stats=season&season=${yr}&group=fielding`),
    ]);
    const bat = batResp.ok ? await batResp.json() : null;
    const pit = pitResp.ok ? await pitResp.json() : null;
    const fld = fldResp.ok ? await fldResp.json() : null;
    const batting = bat?.stats?.[0]?.splits?.[0]?.stat || null;
    const pitching = pit?.stats?.[0]?.splits?.[0]?.stat || null;
    const fielding = fld?.stats?.[0]?.splits?.[0]?.stat || null;
    return { batting, pitching, fielding, season: yr };
  }
  try {
    const result = await tryFetch(season);
    if (result.batting) return result;
    // Fallback to previous season if current has no data (Spring Training)
    const fallback = await tryFetch(season - 1);
    return fallback;
  } catch {
    return { batting: null, pitching: null, fielding: null, season };
  }
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
  const safeFetch = (url, id, type) =>
    fetch(url).then(r => r.json())
      .then(d => ({ id, type, stat: d?.stats?.[0]?.splits?.[0]?.stat || null }))
      .catch(() => ({ id, type, stat: null }));

  const fetches = teamIds.flatMap(id => [
    safeFetch(`${MLB_API_BASE}/teams/${id}/stats?stats=season&season=${season}&group=hitting`, id, 'hitting'),
    safeFetch(`${MLB_API_BASE}/teams/${id}/stats?stats=season&season=${season}&group=pitching`, id, 'pitching'),
    safeFetch(`${MLB_API_BASE}/teams/${id}/stats?stats=season&season=${season}&group=fielding`, id, 'fielding'),
  ]);

  const results = await Promise.all(fetches);
  const map = {};
  for (const r of results) {
    if (!r.stat) continue;
    if (!map[r.id]) map[r.id] = {};
    if (r.type === 'hitting') {
      map[r.id].avg = r.stat.avg || '.000';
      map[r.id].ops = r.stat.ops || '.000';
      map[r.id].runs = r.stat.runs || 0;
      map[r.id].homeRuns = r.stat.homeRuns || 0;
      map[r.id].stolenBases = r.stat.stolenBases || 0;
    } else if (r.type === 'pitching') {
      map[r.id].era = r.stat.era || '-.--';
      map[r.id].runsAllowed = r.stat.runs || 0;
    } else {
      map[r.id].errors = r.stat.errors || 0;
      map[r.id].doublePlays = r.stat.doublePlays || 0;
      map[r.id].fielding = r.stat.fielding || '.000';
    }
  }
  return map;
}

/**
 * Fetch season pitch arsenal for a list of pitcher IDs.
 * Uses the MLB people endpoint with pitchArsenal hydration.
 * @param {number[]} pitcherIds
 * @param {number} season
 * @returns {Promise<Map<number, Array>>} Map of pitcherId → [{code, pct, avgVelo}]
 */
export async function fetchPitchArsenals(pitcherIds, season) {
  const result = new Map();
  if (!pitcherIds.length) return result;

  async function fetchSeason(ids, yr) {
    const resp = await fetch(`${MLB_API_BASE}/people?personIds=${ids}&hydrate=stats(type=pitchArsenal,season=${yr},group=pitching)`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.people || [];
  }

  // Batch in groups of 50 to avoid URL length limits
  const batches = [];
  for (let i = 0; i < pitcherIds.length; i += 50) {
    batches.push(pitcherIds.slice(i, i + 50));
  }
  const missingIds = [];
  for (const batch of batches) {
    try {
      const ids = batch.join(',');
      const people = await fetchSeason(ids, season);
      for (const p of people) {
        const splits = p.stats?.[0]?.splits || [];
        if (splits.length === 0) { missingIds.push(p.id); continue; }
        const arsenal = splits
          .map(s => ({
            code: s.stat.type.code,
            desc: s.stat.type.description,
            pct: Math.round(s.stat.percentage * 100),
            avgVelo: s.stat.averageSpeed ? s.stat.averageSpeed.toFixed(1) : null,
          }))
          .filter(a => a.pct > 0)
          .sort((a, b) => b.pct - a.pct);
        result.set(p.id, arsenal);
      }
      // Track IDs that weren't in the response at all
      for (const id of batch) {
        if (!people.some(p => p.id === id)) missingIds.push(id);
      }
    } catch { /* skip failed batches */ }
  }

  // Fallback to previous season for pitchers with no current-season data
  if (missingIds.length > 0) {
    const fallbackBatches = [];
    for (let i = 0; i < missingIds.length; i += 50) {
      fallbackBatches.push(missingIds.slice(i, i + 50));
    }
    for (const batch of fallbackBatches) {
      try {
        const ids = batch.join(',');
        const people = await fetchSeason(ids, season - 1);
        for (const p of people) {
          if (result.has(p.id)) continue;
          const splits = p.stats?.[0]?.splits || [];
          if (splits.length === 0) continue;
          const arsenal = splits
            .map(s => ({
              code: s.stat.type.code,
              desc: s.stat.type.description,
              pct: Math.round(s.stat.percentage * 100),
              avgVelo: s.stat.averageSpeed ? s.stat.averageSpeed.toFixed(1) : null,
            }))
            .filter(a => a.pct > 0)
            .sort((a, b) => b.pct - a.pct);
          result.set(p.id, arsenal);
        }
      } catch { /* skip */ }
    }
  }
  return result;
}


