// Game data parsing: transforms GUMBO feed into scorecard structures

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

  // Identify starting pitcher (first pitcher faced by this batting side)
  const oppSide = side === 'away' ? 'home' : 'away';
  const oppTeam = boxscore.teams[oppSide];
  const startingPitcherId = (oppTeam.pitchers || [])[0] || null;
  let spKCount = 0;
  let spRemoved = false;

  // Track cumulative runner journeys per inning
  // Map<inning, Map<playerId, {segments, currentBase, scored, isOut, outBase}>>
  const journeysByInning = new Map();

  // Track pinch-runner replacements: prReplacedBy[originalId] = prId
  // so we can merge the PR's journey back onto the original batter's cell
  const prReplacedBy = new Map();

  function addJourneySegments(j, from, to, isScore, isRunnerOut, advanceType) {
    const order = ['HP', '1B', '2B', '3B'];
    let startIdx = order.indexOf(from);
    if (startIdx === -1) startIdx = 0;
    let numSegs;
    if (isScore) { numSegs = 4 - startIdx; }
    else {
      let endIdx = order.indexOf(to);
      if (endIdx === -1) endIdx = 0;
      numSegs = endIdx - startIdx;
      if (numSegs <= 0) numSegs = 0;
    }
    for (let n = 0; n < numSegs; n++) {
      const segFrom = order[(startIdx + n) % 4];
      const segTo = order[(startIdx + n + 1) % 4];
      if (!j.segments.some(s => s.from === segFrom && s.to === segTo)) {
        const isLastSeg = n === numSegs - 1;
        j.segments.push({ from: segFrom, to: segTo, isOutSegment: isRunnerOut && isLastSeg, advanceType: advanceType || 'hit' });
      }
    }
    j.currentBase = isScore ? null : to;
    j.scored = j.scored || isScore;
    if (isRunnerOut) {
      j.isOut = true;
      j.outBase = to;
    }
  }

  for (const play of plays) {
    if (play.result.type !== 'atBat') continue;
    const batterId = play.matchup.batter.id;
    const slot = playerSlotMap.get(batterId);
    if (!slot) continue;

    const inning = play.about.inning;
    if (!journeysByInning.has(inning)) journeysByInning.set(inning, new Map());
    const journeys = journeysByInning.get(inning);

    const ab = parseAtBat(play);

    // Check for substitution events
    for (const ev of play.playEvents || []) {
      if (ev.type === 'action' && ev.details?.event === 'Pitching Substitution') {
        spRemoved = true;
      }
      // Extra innings: runner placed on base (Manfred runner)
      if (ev.type === 'action' && ev.details?.event === 'Runner Placed On Base') {
        const placedId = ev.player?.id;
        if (placedId) {
          // Create a journey starting at 2B with HP→1B→2B already drawn
          if (!journeys.has(placedId)) {
            journeys.set(placedId, {
              segments: [
                { from: 'HP', to: '1B' },
                { from: '1B', to: '2B' },
              ],
              currentBase: '2B',
              scored: false,
              isOut: false,
              outBase: null,
            });
          }
          // Mark this at-bat so we attach the placed runner's journey to it later
          ab._placedRunnerId = placedId;
        }
      }
      // Track pinch-runner replacements so their journey merges onto the original batter's cell
      if (ev.type === 'action' && ev.details?.event === 'Offensive Substitution') {
        const desc = (ev.details?.description || '').toLowerCase();
        if (desc.includes('pinch-runner') || desc.includes('pinch runner')) {
          const prId = ev.player?.id;
          if (prId) {
            // The PR inherits the same lineup slot. Find who they replaced
            // by looking for the player in the same slot who has an active
            // baserunning journey this inning (i.e. is currently on base).
            const prSlot = playerSlotMap.get(prId);
            const journeys = journeysByInning.get(inning);
            if (prSlot && journeys) {
              for (const [pid, j] of journeys) {
                if (pid !== prId && playerSlotMap.get(pid) === prSlot && j.currentBase && !j.scored && !j.isOut) {
                  prReplacedBy.set(pid, prId);
                  // Create a journey for the PR at the original runner's base
                  // so pickoff/CS outs during later at-bats get recorded on the PR's journey
                  journeys.set(prId, { segments: [], currentBase: j.currentBase, scored: false, isOut: false, outBase: null });
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Track SP strikeout count
    const isK = ab.notation === 'K' || ab.notation === '\u{A4D8}';
    if (isK && !spRemoved && ab.pitcherId === startingPitcherId) {
      spKCount++;
      ab.spKNumber = spKCount;
    }

    // Attach RBI count from play result
    ab.rbi = play.result.rbi || 0;

    // Update cumulative journeys with this at-bat's runner movements
    for (const runner of ab.runners) {
      if (!runner.playerId) continue;
      // Runner thrown out with no end base: add out segment and record the out
      if (!runner.end && runner.isOut) {
        const pid = runner.playerId;
        if (journeys.has(pid)) {
          const j = journeys.get(pid);
          const outBase = runner.outBase || j.currentBase;
          // Add segment from current base to outBase so the out marker lands on the path
          if (j.currentBase && outBase && j.currentBase !== outBase) {
            // Out at home (3B→HP) needs isScore=true to wrap around the base order
            const isOutAtHome = outBase === 'HP';
            addJourneySegments(j, j.currentBase, isOutAtHome ? 'HP' : outBase, isOutAtHome, true);
          } else {
            // Out at current base (e.g., pickoff). Don't alter existing segments,
            // just record the out so the marker draws at the base position
            j.isOut = true;
            j.outBase = outBase;
          }
          if (runner.outNumber) j.outNumber = runner.outNumber;
        }
        continue;
      }
      if (!runner.end) continue;
      const pid = runner.playerId;
      if (!journeys.has(pid)) {
        journeys.set(pid, { segments: [], currentBase: null, scored: false, isOut: false, outBase: null });
      }
      const j = journeys.get(pid);
      const from = runner.start || 'HP';
      const to = runner.end === 'score' ? 'HP' : runner.end;
      const isScore = runner.end === 'score';
      // Detect advance type from runner event
      const revt = (runner.event || '').toLowerCase();
      let advType = 'hit';
      if (revt.includes('stolen base')) advType = 'sb';
      else if (revt.includes('caught stealing')) advType = 'cs';
      else if (revt.includes('pickoff')) advType = 'po';
      else if (revt.includes('wild pitch')) advType = 'wp';
      else if (revt.includes('passed ball')) advType = 'pb';
      else if (revt.includes('balk')) advType = 'bk';
      else if (revt.includes('error')) advType = 'error';
      else if (revt.includes('fielder') || revt.includes('force')) advType = 'fc';
      addJourneySegments(j, from, to, isScore, runner.isOut, advType);
      if (runner.isOut && runner.outNumber) j.outNumber = runner.outNumber;
    }

    // Clear cumulativeRunners; will be populated in second pass
    ab.cumulativeRunners = [];

    const key = `${slot}-${inning}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(ab);
  }

  // ─── Second pass: attach each runner's full journey to THEIR OWN cell ───
  // After all plays are processed, each player's cumulative journey goes on
  // the diamond in the cell where THEY batted, not where they were advanced.
  for (const [inning, journeys] of journeysByInning) {
    for (const [playerId, journey] of journeys) {
      // Find the cell where this player batted this inning
      const slot = playerSlotMap.get(playerId);
      if (!slot) continue;
      const key = `${slot}-${inning}`;
      const cells = grid.get(key);
      // Find the at-bat belonging to this batter
      const ab = cells?.find(c => c.batterId === playerId);
      if (ab) {
        ab.cumulativeRunners = [{
          playerId,
          segments: [...journey.segments],
          currentBase: journey.currentBase,
          scored: journey.scored,
          isOut: journey.isOut,
          outBase: journey.outBase,
          outNumber: journey.outNumber || null,
        }];
      } else if (journey.currentBase || journey.segments.length > 0) {
        // Placed runner (extra innings Manfred runner): didn't bat this inning.
        // Create a cell in their OWN slot for this inning showing their journey.
        const runnerJourney = {
          playerId,
          segments: [...journey.segments],
          currentBase: journey.currentBase,
          scored: journey.scored,
          isOut: journey.isOut,
          outBase: journey.outBase,
          outNumber: journey.outNumber || null,
        };
        const runnerKey = `${slot}-${inning}`;
        const existing = grid.get(runnerKey);
        if (existing && existing.length > 0) {
          // Cell exists (maybe they batted later in a bat-around), attach
          const cell = existing[0];
          if (!cell.cumulativeRunners) cell.cumulativeRunners = [];
          cell.cumulativeRunners.push(runnerJourney);
        } else {
          // No cell exists for this player in this inning. Create a
          // placeholder at-bat entry so the diamond renders their journey.
          const placedAb = {
            batterId: playerId,
            notation: '',
            outNumber: null,
            pitchSequence: [],
            cumulativeRunners: [runnerJourney],
            runners: [],
            result: { rbi: 0 },
            isPlacedRunner: true,
          };
          if (!grid.has(runnerKey)) grid.set(runnerKey, []);
          grid.get(runnerKey).push(placedAb);
        }
      }
    }
  }

  // ─── Third pass: add pickoff/CS out markers to the at-bat cell where they occurred ───
  // When a runner is picked off or caught stealing during another batter's at-bat,
  // the out marker (with out number) needs to appear in THAT batter's cell, not the
  // runner's original cell. This ensures the out count is visually correct per cell.
  // Skip pinch runners — their outs are merged onto the original batter's cell by the PR merge.
  const prIds = new Set(prReplacedBy.values());
  for (const [, abs] of grid) {
    for (const ab of abs) {
      if (!ab.runners) continue;
      for (const r of ab.runners) {
        if (r.isOut && r.outBase && r.playerId !== ab.batterId && !prIds.has(r.playerId)) {
          if (!ab.cumulativeRunners) ab.cumulativeRunners = [];
          // Only add if not already present
          if (!ab.cumulativeRunners.some(cr => cr.playerId === r.playerId && cr.outBase === r.outBase)) {
            ab.cumulativeRunners.push({
              playerId: r.playerId,
              segments: [],
              currentBase: null,
              scored: false,
              isOut: true,
              outBase: r.outBase,
              outNumber: r.outNumber || null,
            });
          }
        }
      }
    }
  }

  // Merge pinch-runner journeys into the original batter's cell.
  // When a PR replaces a batter, the PR's baserunning continues the
  // original batter's path, so the diamond should show the full journey.
  for (const [originalId, prId] of prReplacedBy) {
    const slot = playerSlotMap.get(originalId);
    if (!slot) continue;
    for (const [inning, journeys] of journeysByInning) {
      const prJourney = journeys.get(prId);
      if (!prJourney || (prJourney.segments.length === 0 && !prJourney.isOut)) continue;
      const key = `${slot}-${inning}`;
      const cells = grid.get(key);
      if (!cells) continue;
      const ab = cells.find(c => c.batterId === originalId);
      if (!ab || !ab.cumulativeRunners || ab.cumulativeRunners.length === 0) continue;
      const runner = ab.cumulativeRunners[0];
      // Append PR segments that aren't already in the original journey
      for (const seg of prJourney.segments) {
        if (!runner.segments.some(s => s.from === seg.from && s.to === seg.to)) {
          runner.segments.push({ ...seg });
        }
      }
      runner.scored = runner.scored || prJourney.scored;
      runner.currentBase = prJourney.currentBase;
      if (prJourney.isOut) {
        runner.isOut = true;
        runner.outBase = prJourney.outBase;
        runner.outNumber = prJourney.outNumber;
      }
    }
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
        // Pitcher subs are handled below by detecting actual pitcher ID changes
        // between completed at-bats. This ensures the line only appears once the
        // new pitcher has actually thrown a pitch, not just when the sub is announced.
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
        const existing = subMap.get(key);
        const samePlayerIdx = existing.findIndex(s => s.playerId === playerId);
        if (samePlayerIdx !== -1) {
          // PH/PR take priority over defensive — don't let defensive overwrite
          if (subType !== 'defensive') {
            existing[samePlayerIdx].type = subType;
          }
        } else if (!existing.some(s => s.type === subType)) {
          existing.push({ type: subType, playerId });
        }
      }
    }
  }

  // Detect pitcher substitutions by comparing pitcher IDs between consecutive
  // completed at-bats in the same half-inning. The sub line is placed on the
  // cell of the FIRST batter to face the new pitcher, which confirms the change
  // actually happened (the new pitcher has thrown at least one pitch).
  const relevantPlays = allPlays.filter(p => p.about.halfInning === halfInning && p.about.isComplete);
  let prevPitcherId = null;
  let prevBatterId = null;
  let prevInning = null;
  for (const play of relevantPlays) {
    const pitcherId = play.matchup?.pitcher?.id;
    if (prevPitcherId && pitcherId && pitcherId !== prevPitcherId) {
      // Pitcher changed — place sub line on the PREVIOUS batter's cell
      // (the last at-bat by the departing pitcher, not the first by the new one)
      const slot = playerSlotMap.get(prevBatterId);
      if (slot && prevInning) {
        const key = `${slot}-${prevInning}`;
        if (!subMap.has(key)) subMap.set(key, []);
        const existing = subMap.get(key);
        if (!existing.some(s => s.type === 'pitcher')) {
          existing.push({ type: 'pitcher', playerId: prevPitcherId });
        }
      }
    }
    prevPitcherId = pitcherId;
    prevBatterId = play.matchup?.batter?.id;
    prevInning = play.about.inning;
  }

  return subMap;
}

/**
 * Build a map from player ID to their global substitution letter (a, b, c...).
 * Order matches the lineup: slot 1 subs first, then slot 2, etc.
 */
export function buildSubNumberMap(lineup) {
  const map = new Map();
  let subCount = 0;
  for (const slot of lineup) {
    for (const p of slot.players) {
      if (p.isSubstitute) {
        map.set(p.id, String.fromCharCode(65 + subCount)); // A, B, C...
        subCount++;
      }
    }
  }
  return map;
}

function parseAtBat(play) {
  const runners = parseRunners(play.runners || []);
  // Find the batter's out number (runner entry where playerId matches batter and isOut)
  const batterId = play.matchup.batter.id;
  const batterRunner = runners.find(r => r.playerId === batterId && r.isOut);
  return {
    batterId,
    batterName: play.matchup.batter.fullName,
    pitcherId: play.matchup.pitcher.id,
    pitcherName: play.matchup.pitcher.fullName,
    batSide: play.matchup.batSide?.code || '',
    pitchHand: play.matchup.pitchHand?.code || '',
    inning: play.about.inning,
    pitchSequence: parsePitchSequence(play.playEvents || []),
    notation: play.about.isComplete ? parsePlayNotation(play) : '',
    runners,
    result: play.result,
    about: play.about,
    outNumber: batterRunner?.outNumber || null,
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
    const review = ev.reviewDetails || (ev.details?.hasReview ? {} : null);
    pitches.push({
      callCode: normalizePitchCall(rawCode),
      call: ev.details?.call?.description || '',
      typeCode: ev.details?.type?.code || '',
      type: ev.details?.type?.description || '',
      speed: ev.pitchData?.startSpeed || null,
      pX: coords.pX ?? null,
      pZ: coords.pZ ?? null,
      szTop: ev.pitchData?.strikeZoneTop ?? 3.4,
      szBot: ev.pitchData?.strikeZoneBottom ?? 1.6,
      // ABS challenge data
      challenged: !!review,
      overturned: review?.isOverturned || false,
      challengeTeamId: review?.challengeTeamId || null,
    });
  }
  return pitches;
}

function normalizePitchCall(code) {
  if (code.startsWith('*')) return '*';
  return code;
}

// ─── Play notation ───────────────────────────────────────────────

const EVENT_ABBREVS = {
  'Mound Visit': 'MV',
  'Caught Stealing': 'CS',
  'Pickoff': 'PO',
  'Stolen Base': 'SB',
  'Wild Pitch': 'WP',
  'Passed Ball': 'PB',
  'Balk': 'BK',
  'Runner Out': 'OUT',
  'Game Advisory': '',
  'Injury': 'INJ',
  'Ejection': 'EJ',
  'Umpire Substitution': '',
  'Pitching Substitution': '',
  'Offensive Substitution': '',
  'Defensive Sub': '',
  'Defensive Switch': '',
  'Defensive Indifference': 'DI',
  'Other Advance': 'ADV',
};

function abbreviateEvent(event) {
  if (!event) return '';
  if (EVENT_ABBREVS[event] !== undefined) return EVENT_ABBREVS[event];
  // Try partial matches
  const lower = event.toLowerCase();
  if (lower.includes('mound visit')) return 'MV';
  if (lower.includes('caught stealing')) return 'CS';
  if (lower.includes('pickoff')) return 'PO';
  if (lower.includes('stolen base')) return 'SB';
  if (lower.includes('wild pitch')) return 'WP';
  if (lower.includes('passed ball')) return 'PB';
  // Fallback: return first 6 chars
  return event.length > 6 ? event.substring(0, 6) : event;
}

export function parsePlayNotation(play) {
  const event = play.result.event || '';
  const eventType = play.result.eventType || '';
  const desc = play.result.description || '';

  switch (eventType) {
    case 'strikeout':
      return parseStrikeout(play);
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
    case 'double_play': return parseDoublePlay(desc);
    case 'strikeout_double_play': return parseStrikeoutDP(play, desc);
    case 'triple_play': return parseTriplePlay(desc);
    case 'fielders_choice': return parseFieldersChoice(play);
    case 'fielders_choice_out': return parseFieldersChoice(play);
    case 'force_out': return parseFieldersChoice(play);
    case 'field_error': return parseError(desc);
    case 'catcher_interf': return 'CI';
    case 'batter_interference': return 'BI';
    case 'fielder_interference': return 'FI';
    case 'runner_interference': return 'RI';
    case 'fan_interference': return 'FI';
    case 'caught_stealing':
    case 'caught_stealing_2b':
    case 'caught_stealing_3b':
    case 'caught_stealing_home': return 'CS';
    case 'cs_double_play': return 'CSDP';
    case 'pickoff':
    case 'pickoff_1b':
    case 'pickoff_2b':
    case 'pickoff_3b': return 'PO';
    case 'pickoff_error_1b':
    case 'pickoff_error_2b':
    case 'pickoff_error_3b': return 'POE';
    case 'pickoff_caught_stealing_2b':
    case 'pickoff_caught_stealing_3b':
    case 'pickoff_caught_stealing_home': return 'POCS';
    case 'stolen_base':
    case 'stolen_base_2b':
    case 'stolen_base_3b':
    case 'stolen_base_home': return 'SB';
    case 'wild_pitch': return 'WP';
    case 'passed_ball': return 'PB';
    case 'balk':
    case 'forced_balk': return 'BK';
    case 'other_out': {
      const d = (play.result.description || '').toLowerCase();
      if (d.includes('obstruction')) return 'OBS';
      if (d.includes('interference')) return 'INT';
      return 'OUT';
    }
    case 'runner_double_play': {
      const d = (play.result.description || '').toLowerCase();
      if (d.includes('interference')) return 'RIDP';
      return parseDoublePlay(desc) || 'DP';
    }
    case 'other_advance': {
      const d = (play.result.description || '').toLowerCase();
      if (d.includes('obstruction')) return 'OBS';
      return 'ADV';
    }
    case 'defensive_indiff': return 'DI';
    case 'grounded_into_triple_play': return parseTriplePlay(desc);
    case 'strikeout_triple_play': return parseStrikeout(play) + 'TP';
    case 'sac_fly_double_play': return 'SFDP';
    case 'sac_bunt_double_play': return 'SHDP';
    case 'error': return parseError(desc);
    case 'runner_placed': return '';
    // Non-play events: return empty so they don't render
    case 'batter_turn':
    case 'at_bat_start':
    case 'mound_visit':
    case 'no_pitch':
    case 'pitcher_step_off':
    case 'batter_timeout':
    case 'ejection':
    case 'injury':
    case 'game_advisory':
    case 'os_ruling_pending_prior':
    case 'os_ruling_pending_primary':
    case 'pitching_substitution':
    case 'offensive_substitution':
    case 'defensive_substitution':
    case 'defensive_switch':
    case 'umpire_substitution':
    case 'pitcher_switch': return '';
    default: return abbreviateEvent(event || eventType);
  }
}

function parseStrikeout(play) {
  const k = isCalledThirdStrike(play) ? 'ꓘ' : 'K';
  // Check for dropped/uncaught third strike where batter reaches base
  const batterRunner = (play.runners || []).find(r =>
    r.details?.runner?.id === play.matchup.batter.id && !r.movement?.isOut && r.movement?.end === '1B'
  );
  if (batterRunner) {
    // Batter reached on uncaught third strike: check if WP, PB, or generic
    const desc = (play.result.description || '').toLowerCase();
    if (desc.includes('wild pitch')) return k + ' WP';
    if (desc.includes('passed ball')) return k + ' PB';
    // Generic dropped third strike
    return k + ' E2';
  }
  return k;
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
  const iff = lower.includes('infield fly') ? '(IFF)' : '';

  if (lower.includes('flies out') || lower.includes('fly ball')) {
    const pos = findPositionAfter(lower, 'to ');
    if (pos) return `F${pos}${iff}`;
  }
  if (lower.includes('lines out') || lower.includes('line drive')) {
    const pos = findPositionAfter(lower, 'to ');
    if (pos) return `L${pos}`;
  }
  if (lower.includes('pops out') || lower.includes('pop up')) {
    const pos = findPositionAfter(lower, 'to ');
    if (pos) return `P${pos}${iff}`;
  }
  if (lower.includes('grounds out') || lower.includes('ground ball')) {
    const positions = extractAllPositions(lower);
    const deduped = positions.filter((p, i) => i === 0 || p !== positions[i - 1]);
    const unassisted = lower.includes('unassisted') || deduped.length === 1;
    if (unassisted && deduped.length >= 1) return `G${deduped[0]}`;
    if (deduped.length >= 2) return 'G' + deduped.join('');
  }
  if (lower.includes('sacrifice bunt')) return parseSacBunt(desc);

  const positions = extractAllPositions(lower);
  if (positions.length > 0) {
    if (event === 'Flyout') return `F${positions[0]}${iff}`;
    if (event === 'Lineout') return `L${positions[0]}${iff}`;
    if (event === 'Pop Out') return `P${positions[0]}${iff}`;
    if (event === 'Groundout') {
      const gDeduped = positions.filter((p, i) => i === 0 || p !== positions[i - 1]);
      const gUnassisted = lower.includes('unassisted') || gDeduped.length === 1;
      if (gUnassisted) return `G${gDeduped[0]}`;
      return 'G' + gDeduped.join('');
    }
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
  const lower = desc.toLowerCase();
  const positions = extractAllPositions(lower);
  if (positions.length >= 2) return 'DP' + positions.join('');
  return 'DP';
}

function parseStrikeoutDP(play, desc) {
  const k = isCalledThirdStrike(play) ? '\u{A4D8}' : 'K';
  const positions = extractAllPositions(desc.toLowerCase());
  if (positions.length >= 2) return k + '+' + positions.join('');
  return k + 'DP';
}

function parseTriplePlay(desc) {
  const positions = extractAllPositions(desc.toLowerCase());
  if (positions.length >= 2) return 'TP' + positions.join('');
  return 'TP';
}

function parseFieldersChoice(play) {
  // Extract fielder chain from runners' credits
  const runners = play.runners || [];
  const creditPositions = [];
  for (const r of runners) {
    if (r.movement?.isOut && r.credits) {
      for (const c of r.credits) {
        const pos = c.player?.position?.code;
        if (pos && !creditPositions.includes(pos)) {
          creditPositions.push(pos);
        }
      }
    }
  }
  if (creditPositions.length > 0) return 'FC' + creditPositions.join('');
  // Fallback: parse from description
  const positions = extractAllPositions((play.result.description || '').toLowerCase());
  if (positions.length > 0) return 'FC' + positions.join('');
  return 'FC';
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
      // Skip consecutive duplicate position numbers (e.g., shortstop mentioned twice)
      if (positions.length === 0 || f.num !== positions[positions.length - 1]) {
        positions.push(f.num);
      }
      seen.add(f.idx);
    }
  }
  return positions;
}

function getFielderNumber(desc) {
  const positions = extractAllPositions(desc.toLowerCase());
  return positions.length > 0 ? positions[positions.length - 1] : '';
}

/** Normalize base names. API uses "4B" for home plate in some contexts. */
function normalizeBase(base) {
  if (base === '4B') return 'score';
  return base;
}

/** Normalize outBase to a diamond position (HP, 1B, 2B, 3B) */
function normalizeOutBase(base) {
  if (base === '4B' || base === 'score') return 'HP';
  return base;
}

function parseRunners(runners) {
  return runners.map(r => ({
    start: r.movement?.originBase || null,
    end: normalizeBase(r.movement?.end) || null,
    isOut: r.movement?.isOut || false,
    outNumber: r.movement?.outNumber || null,
    outBase: normalizeOutBase(r.movement?.outBase) || null,
    event: r.details?.event || '',
    playerId: r.details?.runner?.id,
    playerName: r.details?.runner?.fullName || '',
  }));
}

// ─── Trend calculation (last 10 games vs season) ────────────────

const MLB_API = 'https://statsapi.mlb.com/api/v1';

/**
 * Fetch last-10-game trend arrows for all players in a lineup.
 * Compares L10 AVG/OPS to season AVG/OPS. Sets player.avgTrend and player.opsTrend.
 * Fails silently if game log data is unavailable (e.g., past seasons).
 */
export async function computeLineupTrends(lineup, gameDate, season) {
  const playerIds = [];
  for (const slot of lineup) {
    for (const p of slot.players) playerIds.push(p.id);
  }
  // Fetch game logs in parallel (limit concurrency to avoid rate limits)
  const trends = new Map();
  const batches = [];
  for (let i = 0; i < playerIds.length; i += 5) {
    batches.push(playerIds.slice(i, i + 5));
  }
  for (const batch of batches) {
    await Promise.all(batch.map(async (id) => {
      try {
        const url = `${MLB_API}/people/${id}/stats?stats=gameLog&group=hitting&season=${season}`;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        const splits = data.stats?.[0]?.splits;
        if (!splits || splits.length < 10) return;
        // Filter to games on or before gameDate
        const before = splits.filter(s => s.date <= gameDate);
        if (before.length < 10) return;
        const last10 = before.slice(-10);
        const calcAvg = (games) => {
          const h = games.reduce((s, g) => s + (g.stat.hits || 0), 0);
          const ab = games.reduce((s, g) => s + (g.stat.atBats || 0), 0);
          return ab > 0 ? h / ab : 0;
        };
        const calcOps = (games) => {
          const h = games.reduce((s, g) => s + (g.stat.hits || 0), 0);
          const ab = games.reduce((s, g) => s + (g.stat.atBats || 0), 0);
          const bb = games.reduce((s, g) => s + (g.stat.baseOnBalls || 0), 0);
          const hbp = games.reduce((s, g) => s + (g.stat.hitByPitch || 0), 0);
          const sf = games.reduce((s, g) => s + (g.stat.sacFlies || 0), 0);
          const tb = games.reduce((s, g) => s + (g.stat.totalBases || 0), 0);
          const pa = ab + bb + hbp + sf;
          const obp = pa > 0 ? (h + bb + hbp) / pa : 0;
          const slg = ab > 0 ? tb / ab : 0;
          return obp + slg;
        };
        const avg10 = calcAvg(last10);
        const avgSeason = calcAvg(before);
        const ops10 = calcOps(last10);
        const opsSeason = calcOps(before);
        trends.set(id, {
          avgTrend: avg10 > avgSeason ? '↑' : avg10 < avgSeason ? '↓' : '',
          opsTrend: ops10 > opsSeason ? '↑' : ops10 < opsSeason ? '↓' : '',
        });
      } catch { /* silently skip unavailable data */ }
    }));
  }
  // Attach trends to lineup players
  for (const slot of lineup) {
    for (const p of slot.players) {
      const t = trends.get(p.id);
      if (t) {
        p.avgTrend = t.avgTrend;
        p.opsTrend = t.opsTrend;
      }
    }
  }
}

// ─── Stats & metadata ────────────────────────────────────────────

export function getInningCount(linescore) {
  return Math.max(linescore.innings?.length || 0, 9);
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
export function getPitcherStats(boxscore, side, decisions, allPlays) {
  const team = boxscore.teams[side];
  const pitcherIds = team.pitchers || [];
  const players = team.players;

  const winnerId = decisions?.winner?.id;
  const loserId = decisions?.loser?.id;
  const saveId = decisions?.save?.id;

  return pitcherIds.map((id, idx) => {
    const p = players[`ID${id}`];
    if (!p) return null;

    const pitching = p.stats?.pitching || {};
    const season = p.seasonStats?.pitching || {};
    let note = '';
    if (id === winnerId) note = '(WP)';
    else if (id === loserId) note = '(LP)';
    else if (id === saveId) note = '(SV)';
    else if (pitching.holds > 0) note = '(HLD)';

    const repertoire = allPlays ? getPitchRepertoire(allPlays, id) : [];
    const isCurrent = idx === pitcherIds.length - 1;

    return { id, name: p.person.fullName, note, stats: pitching, seasonStats: season, repertoire, isCurrent };
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
 * Collect pitch types used by a pitcher with usage % and avg velocity.
 * Returns array sorted by usage descending: [{ code, desc, count, pct, avgVelo }]
 */
export function getPitchRepertoire(allPlays, pitcherId) {
  const types = new Map(); // code -> { desc, count, totalVelo, veloCount }
  for (const play of allPlays) {
    if (play.matchup?.pitcher?.id !== pitcherId) continue;
    for (const ev of play.playEvents || []) {
      if (!ev.isPitch) continue;
      const code = ev.details?.type?.code;
      const desc = ev.details?.type?.description;
      if (!code || !desc) continue;
      if (!types.has(code)) types.set(code, { desc, count: 0, totalVelo: 0, veloCount: 0 });
      const t = types.get(code);
      t.count++;
      const velo = ev.pitchData?.startSpeed;
      if (velo) { t.totalVelo += velo; t.veloCount++; }
    }
  }
  const total = [...types.values()].reduce((s, t) => s + t.count, 0);
  return [...types.entries()]
    .map(([code, t]) => ({
      code,
      desc: t.desc,
      count: t.count,
      pct: total > 0 ? Math.round((t.count / total) * 100) : 0,
      avgVelo: t.veloCount > 0 ? (t.totalVelo / t.veloCount).toFixed(1) : null,
    }))
    .sort((a, b) => b.count - a.count);
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

  // Temperature: show Celsius first, then Fahrenheit
  let tempStr = '';
  if (weather.temp) {
    const f = parseInt(weather.temp, 10);
    const c = Math.round((f - 32) * 5 / 9);
    tempStr = `${c}\u00B0C / ${f}\u00B0F`;
  }

  return {
    firstPitch: info.firstPitch || null,
    attendance: info.attendance || null,
    durationMinutes: info.gameDurationMinutes || null,
    weather: tempStr && weather.condition ? `${tempStr}, ${weather.condition}` : (tempStr || ''),
    weatherCondition: weather.condition || '',
    wind: weather.wind || '',
    venue: venue.name || '',
    venueCapacity: venue.fieldInfo?.capacity || null,
    date: dt.officialDate || '',
    time: dt.time ? `${dt.time} ${dt.ampm || ''}`.trim() : '',
  };
}

/**
 * Get bench players (position players who didn't bat).
 * Returns full season stats to match a table layout like the bullpen.
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
      seasonStats: ss,
    };
  }).filter(Boolean);
}

/**
 * Get bullpen pitchers (pitchers who didn't appear in the game).
 * Returns full season stats to match pitchers table columns.
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
      seasonStats: ss,
    };
  }).filter(Boolean);
}
