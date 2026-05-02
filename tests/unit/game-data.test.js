import { describe, it, expect } from 'vitest';
import {
  buildTeamLineup,
  buildScorecardGrid,
  buildSubNumberMap,
  parsePitchSequence,
  parsePlayNotation,
  getInningCount,
  getBatterStats,
  getPitchRepertoire,
  computeTeamRank,
  getPlayerBatSide,
  getPlayerPitchHand,
  getGameInfo,
  extractUmpires,
} from '../../js/game-data.js';

// ── buildTeamLineup ──────────────────────────────────────────────

describe('buildTeamLineup', () => {
  function makeBoxscore(players) {
    return {
      teams: {
        away: {
          players: Object.fromEntries(
            players.map(p => [`ID${p.id}`, p])
          ),
        },
      },
    };
  }

  it('parses battingOrder string into slot and subIndex', () => {
    const boxscore = makeBoxscore([
      { id: 1, battingOrder: '100', person: { fullName: 'A' }, position: { abbreviation: 'CF' }, jerseyNumber: '1', stats: { batting: {} } },
      { id: 2, battingOrder: '200', person: { fullName: 'B' }, position: { abbreviation: 'SS' }, jerseyNumber: '2', stats: { batting: {} } },
    ]);
    const lineup = buildTeamLineup(boxscore, 'away');
    expect(lineup).toHaveLength(9);
    expect(lineup[0].players).toHaveLength(1);
    expect(lineup[0].players[0].name).toBe('A');
    expect(lineup[1].players).toHaveLength(1);
    expect(lineup[1].players[0].name).toBe('B');
  });

  it('handles substitutes with subIndex > 0', () => {
    const boxscore = makeBoxscore([
      { id: 1, battingOrder: '100', person: { fullName: 'Starter' }, position: { abbreviation: 'CF' }, jerseyNumber: '1', stats: { batting: {} } },
      { id: 2, battingOrder: '101', person: { fullName: 'Sub1' }, position: { abbreviation: 'LF' }, jerseyNumber: '2', stats: { batting: {} } },
      { id: 3, battingOrder: '102', person: { fullName: 'Sub2' }, position: { abbreviation: 'RF' }, jerseyNumber: '3', stats: { batting: {} } },
    ]);
    const lineup = buildTeamLineup(boxscore, 'away');
    // All three should be in slot 0 (batting order 1xx)
    expect(lineup[0].players).toHaveLength(3);
    expect(lineup[0].players[0].name).toBe('Starter');
    expect(lineup[0].players[1].name).toBe('Sub1');
    expect(lineup[0].players[2].name).toBe('Sub2');
  });

  it('skips players without battingOrder', () => {
    const boxscore = makeBoxscore([
      { id: 1, battingOrder: '100', person: { fullName: 'Active' }, position: { abbreviation: 'CF' }, jerseyNumber: '1', stats: { batting: {} } },
      { id: 2, person: { fullName: 'Bench' }, position: { abbreviation: 'LF' }, jerseyNumber: '2', stats: { batting: {} } },
    ]);
    const lineup = buildTeamLineup(boxscore, 'away');
    const allPlayers = lineup.flatMap(s => s.players);
    expect(allPlayers).toHaveLength(1);
    expect(allPlayers[0].name).toBe('Active');
  });

  it('returns 9 slots even with fewer players', () => {
    const boxscore = makeBoxscore([
      { id: 1, battingOrder: '300', person: { fullName: 'Only' }, position: { abbreviation: '1B' }, jerseyNumber: '1', stats: { batting: {} } },
    ]);
    const lineup = buildTeamLineup(boxscore, 'away');
    expect(lineup).toHaveLength(9);
    expect(lineup[2].players).toHaveLength(1);
    // Other slots empty
    expect(lineup[0].players).toHaveLength(0);
  });

  it('sorts substitutes by subIndex within a slot', () => {
    const boxscore = makeBoxscore([
      { id: 3, battingOrder: '502', person: { fullName: 'Third' }, position: { abbreviation: 'CF' }, jerseyNumber: '3', stats: { batting: {} } },
      { id: 1, battingOrder: '500', person: { fullName: 'First' }, position: { abbreviation: 'CF' }, jerseyNumber: '1', stats: { batting: {} } },
      { id: 2, battingOrder: '501', person: { fullName: 'Second' }, position: { abbreviation: 'CF' }, jerseyNumber: '2', stats: { batting: {} } },
    ]);
    const lineup = buildTeamLineup(boxscore, 'away');
    expect(lineup[4].players.map(p => p.name)).toEqual(['First', 'Second', 'Third']);
  });
});

