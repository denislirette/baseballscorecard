// AL/NL Standings: 6 division boxes in 2x3 grid (AL left, NL right)

const TEAM_ABBREVS = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC',
  113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC',  119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH',
  134: 'PIT', 135: 'SD',  136: 'SEA', 137: 'SF',  138: 'STL',
  139: 'TB',  140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI',
  144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL',
};

const DIVISION_NAMES = {
  201: 'AL EAST', 202: 'AL CENTRAL', 200: 'AL WEST',
  204: 'NL EAST', 205: 'NL CENTRAL', 203: 'NL WEST',
};

// Stacked: AL East/Central/West, then NL East/Central/West
const DIVISION_ORDER = [
  201, 202, 200, // AL East, Central, West
  204, 205, 203, // NL East, Central, West
];

/**
 * Render standings as 6 division boxes stacked vertically: AL E/C/W then NL E/C/W.
 */
export function renderStandingsHTML(standingsData, awayTeamId, homeTeamId) {
  if (!standingsData?.records) return '';

  const divisionMap = new Map();
  for (const rec of standingsData.records) {
    divisionMap.set(rec.division.id, rec.teamRecords);
  }

  const boxes = DIVISION_ORDER.map(divId =>
    renderDivisionBox(divId, divisionMap.get(divId), awayTeamId, homeTeamId)
  ).join('');

  return `<div class="standings-container">${boxes}</div>`;
}

function renderDivisionBox(divId, teamRecords, awayTeamId, homeTeamId) {
  if (!teamRecords) return '';
  const sorted = [...teamRecords].sort((a, b) => parseInt(a.divisionRank) - parseInt(b.divisionRank));

  const rows = sorted.map(tr => {
    const abbrev = TEAM_ABBREVS[tr.team.id] || tr.team.name;
    const logo = `<img class="team-logo team-logo-light" src="/img/logos/light/${tr.team.id}.svg" alt="" style="height:1.2em;width:auto;vertical-align:middle;margin-right:6px;"><img class="team-logo team-logo-dark" src="/img/logos/dark/${tr.team.id}.svg" alt="" style="height:1.2em;width:auto;vertical-align:middle;margin-right:6px;">`;
    const w = tr.leagueRecord.wins;
    const l = tr.leagueRecord.losses;
    const gb = tr.divisionGamesBack;
    const l10 = formatL10(tr.records?.splitRecords);
    const streak = formatStreak(tr.streak?.streakCode);
    const isPlaying = tr.team.id === awayTeamId || tr.team.id === homeTeamId;
    const highlight = isPlaying ? ' class="standings-highlight"' : '';

    return `<tr${highlight}><td>${logo}${abbrev}</td><td>${w}-${l}</td><td>${gb}</td><td>${l10}</td><td>${streak || '-'}</td></tr>`;
  }).join('');

  const league = divId < 204 ? 'al' : 'nl';
  return `<div class="standings-division" data-league="${league}">
    <table class="pitcher-stats-table">
      <thead><tr><th colspan="5">${DIVISION_NAMES[divId] || ''}</th></tr>
      <tr><th>Team</th><th>W-L</th><th>GB</th><th>L10</th><th>STRK</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function formatL10(splitRecords) {
  if (!splitRecords) return '-';
  const l10 = splitRecords.find(s => s.type === 'lastTen');
  if (!l10) return '-';
  return `${l10.wins}-${l10.losses}`;
}

function formatStreak(streakCode) {
  if (!streakCode) return '';
  const match = streakCode.match(/^([WL])(\d+)$/);
  if (!match) return '';
  const [, type, count] = match;
  const num = parseInt(count, 10);
  if (num <= 1) return '';
  return `${num}${type}`;
}
