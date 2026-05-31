const fetch = require('node-fetch');

async function fetchLeagueWinRates(sport) {
  const url = `https://www.wisetoto.com/news/league_ranking.htm?sports=${sport}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.wisetoto.com/',
      },
    });
    const html = await res.text();
    const winRates = {};
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const cells = [];
      const cellRegexLocal = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegexLocal.exec(rowHtml)) !== null) {
        const text = cellMatch[1].replace(/<[^>]+>/g, '').trim();
        cells.push(text);
      }
      if (cells.length >= 3) {
        let teamName = null, winRate = null;
        for (let i = 0; i < cells.length; i++) {
          if (/^[01]\.\d{3}$/.test(cells[i])) {
            winRate = parseFloat(cells[i]);
            for (let j = i - 1; j >= 0; j--) {
              if (cells[j] && !/^\d+$/.test(cells[j]) && cells[j].length > 1) {
                teamName = cells[j]; break;
              }
            }
            if (teamName && winRate !== null) {
              winRates[teamName.replace(/\(.*?\)/g, '').trim()] = winRate;
            }
            break;
          }
        }
      }
    }
    return winRates;
  } catch (err) {
    return {};
  }
}

async function fetchNationalWinRates() {
  const leagueSeqs = ['146', '150', '30', '291'];
  const winRates = {};
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
        const rowHtml = rowMatch[1];
        const cells = [];
        const cellRegexLocal = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch;
        while ((cellMatch = cellRegexLocal.exec(rowHtml)) !== null) {
          const text = cellMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          cells.push(text);
        }
        if (cells.length >= 3) {
          let teamName = null, recentResults = null;
          for (let i = 0; i < cells.length; i++) {
            if (/^[승패무\s]+$/.test(cells[i]) && cells[i].replace(/\s/g, '').length >= 3) {
              recentResults = cells[i];
              for (let j = i - 1; j >= 0; j--) {
                if (cells[j] && !/^\d+$/.test(cells[j]) && cells[j].length > 1 && !/다음 경기/.test(cells[j])) {
                  teamName = cells[j]; break;
                }
              }
              break;
            }
          }
          if (teamName && recentResults) {
            const results = recentResults.trim().split(/\s+/).filter(r => ['승','패','무'].includes(r));
            if (results.length > 0 && !winRates[teamName]) {
              winRates[teamName] = parseFloat((results.filter(r => r === '승').length / results.length).toFixed(3));
            }
          }
        }
      }
    } catch (err) {}
  }
  return winRates;
}

function getFifaWinRates() {
  return {
    '아르헨티나':0.74,'프랑스':0.72,'스페인':0.72,'잉글랜드':0.71,'브라질':0.70,
    '포르투갈':0.70,'벨기에':0.69,'네덜란드':0.69,'독일':0.68,'이탈리아':0.67,
    '크로아티아':0.66,'우루과이':0.65,'덴마크':0.64,'멕시코':0.63,'미국':0.63,
    '스위스':0.63,'콜롬비아':0.63,'세네갈':0.62,'노르웨이':0.62,'일본':0.62,
    '모로코':0.62,'오스트리아':0.61,'폴란드':0.60,'에콰도르':0.60,'튀르키예':0.59,
    '한국':0.58,'웨일스':0.58,'캐나다':0.57,'이란':0.57,'세르비아':0.57,
    '스코틀랜드':0.56,'체코':0.56,'우크라이나':0.55,'슬로바키아':0.55,
    '헝가리':0.54,'루마니아':0.54,'오스트레일리아':0.54,'코소보':0.53,
    '그리스':0.52,'알바니아':0.52,'이스라엘':0.52,'북마케도니아':0.51,
    '아일랜드':0.51,'스웨덴':0.50,'핀란드':0.50,'보스니아':0.50,
    '파나마':0.50,'우즈베키스탄':0.49,'카보베르데':0.49,'코스타리카':0.48,
    '불가리아':0.42,'몬테네그로':0.42,'슬로베니아':0.44,'북아일랜드':0.44,
    '몰타':0.30,'룩셈부르크':0.28,'리히텐슈타인':0.10,'산마리노':0.05,
  };
}

function normalizeKey(name) {
  return name.replace(/\s+/g, '').toLowerCase();
}

function buildNormalizedMap(winRates) {
  const map = {};
  for (const [name, rate] of Object.entries(winRates)) {
    const nk = normalizeKey(name);
    map[nk] = rate;
    if (nk.length >= 4 && !map[nk.slice(0, 4)]) map[nk.slice(0, 4)] = rate;
    if (nk.length >= 3 && !map[nk.slice(0, 3)]) map[nk.slice(0, 3)] = rate;
  }
  return map;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const [bsRates, bkRates, scRates, vlRates, nationalRates] = await Promise.all([
      fetchLeagueWinRates('bs'),
      fetchLeagueWinRates('bk'),
      fetchLeagueWinRates('sc'),
      fetchLeagueWinRates('vl'),
      fetchNationalWinRates(),
    ]);
    const fifaRates = getFifaWinRates();
    const rawRates = { ...fifaRates, ...nationalRates, ...scRates, ...bsRates, ...bkRates, ...vlRates };
    const normalizedMap = buildNormalizedMap(rawRates);
    res.json({ winRates: rawRates, normalizedMap, count: Object.keys(rawRates).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