// ── buildSubNumberMap ────────────────────────────────────────────

describe('buildSubNumberMap', () => {
  it('assigns letters A, B, C to substitutes in order', () => {
    const lineup = [
      { slot: 1, players: [
        { id: 1, isSubstitute: false },
        { id: 2, isSubstitute: true },
      ]},
      { slot: 2, players: [
        { id: 3, isSubstitute: false },
        { id: 4, isSubstitute: true },
        { id: 5, isSubstitute: true },
      ]},
      ...Array(7).fill({ slot: 0, players: [] }),
    ];
    const map = buildSubNumberMap(lineup);
    expect(map.get(2)).toBe('A');
    expect(map.get(4)).toBe('B');
    expect(map.get(5)).toBe('C');
    // Starters should not be in the map
    expect(map.has(1)).toBe(false);
    expect(map.has(3)).toBe(false);
  });
});

// ── parsePitchSequence ───────────────────────────────────────────

describe('parsePitchSequence', () => {
  it('filters non-pitch events', () => {
    const events = [
      { isPitch: false, details: { call: { code: 'B' } } },
      { isPitch: true, details: { call: { code: 'S', description: 'Swinging Strike' }, type: { code: 'FF', description: 'Four-Seam Fastball' } }, pitchData: { startSpeed: 95.2 } },
    ];
    const result = parsePitchSequence(events);
    expect(result).toHaveLength(1);
    expect(result[0].callCode).toBe('S');
    expect(result[0].speed).toBe(95.2);
  });

  it('normalizes multi-char pitch codes (e.g. *B to *)', () => {
    const events = [
      { isPitch: true, details: { call: { code: '*B' } } },
      { isPitch: true, details: { call: { code: '*S' } } },
      { isPitch: true, details: { call: { code: 'B' } } },
    ];
    const result = parsePitchSequence(events);
    expect(result[0].callCode).toBe('*');
    expect(result[1].callCode).toBe('*');
    expect(result[2].callCode).toBe('B');
  });

  it('defaults strike zone dimensions when missing', () => {
    const events = [
      { isPitch: true, details: { call: { code: 'B' } }, pitchData: {} },
    ];
    const result = parsePitchSequence(events);
    expect(result[0].szTop).toBe(3.4);
    expect(result[0].szBot).toBe(1.6);
  });

  it('captures ABS challenge data', () => {
    const events = [
      { isPitch: true, details: { call: { code: 'B' } }, reviewDetails: { isOverturned: true, challengeTeamId: 141 } },
    ];
    const result = parsePitchSequence(events);
    expect(result[0].challenged).toBe(true);
    expect(result[0].overturned).toBe(true);
    expect(result[0].challengeTeamId).toBe(141);
  });

  it('handles empty events array', () => {
    expect(parsePitchSequence([])).toEqual([]);
  });
});

// ── parsePlayNotation ────────────────────────────────────────────

