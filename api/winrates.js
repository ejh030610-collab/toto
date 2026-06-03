const fetch = require('node-fetch');

async function fetchLeagueData(sport, leagueSeq) {
  const url = leagueSeq
    ? `https://www.wisetoto.com/news/league_ranking.htm?sports=${sport}&league_info_seq=${leagueSeq}`
    : `https://www.wisetoto.com/news/league_ranking.htm?sports=${sport}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.wisetoto.com/',
      },
    });
    const html = await res.text();
    const teams = {};

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const cells = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const text = cellMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        cells.push(text);
      }
      if (cells.length < 3) continue;

      // 승률 찾기
      let teamName = null, winRate = null, winRateIdx = -1;
      for (let i = 0; i < cells.length; i++) {
        if (/^[01]\.\d{3}$/.test(cells[i])) {
          winRate = parseFloat(cells[i]);
          winRateIdx = i;
          for (let j = i - 1; j >= 0; j--) {
            if (cells[j] && !/^\d+$/.test(cells[j]) && cells[j].length > 1) {
              teamName = cells[j].replace(/\(.*?\)/g, '').trim();
              break;
            }
          }
          break;
        }
      }
      if (!teamName || winRate === null) continue;

      // 승/무/패 파싱 (winRateIdx 앞에 있는 숫자들)
      let wins = null, draws = null, losses = null;
      const numCells = cells.slice(0, winRateIdx).filter(c => /^\d+$/.test(c));
      if (numCells.length >= 3) {
        wins   = parseInt(numCells[numCells.length - 3]);
        draws  = parseInt(numCells[numCells.length - 2]);
        losses = parseInt(numCells[numCells.length - 1]);
      }

      // 연속 결과 (2L, 4W, W1, L2 등 다양한 형식)
      let streak = null;
      for (let i = winRateIdx + 1; i < cells.length; i++) {
        if (/^[WL]\d+$/.test(cells[i])) { streak = cells[i]; break; }
        if (/^\d+[WL]$/.test(cells[i])) {
          // 4W → W4 형식으로 변환
          const num = cells[i].match(/\d+/)[0];
          const type = cells[i].match(/[WL]/)[0];
          streak = type + num;
          break;
        }
      }

      // 최근 5경기 폼 파싱 (승 패 무 패 승 패턴)
      let form = null;
      for (let i = cells.length - 1; i >= 0; i--) {
        if (/^[승패무\s]+$/.test(cells[i]) && cells[i].replace(/\s/g,'').length >= 3) {
          form = cells[i].trim().split(/\s+/).filter(r => ['승','패','무'].includes(r));
          break;
        }
      }

      // 홈/원정 승률
      let homeWR = null, awayWR = null;
      let wrCount = 0;
      for (let i = winRateIdx + 1; i < cells.length; i++) {
        if (/^[01]\.\d{3}$/.test(cells[i])) {
          wrCount++;
          if (wrCount === 1) homeWR = parseFloat(cells[i]);
          if (wrCount === 2) { awayWR = parseFloat(cells[i]); break; }
        }
      }

      teams[teamName] = { winRate, wins, draws, losses, streak, form, homeWR, awayWR };
    }
    return teams;
  } catch (err) {
    return {};
  }
}

async function fetchNationalData() {
  const leagueSeqs = ['146', '150', '30', '291'];
  const teams = {};
  for (const seq of leagueSeqs) {
    const url = `https://www.wisetoto.com/news/league_ranking.htm?sports=sc&league_info_seq=${seq}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.wisetoto.com/',
        },
      });
      const html = await res.text();
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(html)) !== null) {
        const cells = [];
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(cellMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
        }
        if (cells.length < 3) continue;

        // 최근 폼 찾기
        let teamName = null, form = null;
        for (let i = 0; i < cells.length; i++) {
          if (/^[승패무\s]+$/.test(cells[i]) && cells[i].replace(/\s/g,'').length >= 3) {
            form = cells[i].trim().split(/\s+/).filter(r => ['승','패','무'].includes(r));
            for (let j = i - 1; j >= 0; j--) {
              if (cells[j] && !/^\d+$/.test(cells[j]) && cells[j].length > 1) {
                teamName = cells[j]; break;
              }
            }
            break;
          }
        }
        if (!teamName || !form || teams[teamName]) continue;

        // 승점/승/무/패
        const nums = cells.filter(c => /^\d+$/.test(c)).map(Number);
        const wins   = nums.length >= 3 ? nums[1] : null;
        const draws  = nums.length >= 3 ? nums[2] : null;
        const losses = nums.length >= 3 ? nums[3] : null;
        const total  = (wins||0) + (draws||0) + (losses||0);
        const winRate = total > 0 ? parseFloat(((wins||0) / total).toFixed(3)) : null;

        teams[teamName] = { winRate, wins, draws, losses, streak: null, form, homeWR: null, awayWR: null };
      }
    } catch (err) {}
  }
  return teams;
}

