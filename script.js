const leagues = [
  { id: '4328', name: 'English Premier League' },
  { id: '4331', name: 'German Bundesliga' },
  { id: '4332', name: 'Italian Serie A' },
  { id: '4334', name: 'French Ligue 1' },
  { id: '4335', name: 'Spanish La Liga' },
  { id: '4346', name: 'MLS' }
];

const leagueSelect = document.getElementById('leagueSelect');
const refreshBtn = document.getElementById('refreshBtn');
const upcomingEl = document.getElementById('upcoming');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const template = document.getElementById('matchTemplate');

const proxyPrefixes = [
  '',
  'https://api.allorigins.win/raw?url=',
  'https://cors.isomorphic-git.org/'
];

const nextKickoffEl = document.getElementById('nextKickoff');
const lastResultEl = document.getElementById('lastResult');
const upcomingCountEl = document.getElementById('upcomingCount');
const resultsCountEl = document.getElementById('resultsCount');

for (const league of leagues) {
  const option = document.createElement('option');
  option.value = league.id;
  option.textContent = league.name;
  leagueSelect.append(option);
}

leagueSelect.value = '4328';

function formatDateTime(dateStr, timeStr) {
  const value = timeStr ? `${dateStr}T${timeStr}` : dateStr;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderMatches(node, matches, isResult = false) {
  clearNode(node);

  if (!matches || matches.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No matches found for this league right now.';
    empty.className = 'muted';
    node.append(empty);
    return;
  }

  for (const match of matches) {
    const clone = template.content.cloneNode(true);
    clone.querySelector('.home').textContent = match.strHomeTeam || 'Home TBC';
    clone.querySelector('.away').textContent = match.strAwayTeam || 'Away TBC';
    clone.querySelector('.when').textContent = formatDateTime(match.dateEvent, match.strTime);

    const score = isResult
      ? `${match.intHomeScore ?? '-'} : ${match.intAwayScore ?? '-'}`
      : 'Scheduled';

    clone.querySelector('.score').textContent = score;
    node.append(clone);
  }
}

async function fetchJsonWithFallback(url) {
  let lastError = null;

  for (const prefix of proxyPrefixes) {
    const finalUrl = prefix ? `${prefix}${encodeURIComponent(url)}` : url;

    try {
      const response = await fetch(finalUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return { data: await response.json(), viaProxy: Boolean(prefix) };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unknown network error');
}

async function fetchLeagueData() {
  const id = leagueSelect.value;
  const leagueName = leagueSelect.options[leagueSelect.selectedIndex].textContent;

  statusEl.textContent = `Loading ${leagueName}…`;
  refreshBtn.disabled = true;

  const base = `https://www.thesportsdb.com/api/v1/json/3`;
  const upcomingUrl = `${base}/eventsnextleague.php?id=${id}`;
  const resultsUrl = `${base}/eventspastleague.php?id=${id}`;

  try {
    const [upcomingPack, resultsPack] = await Promise.all([
      fetchJsonWithFallback(upcomingUrl),
      fetchJsonWithFallback(resultsUrl)
    ]);

    const upcoming = upcomingPack.data.events || [];
    const results = resultsPack.data.events || [];

    renderMatches(upcomingEl, upcoming, false);
    renderMatches(resultsEl, results, true);

    upcomingCountEl.textContent = String(upcoming.length);
    resultsCountEl.textContent = String(results.length);

    nextKickoffEl.textContent = upcoming[0]
      ? formatDateTime(upcoming[0].dateEvent, upcoming[0].strTime)
      : 'No fixture';

    lastResultEl.textContent = results[0]
      ? `${results[0].strHomeTeam} ${results[0].intHomeScore ?? '-'}-${results[0].intAwayScore ?? '-'} ${results[0].strAwayTeam}`
      : 'No result';

    const usedProxy = upcomingPack.viaProxy || resultsPack.viaProxy;
    const freshness = new Date().toLocaleTimeString();
    statusEl.textContent = usedProxy
      ? `Live data synced for ${leagueName} via CORS fallback at ${freshness}.`
      : `Live data synced for ${leagueName} at ${freshness}.`;
  } catch (error) {
    clearNode(upcomingEl);
    clearNode(resultsEl);
    statusEl.textContent = 'Live football feed unreachable from this browser/network.';
    const err = document.createElement('p');
    err.textContent = 'Could not connect to TheSportsDB API (direct or fallback proxy). Try refresh or different network.';
    upcomingEl.append(err.cloneNode(true));
    resultsEl.append(err);
    nextKickoffEl.textContent = '--';
    lastResultEl.textContent = '--';
    upcomingCountEl.textContent = '0';
    resultsCountEl.textContent = '0';
  } finally {
    refreshBtn.disabled = false;
  }
}

leagueSelect.addEventListener('change', fetchLeagueData);
refreshBtn.addEventListener('click', fetchLeagueData);

fetchLeagueData();