describe('parsePlayNotation', () => {
  function play(eventType, description = '', event = '', extras = {}) {
    return { result: { eventType, description, event }, ...extras };
  }

  // Simple event types
  it('returns BB for walk', () => {
    expect(parsePlayNotation(play('walk'))).toBe('BB');
  });

  it('returns IBB for intentional walk', () => {
    expect(parsePlayNotation(play('intent_walk'))).toBe('IBB');
  });

  it('returns HBP for hit by pitch', () => {
    expect(parsePlayNotation(play('hit_by_pitch'))).toBe('HBP');
  });

  it('returns 1B, 2B, 3B, HR for hits', () => {
    expect(parsePlayNotation(play('single'))).toBe('1B');
    expect(parsePlayNotation(play('double'))).toBe('2B');
    expect(parsePlayNotation(play('triple'))).toBe('3B');
    expect(parsePlayNotation(play('home_run'))).toBe('HR');
  });

  // Strikeouts
  it('returns K for swinging strikeout', () => {
    const p = play('strikeout', '', '', {
      playEvents: [{ isPitch: true, details: { call: { code: 'S' } } }],
      matchup: { batter: { id: 1 } },
    });
    expect(parsePlayNotation(p)).toBe('K');
  });

  it('returns backwards K for called third strike', () => {
    const p = play('strikeout', '', '', {
      playEvents: [{ isPitch: true, details: { call: { code: 'C' } } }],
      matchup: { batter: { id: 1 } },
    });
    expect(parsePlayNotation(p)).toBe('\u{A4D8}'); // ꓘ
  });

  it('returns K WP for dropped third strike with wild pitch', () => {
    const p = play('strikeout', 'strikes out on a wild pitch by the pitcher', '', {
      playEvents: [{ isPitch: true, details: { call: { code: 'S' } } }],
      matchup: { batter: { id: 1 } },
      runners: [{ details: { runner: { id: 1 } }, movement: { isOut: false, end: '1B' } }],
    });
    expect(parsePlayNotation(p)).toBe('K WP');
  });

  // Field outs
  it('parses flyout with position (F8)', () => {
    const p = play('field_out', 'Trout flies out to center fielder', 'Flyout');
    expect(parsePlayNotation(p)).toBe('F8');
  });

  it('parses lineout with position (L3)', () => {
    const p = play('field_out', 'Batter lines out to first baseman', 'Lineout');
    expect(parsePlayNotation(p)).toBe('L3');
  });

  it('parses pop out with position (P2)', () => {
    const p = play('field_out', 'Batter pops out to catcher', 'Pop Out');
    expect(parsePlayNotation(p)).toBe('P2');
  });

  it('parses groundout with assist chain (G63)', () => {
    const p = play('field_out', 'Batter grounds out, shortstop to first baseman', 'Groundout');
    expect(parsePlayNotation(p)).toBe('G63');
  });

  it('parses unassisted groundout (G3)', () => {
    const p = play('field_out', 'Batter grounds out to first baseman unassisted', 'Groundout');
    expect(parsePlayNotation(p)).toBe('G3');
  });

  it('detects infield fly rule (IFF)', () => {
    const p = play('field_out', 'Batter flies out to shortstop, infield fly rule', 'Flyout');
    expect(parsePlayNotation(p)).toBe('F6(IFF)');
  });

  // Double plays
  it('parses double play with positions (DP643)', () => {
    const p = play('grounded_into_double_play', 'Batter grounded into double play, shortstop to second baseman to first baseman');
    expect(parsePlayNotation(p)).toBe('DP643');
  });

  // Sac bunt
  it('parses sac bunt with positions (SH15)', () => {
    const p = play('sac_bunt', 'Batter sac bunt, pitcher to first baseman');
    expect(parsePlayNotation(p)).toBe('SH13');
  });

  // Sac fly
  it('parses sac fly with fielder number (SF9)', () => {
    const p = play('sac_fly', 'Batter flies out to right fielder, sac fly');
    expect(parsePlayNotation(p)).toBe('SF9');
  });

  // Errors
  it('parses error with position (E6)', () => {
    const p = play('field_error', 'Batter reaches on error by shortstop');
    expect(parsePlayNotation(p)).toBe('E6');
  });

  // Fielder's choice
  it('returns FC for fielders choice', () => {
    const p = play('fielders_choice', 'Fielders choice', '', {
      runners: [],
    });
    expect(parsePlayNotation(p)).toBe('FC');
  });

  // Stolen bases, pickoffs, etc.
  it('returns SB for stolen base', () => {
    expect(parsePlayNotation(play('stolen_base_2b'))).toBe('SB');
  });

  it('returns CS for caught stealing', () => {
    expect(parsePlayNotation(play('caught_stealing_2b'))).toBe('CS');
  });

  it('returns PO for pickoff', () => {
    expect(parsePlayNotation(play('pickoff_1b'))).toBe('PO');
  });

  it('returns WP for wild pitch', () => {
    expect(parsePlayNotation(play('wild_pitch'))).toBe('WP');
  });

  it('returns BK for balk', () => {
    expect(parsePlayNotation(play('balk'))).toBe('BK');
  });

  // Non-play events return empty string
  it('returns empty string for substitutions and non-plays', () => {
    expect(parsePlayNotation(play('pitching_substitution'))).toBe('');
    expect(parsePlayNotation(play('offensive_substitution'))).toBe('');
    expect(parsePlayNotation(play('defensive_substitution'))).toBe('');
    expect(parsePlayNotation(play('game_advisory'))).toBe('');
    expect(parsePlayNotation(play('runner_placed'))).toBe('');
  });

  // Interference
  it('returns CI for catcher interference', () => {
    expect(parsePlayNotation(play('catcher_interf'))).toBe('CI');
  });

  // Edge: triple play
  it('parses triple play with positions', () => {
    const p = play('triple_play', 'Triple play, shortstop to second baseman to first baseman');
    expect(parsePlayNotation(p)).toBe('TP643');
  });
});