function getFifaData() {
  const rates = {
    '아르헨티나':0.74,'프랑스':0.72,'스페인':0.72,'잉글랜드':0.71,'브라질':0.70,
    '포르투갈':0.70,'벨기에':0.69,'네덜란드':0.69,'독일':0.68,'이탈리아':0.67,
    '크로아티아':0.66,'우루과이':0.65,'덴마크':0.64,'멕시코':0.63,'미국':0.63,
    '스위스':0.63,'콜롬비아':0.63,'세네갈':0.62,'노르웨이':0.62,'일본':0.62,
    '모로코':0.62,'오스트리아':0.61,'폴란드':0.60,'에콰도르':0.60,'튀르키예':0.59,
    '한국':0.58,'캐나다':0.57,'이란':0.57,'세르비아':0.57,
    '스코틀랜드':0.56,'체코':0.56,'우크라이나':0.55,'슬로바키아':0.55,
    '헝가리':0.54,'루마니아':0.54,'코소보':0.53,'그리스':0.52,
    '아일랜드':0.51,'스웨덴':0.50,'핀란드':0.50,'파나마':0.50,
    '우즈베키스탄':0.49,'카보베르데':0.49,'코스타리카':0.48,
    '불가리아':0.42,'몬테네그로':0.42,'몰타':0.30,
  };
  const result = {};
  for (const [name, wr] of Object.entries(rates)) {
    result[name] = { winRate: wr, wins: null, draws: null, losses: null, streak: null, form: null, homeWR: null, awayWR: null };
  }
  return result;
}

function normalizeKey(name) {
  return name.replace(/\s+/g, '').toLowerCase();
}

function buildNormalizedMap(teamData) {
  const map = {};
  for (const [name, data] of Object.entries(teamData)) {
    const nk = normalizeKey(name);
    map[nk] = { name, ...data };
    if (nk.length >= 4 && !map[nk.slice(0,4)]) map[nk.slice(0,4)] = { name, ...data };
    if (nk.length >= 3 && !map[nk.slice(0,3)]) map[nk.slice(0,3)] = { name, ...data };
  }
  return map;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const [mlbData, kboData, npbData, nbaData, kblData, scData, vlData, nationalData] = await Promise.all([
      fetchLeagueData('bs', '40'),   // MLB
      fetchLeagueData('bs', '39'),   // KBO
      fetchLeagueData('bs', '159'),  // NPB
      fetchLeagueData('bk', '45'),   // NBA
      fetchLeagueData('bk', '44'),   // KBL
      fetchLeagueData('sc'),          // 축구
      fetchLeagueData('vl'),          // 배구
      fetchNationalData(),
    ]);
    const fifaData = getFifaData();
    const allTeams = { ...fifaData, ...nationalData, ...scData, ...mlbData, ...kboData, ...npbData, ...nbaData, ...kblData, ...vlData };

    const winRates = {};
    for (const [name, data] of Object.entries(allTeams)) {
      winRates[name] = data.winRate;
    }

    const normalizedMap = buildNormalizedMap(allTeams);
    res.json({ winRates, teamData: allTeams, normalizedMap, count: Object.keys(allTeams).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
