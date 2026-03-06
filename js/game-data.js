// Game data parsing - transforms GUMBO feed into scorecard structures

const POSITION_MAP = {
  'pitcher': 1, 'catcher': 2, 'first baseman': 3,
  'second baseman': 4, 'third baseman': 5, 'shortstop': 6,
  'left fielder': 7, 'center fielder': 8, 'right fielder': 9,
  'designated hitter': 0,
};

const POS_ABBREV = {
  'P': 1, 'C': 2, '1B': 3, '2B': 4, '3B': 5,
  'SS': 6, 'LF': 7, 'CF': 8, 'RF': 9, 'DH': 10, 'PH': 'PH', 'PR': 'PR',
};

export { POS_ABBREV };

/**
 * Build the lineup for a team, grouped by batting order slot.
 */
export function buildTeamLineup(boxscore, side) {
  const team = boxscore.teams[side];
  const players = team.players;

  const batters = [];
  for (const [key, p] of Object.entries(players)) {
    const bo = p.battingOrder;
    if (!bo) continue;
    const boInt = parseInt(bo, 10);
    batters.push({
      id: p.person.id,
      name: p.person.fullName,
      jerseyNumber: p.jerseyNumber || '',
      position: p.position.abbreviation,
      battingOrder: boInt,
      slot: Math.floor(boInt / 100),
      subIndex: boInt % 100,
      isSubstitute: p.gameStatus?.isSubstitute || false,
      stats: p.stats?.batting || {},
    });
  }

  const slots = new Map();
  for (const b of batters) {
    if (!slots.has(b.slot)) slots.set(b.slot, []);
    slots.get(b.slot).push(b);
  }
  for (const [, arr] of slots) {
    arr.sort((a, b) => a.subIndex - b.subIndex);
  }

  const lineup = [];
  for (let i = 1; i <= 9; i++) {
    lineup.push({ slot: i, players: slots.get(i) || [] });
  }
  return lineup;
}

/**
 * Map all plays into a grid structure: slot -> inning -> atBat data.
 */