// ── getInningCount ───────────────────────────────────────────────

describe('getInningCount', () => {
  it('returns 9 for regular game', () => {
    expect(getInningCount({ innings: Array(9).fill({}) })).toBe(9);
  });

  it('returns actual count for extra innings', () => {
    expect(getInningCount({ innings: Array(12).fill({}) })).toBe(12);
  });

  it('returns 9 for short games (less than 9 innings data)', () => {
    expect(getInningCount({ innings: Array(5).fill({}) })).toBe(9);
  });
});

// ── getBatterStats ───────────────────────────────────────────────

describe('getBatterStats', () => {
  it('returns stats map for players with battingOrder', () => {
    const boxscore = {
      teams: {
        home: {
          players: {
            ID100: { person: { id: 100 }, battingOrder: '100', stats: { batting: { atBats: 4, runs: 1, hits: 2, rbi: 1 } } },
            ID200: { person: { id: 200 }, stats: { batting: { atBats: 0 } } }, // no battingOrder, should be excluded
          },
        },
      },
    };
    const stats = getBatterStats(boxscore, 'home');
    expect(stats.get(100)).toEqual({ ab: 4, r: 1, h: 2, rbi: 1 });
    expect(stats.has(200)).toBe(false);
  });
});

// ── getPitchRepertoire ───────────────────────────────────────────

describe('getPitchRepertoire', () => {
  it('aggregates pitch types with counts and average velocity', () => {
    const allPlays = [{
      matchup: { pitcher: { id: 42 } },
      playEvents: [
        { isPitch: true, details: { type: { code: 'FF', description: 'Four-Seam Fastball' } }, pitchData: { startSpeed: 95 } },
        { isPitch: true, details: { type: { code: 'FF', description: 'Four-Seam Fastball' } }, pitchData: { startSpeed: 97 } },
        { isPitch: true, details: { type: { code: 'SL', description: 'Slider' } }, pitchData: { startSpeed: 85 } },
        { isPitch: false, details: { type: { code: 'FF' } } }, // not a pitch, skip
      ],
    }];
    const result = getPitchRepertoire(allPlays, 42);
    expect(result).toHaveLength(2);
    // Sorted by usage descending
    expect(result[0].code).toBe('FF');
    expect(result[0].count).toBe(2);
    expect(result[0].avgVelo).toBe('96.0');
    expect(result[1].code).toBe('SL');
    expect(result[1].count).toBe(1);
  });

  it('returns empty array for pitcher with no pitches', () => {
    expect(getPitchRepertoire([], 42)).toEqual([]);
  });
});

