import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Player GUID on dbv.turnier.de
const PLAYER_GUID = '2dfc8260-6909-49ca-acb8-ed6068a80116';
const YEARS = ['2023', '2024', '2025'];
const BASE_URL = 'https://dbv.turnier.de';
const COOKIE_FILE = join(tmpdir(), 'dbv-turnier-cookies.txt');
const LINUS_NAME = 'Linus de Oliveira Cantante de Matos';

function decodeHtmlEntities(text) {
  return text
    .replace(/&#228;/g, 'ä')
    .replace(/&#246;/g, 'ö')
    .replace(/&#252;/g, 'ü')
    .replace(/&#196;/g, 'Ä')
    .replace(/&#214;/g, 'Ö')
    .replace(/&#220;/g, 'Ü')
    .replace(/&#223;/g, 'ß')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function curlFetch(url) {
  const cmd = [
    'curl', '-s', '-L', '-f',
    '-c', COOKIE_FILE,
    '-b', COOKIE_FILE,
    '-H', '"User-Agent: Mozilla/5.0"',
    `"${url}"`
  ];

  const result = execSync(cmd.join(' '), {
    encoding: 'utf-8',
    shell: true,
    maxBuffer: 10 * 1024 * 1024
  });

  return result;
}

function acceptCookies(returnUrl) {
  console.log('Accepting cookies for dbv.turnier.de...');
  const cmd = [
    'curl', '-s', '-L',
    '-c', COOKIE_FILE,
    '-b', COOKIE_FILE,
    '-H', '"User-Agent: Mozilla/5.0"',
    '-H', '"Content-Type: application/x-www-form-urlencoded"',
    '--data-urlencode', `"ReturnUrl=${returnUrl}"`,
    '--data-urlencode', '"CookiePurposes=1"',
    '--data-urlencode', '"SettingsOpen=false"',
    `"${BASE_URL}/cookiewall/Save"`
  ];

  execSync(cmd.join(' '), {
    encoding: 'utf-8',
    shell: true,
    maxBuffer: 10 * 1024 * 1024
  });
}

function fetchTournamentPage(year) {
  const url = `${BASE_URL}/player-profile/${PLAYER_GUID}/tournaments/${year}`;
  console.log(`Fetching ${year} tournaments...`);
  return curlFetch(url);
}

function extractTournaments(html) {
  const tournaments = [];

  // Split by tournament blocks (each starts with <li class="list__item">)
  const tournamentBlocks = html.split(/<li class="list__item">/);

  for (let i = 1; i < tournamentBlocks.length; i++) {
    const block = tournamentBlocks[i];

    // Extract tournament name
    const nameMatch = block.match(/title="([^"]+)" class="media__link"/);
    if (!nameMatch) continue;
    const tournamentName = decodeHtmlEntities(nameMatch[1]);

    // Extract date
    const dateMatch = block.match(/<time datetime="(\d{4}-\d{2}-\d{2})/);
    const startDate = dateMatch ? dateMatch[1] : null;

    // Extract location - try multiple patterns
    let location = 'Germany';
    const locationPatterns = [
      /Bayerischer Badminton-Verband \| ([^<]+)/,
      /Badminton-Landesverband[^|]*\| ([^<]+)/,
      /Deutscher Badminton Verband[^|]*\| ([^<]+)/,
      /[A-Za-zäöüÄÖÜß\-]+ Badminton[^|]*\| ([^<]+)/
    ];
    for (const pattern of locationPatterns) {
      const match = block.match(pattern);
      if (match) {
        location = decodeHtmlEntities(match[1].trim());
        break;
      }
    }
    // Clean up location - remove club codes like [01-0027], [06-HAM], etc.
    location = location.replace(/\s*\[\d{2}-[A-Z0-9]+\]/g, '').trim();
    // Try to extract city from tournament name as fallback
    if (location === 'Germany' || location === '') {
      const cityMatch = tournamentName.match(/([A-Za-zäöüÄÖÜß\-]+)\s+\d{4}$/);
      if (cityMatch) {
        location = cityMatch[1] + ', Germany';
      }
    }

    // Extract categories and results
    const categories = extractCategories(block);

    if (categories.length > 0) {
      tournaments.push({
        name: tournamentName,
        date: startDate,
        location: location,
        categories: categories
      });
    }
  }

  return tournaments;
}

function extractCategories(block) {
  const categories = [];

  // Split by category headers
  const categoryPattern = /Konkurrenz: ([^<]+)<\/span>/g;
  const categoryMatches = [...block.matchAll(categoryPattern)];

  for (let i = 0; i < categoryMatches.length; i++) {
    const categoryName = decodeHtmlEntities(categoryMatches[i][1].trim());

    // Find the section for this category (until next category or end)
    const startIdx = categoryMatches[i].index;
    const endIdx = i < categoryMatches.length - 1 ? categoryMatches[i + 1].index : block.length;
    const categoryBlock = block.substring(startIdx, endIdx);

    // Extract matches
    const result = extractCategoryResult(categoryBlock, categoryName);
    if (result) {
      categories.push(result);
    }
  }

  return categories;
}

function extractCategoryResult(categoryBlock, categoryName) {
  // Determine category type
  const isDoubles = categoryName.startsWith('JD') || categoryName.startsWith('MD');
  const isMixed = categoryName.startsWith('MX') || categoryName.startsWith('GD');

  let type = 'singles';
  if (isDoubles) type = 'doubles';
  if (isMixed) type = 'mixed';

  // Find all matches
  const matches = [];
  const matchBlocks = categoryBlock.split(/<li class="match-group__item">/);

  for (let i = 1; i < matchBlocks.length; i++) {
    const matchBlock = matchBlocks[i];

    // Extract round
    const roundMatch = matchBlock.match(/match__header-title-item[^>]*>[\s\S]*?<span class="nav-link__value">([^<]+)<\/span>/);
    const round = roundMatch ? roundMatch[1].trim() : '';

    // Check if Linus won or lost
    const linusRow = matchBlock.indexOf(LINUS_NAME);
    if (linusRow === -1) continue;

    // Find the row containing Linus
    const beforeLinus = matchBlock.substring(0, linusRow);
    const afterLinus = matchBlock.substring(linusRow);

    // Check for W or L status near Linus
    const statusMatch = afterLinus.match(/tag--(?:success|danger)[^>]*>([WL])</);
    const won = statusMatch ? statusMatch[1] === 'W' : null;

    // For doubles/mixed, find the partner
    let partner = null;
    if (type === 'doubles' || type === 'mixed') {
      // Find the match__row containing Linus
      const rowStartIdx = beforeLinus.lastIndexOf('<div class="match__row');
      const rowEndIdx = matchBlock.indexOf('</div>', linusRow + LINUS_NAME.length + 200);

      if (rowStartIdx !== -1) {
        const rowContent = matchBlock.substring(rowStartIdx, Math.min(rowEndIdx + 100, matchBlock.length));

        // Extract all player names - look for player links with nav-link__value spans
        const playerPattern = /<a[^>]*href="[^"]*player[^"]*"[^>]*>[\s\S]*?<span class="nav-link__value">([^<]+)<\/span>/g;
        const players = [];
        let playerMatch;
        while ((playerMatch = playerPattern.exec(rowContent)) !== null) {
          const name = decodeHtmlEntities(playerMatch[1].trim());
          if (name && name.length > 2 &&
              !name.includes('Round') && !name.includes('Quarter') &&
              !name.includes('Semi') && !name.includes('Final') && !name.includes('place') &&
              !name.includes('H2H') && !name.includes('Rast') &&
              !/^[WL]$/.test(name) && !/^\d+$/.test(name)) {
            players.push(name);
          }
        }

        // If player link pattern didn't work, try simpler nav-link__value pattern
        if (players.length === 0) {
          const simplePattern = /<span class="nav-link__value">([^<]+)<\/span>/g;
          while ((playerMatch = simplePattern.exec(rowContent)) !== null) {
            const name = decodeHtmlEntities(playerMatch[1].trim());
            if (name && name.length > 5 &&
                !name.includes('Round') && !name.includes('Quarter') &&
                !name.includes('Semi') && !name.includes('Final') && !name.includes('place') &&
                !name.includes('H2H') && !name.includes('Rast') && !name.includes('Platz') &&
                !/^[WL]$/.test(name) && !/^\d+$/.test(name) && !/^\d+-\d+$/.test(name)) {
              players.push(name);
            }
          }
        }

        partner = players.find(p => p !== LINUS_NAME) || null;
      }
    }

    matches.push({
      round,
      won,
      partner
    });
  }

  if (matches.length === 0) return null;

  // Get the last match to determine final placement
  const lastMatch = matches[matches.length - 1];
  const place = determinePlacement(lastMatch.round, lastMatch.won);

  return {
    category: categoryName,
    type,
    partner: lastMatch.partner,
    place,
    lastRound: lastMatch.round,
    won: lastMatch.won
  };
}

function determinePlacement(round, won) {
  const roundLower = round.toLowerCase();

  if (roundLower.includes('final') && !roundLower.includes('semi') && !roundLower.includes('quarter')) {
    if (roundLower.includes('3rd') || roundLower.includes('4th')) {
      return won ? 3 : 4;
    }
    return won ? 1 : 2;
  }

  if (roundLower.includes('semi')) {
    return won ? null : 3; // Semi-final loss typically means 3rd/4th (bronze)
  }

  if (roundLower.includes('quarter')) {
    return won ? null : 5; // Top 8
  }

  return null;
}

function translateCategory(category) {
  // JE = Jungen Einzel (Boys Singles)
  // JD = Jungen Doppel (Boys Doubles)
  // ME = Mädchen Einzel (Girls Singles)
  // MD = Mädchen Doppel (Girls Doubles)
  // MX = Mixed
  // GD = Mixed (Gemischtes Doppel)

  // Handle categories like "JE U13 [SG]", "JD U11 Sa [SG]", etc.
  const match = category.match(/^(JE|JD|ME|MD|MX|GD)\s*(U\d+)/i);
  if (!match) return category;

  const prefix = match[1].toUpperCase();
  const ageClass = match[2].toUpperCase();

  const translations = {
    'JE': 'Boys Singles',
    'JD': 'Boys Doubles',
    'ME': 'Girls Singles',
    'MD': 'Girls Doubles',
    'MX': 'Mixed',
    'GD': 'Mixed'
  };

  return `${translations[prefix] || prefix} ${ageClass}`;
}

function formatTournamentData(allTournaments) {
  const formattedPast = [];

  for (const t of allTournaments) {
    const results = {
      singles: null,
      doubles: null,
      mixed: null
    };

    for (const cat of t.categories) {
      const translated = translateCategory(cat.category);
      const placeText = cat.place === 1 ? 'Gold' : cat.place === 2 ? 'Silver' : cat.place === 3 ? 'Bronze' : null;

      const resultEntry = {
        place: cat.place,
        category: translated
      };

      if (cat.partner) {
        resultEntry.partner = cat.partner;
      }

      if (placeText) {
        resultEntry.notes = `${placeText} Medal`;
      } else if (cat.lastRound) {
        resultEntry.notes = cat.lastRound;
      }

      if (cat.type === 'singles' && !results.singles) {
        results.singles = resultEntry;
      } else if (cat.type === 'doubles' && !results.doubles) {
        results.doubles = resultEntry;
      } else if (cat.type === 'mixed' && !results.mixed) {
        results.mixed = resultEntry;
      }
    }

    formattedPast.push({
      name: t.name,
      date: t.date,
      location: t.location,
      results
    });
  }

  // Sort by date descending (newest first)
  formattedPast.sort((a, b) => new Date(b.date) - new Date(a.date));

  return formattedPast;
}

// Main execution
try {
  // Accept cookies first
  acceptCookies(`/player-profile/${PLAYER_GUID}/tournaments/2024`);

  const allTournaments = [];

  for (const year of YEARS) {
    try {
      const html = fetchTournamentPage(year);
      const tournaments = extractTournaments(html);
      console.log(`${year}: Found ${tournaments.length} tournaments`);
      allTournaments.push(...tournaments);
    } catch (err) {
      console.error(`Error fetching ${year}: ${err.message}`);
    }
  }

  console.log(`\nTotal tournaments: ${allTournaments.length}`);

  const formattedData = formatTournamentData(allTournaments);

  console.log('\n--- Sample Tournament Data ---\n');
  console.log(JSON.stringify(formattedData.slice(0, 3), null, 2));
  console.log(`... and ${Math.max(0, formattedData.length - 3)} more tournaments`);

  // Update tournaments.json
  const tournamentsPath = join(__dirname, '..', 'src', 'data', 'tournaments.json');
  const existing = JSON.parse(readFileSync(tournamentsPath, 'utf-8'));

  // Replace past tournaments with extracted data, but preserve upcoming
  const updated = {
    past: formattedData,
    upcoming: existing.upcoming || []
  };

  writeFileSync(tournamentsPath, JSON.stringify(updated, null, 2) + '\n');
  console.log('\nUpdated tournaments.json (preserved upcoming tournaments)');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