export function buildScorecardGrid(allPlays, halfInning, lineup, boxscore, side) {
  const playerSlotMap = new Map();
  for (const slot of lineup) {
    for (const p of slot.players) {
      playerSlotMap.set(p.id, slot.slot);
    }
  }

  const plays = allPlays.filter(p => p.about.halfInning === halfInning);
  const grid = new Map();

  for (const play of plays) {
    if (play.result.type !== 'atBat') continue;
    const batterId = play.matchup.batter.id;
    const slot = playerSlotMap.get(batterId);
    if (!slot) continue;

    const inning = play.about.inning;
    const key = `${slot}-${inning}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(parseAtBat(play));
  }

  return grid;
}

/**
 * Build substitution map: for each cell (slot-inning), an array of subs that occurred.
 * Returns Map<string, Array<{type: 'PH'|'PR'|'pitcher'|'defensive', playerId: number}>>.
 *
 * Scans ALL plays (not just this half-inning) because defensive subs happen
 * during the opponent's half-inning but affect this team's lineup.
 */
export function buildSubstitutionMap(allPlays, halfInning, lineup) {
  const playerSlotMap = new Map();
  for (const slot of lineup) {
    for (const p of slot.players) {
      playerSlotMap.set(p.id, slot.slot);
    }
  }

  const subMap = new Map();

  for (const play of allPlays) {
    const inning = play.about.inning;

    for (const ev of play.playEvents || []) {
      if (ev.type !== 'action') continue;
      const event = ev.details?.event || '';
      const desc = (ev.details?.description || '').toLowerCase();
      const playerId = ev.player?.id || 0;

      let subType = null;
      let slot = null;

      if (event === 'Pitching Substitution') {
        // Pitching subs: use batter's slot (affects the cell being batted)
        if (play.about.halfInning === halfInning) {
          slot = playerSlotMap.get(play.matchup.batter.id);
          subType = 'pitcher';
        }
      } else if (event === 'Offensive Substitution') {
        // PH/PR: the substitute player enters the lineup
        slot = playerSlotMap.get(playerId) || playerSlotMap.get(play.matchup.batter.id);
        subType = (desc.includes('pinch-runner') || desc.includes('pinch runner')) ? 'PR' : 'PH';
      } else if (event === 'Defensive Sub' || event === 'Defensive Switch') {
        // Defensive subs: player enters lineup for a fielding position
        slot = playerSlotMap.get(playerId);
        if (slot) subType = 'defensive';
      }

      if (subType && slot) {
        const key = `${slot}-${inning}`;
        if (!subMap.has(key)) subMap.set(key, []);
        // Avoid duplicate entries for same player/type/inning
        const existing = subMap.get(key);
        if (!existing.some(s => s.playerId === playerId && s.type === subType)) {
          existing.push({ type: subType, playerId });
        }
      }
    }
  }

  return subMap;
}

/**
 * Build a map from player ID to their global substitution number (1, 2, 3...).
 * Order matches the lineup: slot 1 subs first, then slot 2, etc.
 */
export function buildSubNumberMap(lineup) {
  const map = new Map();
  let subCount = 0;
  for (const slot of lineup) {
    for (const p of slot.players) {
      if (p.isSubstitute) {
        subCount++;
        map.set(p.id, subCount);
      }
    }
  }
  return map;
}

function parseAtBat(play) {
  return {
    batterId: play.matchup.batter.id,
    batterName: play.matchup.batter.fullName,
    pitcherId: play.matchup.pitcher.id,
    pitcherName: play.matchup.pitcher.fullName,
    inning: play.about.inning,
    pitchSequence: parsePitchSequence(play.playEvents || []),
    notation: parsePlayNotation(play),
    runners: parseRunners(play.runners || []),
    result: play.result,
    about: play.about,
  };
}

/**
 * Extract pitch sequence with location data.
 */
export function parsePitchSequence(events) {
  const pitches = [];
  for (const ev of events) {
    if (!ev.isPitch) continue;
    const rawCode = ev.details?.call?.code || '?';
    const coords = ev.pitchData?.coordinates || {};
    pitches.push({
      callCode: normalizePitchCall(rawCode),
      call: ev.details?.call?.description || '',
      typeCode: ev.details?.type?.code || '',
      type: ev.details?.type?.description || '',
      speed: ev.pitchData?.startSpeed || null,
      // Pitch location for mini strike zone
      pX: coords.pX ?? null,
      pZ: coords.pZ ?? null,
      szTop: ev.pitchData?.strikeZoneTop ?? 3.4,
      szBot: ev.pitchData?.strikeZoneBottom ?? 1.6,
    });
  }
  return pitches;
}

function normalizePitchCall(code) {
  if (code.startsWith('*')) return '*';
  return code;
}

// ─── Play notation ───────────────────────────────────────────────

export function parsePlayNotation(play) {
  const event = play.result.event || '';
  const eventType = play.result.eventType || '';
  const desc = play.result.description || '';

  switch (eventType) {
    case 'strikeout':
      return isCalledThirdStrike(play) ? 'ꓘ' : 'K';
    case 'walk': return 'BB';
    case 'intent_walk': return 'IBB';
    case 'hit_by_pitch': return 'HBP';
    case 'single': return '1B';
    case 'double': return '2B';
    case 'triple': return '3B';
    case 'home_run': return 'HR';
    case 'sac_bunt': return parseSacBunt(desc);
    case 'sac_fly': return 'SF' + getFielderNumber(desc);
    case 'field_out': return parseFieldOut(desc, event);
    case 'grounded_into_double_play': return parseDoublePlay(desc);
    case 'fielders_choice': return 'FC';
    case 'force_out': return 'FC';
    case 'field_error': return parseError(desc);
    case 'catcher_interf': return 'CI';
    default: return event || eventType;
  }
}

function isCalledThirdStrike(play) {
  const events = play.playEvents || [];
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].isPitch) {
      return events[i].details?.call?.code === 'C';
    }
  }
  return false;
}

function parseFieldOut(desc, event) {
  const lower = desc.toLowerCase();

  if (lower.includes('flies out') || lower.includes('fly ball')) {
    const pos = findPositionAfter(lower, 'to ');
    if (pos) return `F${pos}`;
  }
  if (lower.includes('lines out') || lower.includes('line drive')) {
    const pos = findPositionAfter(lower, 'to ');
    if (pos) return `L${pos}`;
  }
  if (lower.includes('pops out') || lower.includes('pop up')) {
    const pos = findPositionAfter(lower, 'to ');
    if (pos) return `P${pos}`;
  }
  if (lower.includes('grounds out') || lower.includes('ground ball')) {
    const positions = extractAllPositions(lower);
    if (positions.length >= 2) return 'G' + positions.join('');
    if (positions.length === 1) return `G${positions[0]}3`;
  }
  if (lower.includes('sacrifice bunt')) return parseSacBunt(desc);

  const positions = extractAllPositions(lower);
  if (positions.length > 0) {
    if (event === 'Flyout') return `F${positions[0]}`;
    if (event === 'Lineout') return `L${positions[0]}`;
    if (event === 'Pop Out') return `P${positions[0]}`;
    if (event === 'Groundout' && positions.length >= 2) return 'G' + positions.join('');
    if (event === 'Groundout') return `G${positions[0]}3`;
  }

  if (event === 'Flyout') return 'F';
  if (event === 'Lineout') return 'L';
  if (event === 'Groundout') return 'G';
  if (event === 'Pop Out') return 'P';
  return event || 'OUT';
}

function findPositionAfter(str, afterWord) {
  const idx = str.indexOf(afterWord);
  if (idx === -1) return null;
  const remaining = str.substring(idx);
  const sorted = Object.entries(POSITION_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [name, num] of sorted) {
    if (remaining.includes(name)) return num;
  }
  return null;
}

function parseDoublePlay(desc) {
  const positions = extractAllPositions(desc.toLowerCase());
  if (positions.length >= 2) return 'G' + positions.join('');
  return 'GDP';
}

function parseSacBunt(desc) {
  const positions = extractAllPositions(desc.toLowerCase());
  if (positions.length >= 2) return 'SH' + positions.join('');
  if (positions.length === 1) return 'SH' + positions[0];
  return 'SH';
}

function parseError(desc) {
  const positions = extractAllPositions(desc.toLowerCase());
  if (positions.length > 0) return `E${positions[0]}`;
  return 'E';
}

function extractAllPositions(str) {
  const positionNames = Object.keys(POSITION_MAP).sort((a, b) => b.length - a.length);
  const found = [];
  for (const name of positionNames) {
    let idx = str.indexOf(name, 0);
    while (idx !== -1) {
      found.push({ idx, num: POSITION_MAP[name] });
      idx = str.indexOf(name, idx + name.length);
    }
  }
  found.sort((a, b) => a.idx - b.idx);

  const positions = [];
  const seen = new Set();
  for (const f of found) {
    if (!seen.has(f.idx)) {
      positions.push(f.num);
      seen.add(f.idx);
    }
  }
  return positions;
}

function getFielderNumber(desc) {
  const positions = extractAllPositions(desc.toLowerCase());
  return positions.length > 0 ? positions[positions.length - 1] : '';
}

function parseRunners(runners) {
  return runners.map(r => ({
    start: r.movement?.originBase || null,
    end: r.movement?.end || null,
    isOut: r.movement?.isOut || false,
    event: r.details?.event || '',
    playerId: r.details?.runner?.id,
    playerName: r.details?.runner?.fullName || '',
  }));
}

// ─── Stats & metadata ────────────────────────────────────────────

export function getInningCount(linescore) {
  return linescore.innings?.length || 9;
}

export function getBatterStats(boxscore, side) {
  const team = boxscore.teams[side];
  const stats = new Map();
  for (const [key, p] of Object.entries(team.players)) {
    if (!p.battingOrder) continue;
    const batting = p.stats?.batting || {};
    stats.set(p.person.id, {
      ab: batting.atBats ?? 0,
      r: batting.runs ?? 0,
      h: batting.hits ?? 0,
      rbi: batting.rbi ?? 0,
    });
  }
  return stats;
}

/**
 * Get pitcher stats in order of appearance.
 */
export function getPitcherStats(boxscore, side, decisions) {
  const team = boxscore.teams[side];
  const pitcherIds = team.pitchers || [];
  const players = team.players;

  const winnerId = decisions?.winner?.id;
  const loserId = decisions?.loser?.id;
  const saveId = decisions?.save?.id;

  return pitcherIds.map(id => {
    const p = players[`ID${id}`];
    if (!p) return null;

    const pitching = p.stats?.pitching || {};
    let note = '';
    if (id === winnerId) note = '(WP)';
    else if (id === loserId) note = '(LP)';
    else if (id === saveId) note = '(SV)';
    else if (pitching.holds > 0) note = '(HLD)';

    return { id, name: p.person.fullName, note, stats: pitching };
  }).filter(Boolean);
}

/**
 * Get player bat side or pitch hand from gameData.players.
 * Returns "R", "L", "S" (switch), or "".
 */
export function getPlayerBatSide(gameData, playerId) {
  return gameData.players?.[`ID${playerId}`]?.batSide?.code || '';
}

export function getPlayerPitchHand(gameData, playerId) {
  return gameData.players?.[`ID${playerId}`]?.pitchHand?.code || '';
}

/**
 * Get starting pitcher info with season stats and repertoire.
 */
export function getStartingPitcherInfo(data, side) {
  const boxscore = data.liveData.boxscore;
  const gameData = data.gameData;
  const allPlays = data.liveData.plays.allPlays;
  const team = boxscore.teams[side];
  const pitcherIds = team.pitchers || [];

  if (pitcherIds.length === 0) return null;

  const starterId = pitcherIds[0];
  const p = team.players[`ID${starterId}`];
  if (!p) return null;

  const season = p.seasonStats?.pitching || {};
  const hand = getPlayerPitchHand(gameData, starterId);
  const repertoire = getPitchRepertoire(allPlays, starterId);

  return {
    id: starterId,
    name: p.person.fullName,
    hand,
    seasonStats: {
      w: season.wins ?? 0,
      l: season.losses ?? 0,
      era: season.era || '-.--',
      ip: season.inningsPitched || '0',
      h: season.hits ?? 0,
      r: season.runs ?? 0,
      er: season.earnedRuns ?? 0,
      bb: season.baseOnBalls ?? 0,
      k: season.strikeOuts ?? 0,
      whip: season.whip || '-.--',
    },
    repertoire,
  };
}

/**
 * Collect unique pitch types used by a pitcher from all plays.
 */
export function getPitchRepertoire(allPlays, pitcherId) {
  const types = new Map(); // code -> description
  for (const play of allPlays) {
    if (play.matchup?.pitcher?.id !== pitcherId) continue;
    for (const ev of play.playEvents || []) {
      if (!ev.isPitch) continue;
      const code = ev.details?.type?.code;
      const desc = ev.details?.type?.description;
      if (code && desc) types.set(code, desc);
    }
  }
  return [...types.entries()].map(([code, desc]) => ({ code, desc }));
}

/**
 * Get starting defensive alignment for a team.
 * Returns map of position → {name, jerseyNumber, id, isStarter}.
 */
export function getStartingDefense(boxscore, side) {
  const team = boxscore.teams[side];
  const players = team.players;
  const defense = {};

  for (const [key, p] of Object.entries(players)) {
    if (!p.allPositions || p.allPositions.length === 0) continue;
    const pos = p.allPositions[0].abbreviation;
    if (!pos || pos === 'PH' || pos === 'PR') continue;

    const nameParts = p.person.fullName.split(' ');
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

    // Only take the first player we find at each position (starter)
    // unless we already have a non-substitute
    const existing = defense[pos];
    const isSub = p.gameStatus?.isSubstitute || false;
    if (!existing || (!isSub && existing.isSubstitute)) {
      defense[pos] = {
        name: lastName.toUpperCase(),
        jerseyNumber: p.jerseyNumber || '',
        id: p.person.id,
        isSubstitute: isSub,
      };
    }
  }

  return defense;
}

/**
 * Get all players who played each defensive position, with substitution history.
 * Returns: { [pos]: { active: {name, jerseyNumber, id}, replaced: [{name, jerseyNumber, id}] } }
 */
export function getDefenseWithSubs(boxscore, side) {
  const team = boxscore.teams[side];
  const players = team.players;
  const positionPlayers = {};

  for (const [key, p] of Object.entries(players)) {
    if (!p.allPositions || p.allPositions.length === 0) continue;

    for (const posObj of p.allPositions) {
      const pos = posObj.abbreviation;
      if (!pos || pos === 'PH' || pos === 'PR') continue;

      const nameParts = p.person.fullName.split(' ');
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

      if (!positionPlayers[pos]) positionPlayers[pos] = [];
      positionPlayers[pos].push({
        name: lastName.toUpperCase(),
        jerseyNumber: p.jerseyNumber || '',
        id: p.person.id,
        isSubstitute: p.gameStatus?.isSubstitute || false,
        isOnBench: p.gameStatus?.isOnBench || false,
      });
    }
  }

  const result = {};
  for (const [pos, list] of Object.entries(positionPlayers)) {
    // Active = not on bench (prefer non-substitute if multiple candidates)
    const active = list.find(p => !p.isOnBench && !p.isSubstitute)
                || list.find(p => !p.isOnBench)
                || list[list.length - 1];
    const replaced = list.filter(p => p !== active);
    result[pos] = { active, replaced };
  }

  return result;
}

/**
 * Extract 1B and 3B coaches from a coaches API response.
 */
export function extractBaseCoaches(coachData) {
  const roster = coachData?.roster || [];
  let firstBase = null;
  let thirdBase = null;

  for (const c of roster) {
    if (c.jobId === 'COA1' && !firstBase) {
      firstBase = c.person?.fullName || '';
    }
    if (c.jobId === 'COA3' && !thirdBase) {
      thirdBase = c.person?.fullName || '';
    }
  }
  return { firstBase, thirdBase };
}

/**
 * Compute a team's rank (1-30) for a given stat across all teams.
 * @param {number|string} teamId
 * @param {string} statKey - key in allTeamStats entry (e.g. 'era', 'errors', 'fielding', 'doublePlays')
 * @param {Object} allTeamStats - map of teamId → stats
 * @param {boolean} lowerIsBetter - true for ERA/errors, false for fielding/DP
 * @returns {number} rank 1-30
 */
export function computeTeamRank(teamId, statKey, allTeamStats, lowerIsBetter = true) {
  const entries = Object.entries(allTeamStats).map(([id, s]) => ({
    id, value: parseFloat(s[statKey]) || 0,
  }));
  entries.sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);
  const rank = entries.findIndex(e => String(e.id) === String(teamId)) + 1;
  return rank || 0;
}

/**
 * Extract umpire names from boxscore officials array.
 */
export function extractUmpires(data) {
  const officials = data.liveData?.boxscore?.officials || [];
  const umpMap = {};
  for (const o of officials) {
    const name = o.official?.fullName || '';
    switch (o.officialType) {
      case 'Home Plate': umpMap.hp = name; break;
      case 'First Base': umpMap.first = name; break;
      case 'Second Base': umpMap.second = name; break;
      case 'Third Base': umpMap.third = name; break;
    }
  }
  return umpMap;
}

/**
 * Get game info: first pitch time, attendance, duration, delays.
 */
export function getGameInfo(gameData) {
  const info = gameData.gameInfo || {};
  const weather = gameData.weather || {};
  const venue = gameData.venue || {};
  const dt = gameData.datetime || {};

  return {
    firstPitch: info.firstPitch || null,
    attendance: info.attendance || null,
    durationMinutes: info.gameDurationMinutes || null,
    weather: weather.condition ? `${Math.round((weather.temp - 32) * 5 / 9)}\u00B0C, ${weather.condition}` : '',
    wind: weather.wind || '',
    venue: venue.name || '',
    date: dt.officialDate || '',
    time: dt.time ? `${dt.time} ${dt.ampm || ''}`.trim() : '',
  };
}

/**
 * Get bench players (position players who didn't bat).
 * Returns array of { name, jerseyNumber, position, avg, obp, slg, hr, rbi }.
 */
export function getBenchPlayers(boxscore, side) {
  const team = boxscore.teams[side];
  const benchIds = team.bench || [];
  return benchIds.map(id => {
    const p = team.players[`ID${id}`];
    if (!p) return null;
    const ss = p.seasonStats?.batting || {};
    return {
      id,
      name: p.person?.fullName || `ID${id}`,
      jerseyNumber: p.jerseyNumber || '',
      position: p.position?.abbreviation || '',
      avg: ss.avg || '.000',
      obp: ss.obp || '.000',
      slg: ss.slg || '.000',
      hr: ss.homeRuns ?? 0,
      rbi: ss.rbi ?? 0,
    };
  }).filter(Boolean);
}

/**
 * Get bullpen pitchers (pitchers who didn't appear in the game).
 * Returns array of { name, jerseyNumber, era, record, sv, hld, ip, k, whip }.
 */
export function getBullpenPitchers(boxscore, side) {
  const team = boxscore.teams[side];
  const bullpenIds = team.bullpen || [];
  return bullpenIds.map(id => {
    const p = team.players[`ID${id}`];
    if (!p) return null;
    const ss = p.seasonStats?.pitching || {};
    return {
      id,
      name: p.person?.fullName || `ID${id}`,
      jerseyNumber: p.jerseyNumber || '',
      era: ss.era || '0.00',
      record: `${ss.wins ?? 0}-${ss.losses ?? 0}`,
      sv: ss.saves ?? 0,
      hld: ss.holds ?? 0,
      ip: ss.inningsPitched || '0.0',
      k: ss.strikeOuts ?? 0,
      whip: ss.whip || '0.00',
    };
  }).filter(Boolean);
}