// ── computeTeamRank ──────────────────────────────────────────────

describe('computeTeamRank', () => {
  const stats = {
    1: { era: 3.50, hr: 50 },
    2: { era: 4.20, hr: 80 },
    3: { era: 2.90, hr: 60 },
  };

  it('ranks with lowerIsBetter=true (ERA)', () => {
    expect(computeTeamRank(3, 'era', stats, true)).toBe(1);  // 2.90 is best
    expect(computeTeamRank(1, 'era', stats, true)).toBe(2);  // 3.50
    expect(computeTeamRank(2, 'era', stats, true)).toBe(3);  // 4.20 is worst
  });

  it('ranks with lowerIsBetter=false (HR)', () => {
    expect(computeTeamRank(2, 'hr', stats, false)).toBe(1);  // 80 is best
    expect(computeTeamRank(3, 'hr', stats, false)).toBe(2);
    expect(computeTeamRank(1, 'hr', stats, false)).toBe(3);
  });

  it('returns 0 for unknown team', () => {
    expect(computeTeamRank(999, 'era', stats, true)).toBe(0);
  });
});

// ── getPlayerBatSide / getPlayerPitchHand ─────────────────────────

describe('player lookups', () => {
  const gameData = {
    players: {
      ID100: { batSide: { code: 'L' }, pitchHand: { code: 'R' } },
      ID200: { batSide: { code: 'S' }, pitchHand: { code: 'L' } },
    },
  };

  it('returns bat side code', () => {
    expect(getPlayerBatSide(gameData, 100)).toBe('L');
    expect(getPlayerBatSide(gameData, 200)).toBe('S');
  });

  it('returns pitch hand code', () => {
    expect(getPlayerPitchHand(gameData, 100)).toBe('R');
    expect(getPlayerPitchHand(gameData, 200)).toBe('L');
  });

  it('returns empty string for unknown player', () => {
    expect(getPlayerBatSide(gameData, 999)).toBe('');
    expect(getPlayerPitchHand(gameData, 999)).toBe('');
  });
});

// ── extractUmpires ───────────────────────────────────────────────

describe('extractUmpires', () => {
  it('extracts umpires by position', () => {
    const data = {
      liveData: {
        boxscore: {
          officials: [
            { officialType: 'Home Plate', official: { fullName: 'Angel Hernandez' } },
            { officialType: 'First Base', official: { fullName: 'Joe West' } },
            { officialType: 'Second Base', official: { fullName: 'CB Bucknor' } },
            { officialType: 'Third Base', official: { fullName: 'Ron Kulpa' } },
          ],
        },
      },
    };
    const umps = extractUmpires(data);
    expect(umps.hp).toBe('Angel Hernandez');
    expect(umps.first).toBe('Joe West');
    expect(umps.second).toBe('CB Bucknor');
    expect(umps.third).toBe('Ron Kulpa');
  });
});

// ── getGameInfo ──────────────────────────────────────────────────

describe('getGameInfo', () => {
  it('converts temperature from F to C', () => {
    const gameData = {
      datetime: { dateTime: '2025-07-04T17:10:00Z', time: '1:10', ampm: 'PM' },
      weather: { temp: '77', condition: 'Clear', wind: '10 mph, Out to CF' },
      venue: { name: 'Rogers Centre', fieldInfo: { capacity: 49282 } },
      game: { officialDate: '2025-07-04' },
      gameInfo: { attendance: 45000, gameDurationMinutes: 187 },
    };
    const info = getGameInfo(gameData);
    expect(info.weather).toContain('77');
    expect(info.venue).toBe('Rogers Centre');
    expect(info.attendance).toBe(45000);
    expect(info.durationMinutes).toBe(187);
  });
});

