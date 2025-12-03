import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLAYER_ID = '6388186';
const RANKING_ID = '49291';
const AGE_CLASS = '13'; // U13

const CATEGORIES = {
  singles: { id: '3367', filterParam: 'C3367CS' },
  doubles: { id: '3369', filterParam: 'C3369CS' },
  mixed: { id: '3440', filterParam: 'C3440CS' }
};

const BASE_URL = 'https://www.turnier.de';
const COOKIE_FILE = join(tmpdir(), 'turnier-cookies.txt');

function curlFetch(url, options = {}) {
  const { method = 'GET', data } = options;

  let cmd = [
    'curl', '-s', '-L',
    '-c', COOKIE_FILE,
    '-b', COOKIE_FILE,
    '-H', '"User-Agent: Mozilla/5.0"'
  ];

  if (method === 'POST' && data) {
    cmd.push('-H', '"Content-Type: application/x-www-form-urlencoded"');
    for (const [key, value] of Object.entries(data)) {
      cmd.push('--data-urlencode', `"${key}=${value}"`);
    }
  }

  cmd.push(`"${url}"`);

  const result = execSync(cmd.join(' '), {
    encoding: 'utf-8',
    shell: true,
    maxBuffer: 10 * 1024 * 1024
  });

  return result;
}

function acceptCookies() {
  console.log('Accepting cookies...');
  curlFetch(`${BASE_URL}/cookiewall/Save`, {
    method: 'POST',
    data: {
      'ReturnUrl': `/ranking/ranking.aspx?id=${RANKING_ID}`,
      'CookiePurposes': '1',
      'SettingsOpen': 'false'
    }
  });
}

function fetchCategoryRanking(categoryName) {
  const category = CATEGORIES[categoryName];
  const url = `${BASE_URL}/ranking/category.aspx?id=${RANKING_ID}&category=${category.id}&${category.filterParam}=${AGE_CLASS}`;

  const html = curlFetch(url);
  return extractPlayerRank(html, PLAYER_ID);
}

function extractPlayerRank(html, playerId) {
  const lines = html.split('\n');

  for (const line of lines) {
    if (line.includes(`player=${playerId}`)) {
      const rankMatch = line.match(/<td class="rank"><div[^>]*>(\d+)<\/div><\/td>/);
      if (rankMatch) {
        return parseInt(rankMatch[1], 10);
      }
    }
  }

  return null;
}

function fetchAllRankings() {
  acceptCookies();

  console.log('Fetching rankings...');
  const rankings = {};

  for (const name of Object.keys(CATEGORIES)) {
    const rank = fetchCategoryRanking(name);
    rankings[name] = rank;
    console.log(`  ${name}: ${rank !== null ? `#${rank}` : 'not found'}`);
  }

  return rankings;
}

function updateProfile(rankings) {
  const profilePath = join(__dirname, '..', 'src', 'data', 'profile.json');
  const profile = JSON.parse(readFileSync(profilePath, 'utf-8'));

  let updated = false;
  for (const [key, value] of Object.entries(rankings)) {
    if (value !== null && profile.rankings[key] !== value) {
      console.log(`Updating ${key}: ${profile.rankings[key]} -> ${value}`);
      profile.rankings[key] = value;
      updated = true;
    }
  }

  if (updated) {
    writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n');
    console.log('Profile updated successfully!');
  } else {
    console.log('No changes needed.');
  }
}

try {
  const rankings = fetchAllRankings();
  updateProfile(rankings);
} catch (error) {
  console.error('Error fetching rankings:', error);
  process.exit(1);
}