// ── buildScorecardGrid ───────────────────────────────────────────

describe('buildScorecardGrid bat-around', () => {
  // Lineup: slot 1 = batter A (id 1), slot 2 = batter B (id 2)
  const lineup = [
    { slot: 1, players: [{ id: 1, name: 'A' }] },
    { slot: 2, players: [{ id: 2, name: 'B' }] },
  ];
  const boxscore = {
    teams: {
      home: { pitchers: [99], players: { ID99: { person: { id: 99 } } } },
      away: { pitchers: [98], players: { ID98: { person: { id: 98 } } } },
    },
  };

  function makePlay({ atBatIndex, batterId, eventType, runners }) {
    return {
      atBatIndex,
      result: { type: 'atBat', eventType, event: eventType, rbi: 0 },
      about: { inning: 1, halfInning: 'top', isComplete: true },
      matchup: {
        batter: { id: batterId, fullName: `B${batterId}` },
        pitcher: { id: 99, fullName: 'P' },
        batSide: { code: 'R' },
        pitchHand: { code: 'R' },
      },
      playEvents: [],
      runners,
    };
  }

  it('does not duplicate the out marker when batter A has two PAs (single, then flyout)', () => {
    // PA1 of A: single → reaches 1B
    // PA1 of B: HR (scores both A and B) — A's first journey scores
    // PA2 of A: flyout to RF, outNumber=1
    const plays = [
      makePlay({
        atBatIndex: 0, batterId: 1, eventType: 'single',
        runners: [{
          movement: { originBase: null, end: '1B', isOut: false },
          details: { runner: { id: 1, fullName: 'A' }, event: 'Single' },
        }],
      }),
      makePlay({
        atBatIndex: 1, batterId: 2, eventType: 'home_run',
        runners: [
          { movement: { originBase: '1B', end: 'score', isOut: false },
            details: { runner: { id: 1, fullName: 'A' }, event: 'Home Run' } },
          { movement: { originBase: null, end: 'score', isOut: false },
            details: { runner: { id: 2, fullName: 'B' }, event: 'Home Run' } },
        ],
      }),
      makePlay({
        atBatIndex: 2, batterId: 1, eventType: 'field_out',
        runners: [{
          movement: { originBase: null, end: null, isOut: true, outNumber: 1, outBase: '1B' },
          details: { runner: { id: 1, fullName: 'A' }, event: 'Flyout' },
        }],
      }),
    ];

    const grid = buildScorecardGrid(plays, 'top', lineup, boxscore, 'away');
    const aCells = grid.get('1-1');
    expect(aCells).toHaveLength(2);

    const [pa1, pa2] = aCells;
    // PA1: A reached 1B and scored — out info must NOT leak from PA2 (the bug)
    expect(pa1.outNumber).toBeNull();
    expect(pa1.cumulativeRunners[0].isOut).toBe(false);
    expect(pa1.cumulativeRunners[0].scored).toBe(true);
    expect(pa1.cumulativeRunners[0].outNumber).toBeNull();

    // PA2: flyout — out marker comes from ab.outNumber (top-left badge)
    expect(pa2.outNumber).toBe(1);
  });

  it('keeps a single PA working unchanged', () => {
    const plays = [
      makePlay({
        atBatIndex: 0, batterId: 1, eventType: 'field_out',
        runners: [{
          movement: { originBase: null, end: null, isOut: true, outNumber: 1, outBase: '1B' },
          details: { runner: { id: 1, fullName: 'A' }, event: 'Groundout' },
        }],
      }),
    ];
    const grid = buildScorecardGrid(plays, 'top', lineup, boxscore, 'away');
    const cells = grid.get('1-1');
    expect(cells).toHaveLength(1);
    expect(cells[0].outNumber).toBe(1);
  });
});
