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
      if (cells.length < 4) continue;

      // 첫 셀이 순위(숫자)인 행만 처리
      if (!/^\d+$/.test(cells[0])) continue;

      // 팀명: 두번째 셀 (한글/영문 포함, 숫자 아님)
      let teamName = cells[1] ? cells[1].replace(/\(.*?\)/g, '').trim() : null;
      if (!teamName || /^\d/.test(teamName) || teamName.length < 2) continue;

      // 선수 성적 행 제외: 팀명에 괄호(팀명 포함)가 있거나 점(.)이 있으면 선수
      if (/\(/.test(cells[1]) || /^[A-Z]\.[가-힣]/.test(cells[1])) continue;
      // 타율행 제외: 세번째 셀이 타수(100 이상 숫자)인 경우
      if (cells[2] && /^\d{3,}$/.test(cells[2]) && parseInt(cells[2]) > 50 && cells.length > 8) continue;

      // 명시적 승률 (0.xxx)
      let winRate = null, winRateIdx = -1;
      for (let i = 2; i < cells.length; i++) {
        if (/^[01]\.\d{3}$/.test(cells[i])) {
          winRate = parseFloat(cells[i]);
          winRateIdx = i;
          break;
        }
      }

      // 승/무/패 추출 (순위, 팀명, 경기수 이후의 숫자들)
      const nums = [];
      for (let i = 2; i < cells.length; i++) {
        if (/^\d+$/.test(cells[i])) nums.push({ idx: i, val: parseInt(cells[i]) });
      }
      // 보통 [경기수, 승, 무, 패] 순서 → 경기수 제외하고 승/무/패
      let wins = null, draws = null, losses = null;
      if (nums.length >= 4) {
        // 경기수 다음 3개가 승/무/패
        wins   = nums[1].val;
        draws  = nums[2].val;
        losses = nums[3].val;
      } else if (nums.length === 3) {
        // 무승부 없는 경우 [경기수, 승, 패]
        wins   = nums[1].val;
        draws  = 0;
        losses = nums[2].val;
      }

      // 득실률(1.0 초과 가능) 제외 - 배구 등 점수득실률은 승률로 사용 불가
      if (winRate !== null && winRate > 1.0) winRate = null;

      // 승률 없으면 승/무/패로 계산
      if (winRate === null && wins !== null) {
        const total = wins + (draws||0) + losses;
        if (total > 0) winRate = parseFloat((wins / total).toFixed(3));
      }
      if (winRate === null) continue;

      // 연속 결과 (3승, 9패, 2L, 4W, W1, L2 등)
      let streak = null;
      for (let i = cells.length - 1; i >= 2; i--) {
        const c = cells[i];
        if (/^\d+[승패]$/.test(c)) {
          const num = c.match(/\d+/)[0];
          const type = c.includes('승') ? 'W' : 'L';
          streak = type + num; break;
        }
        if (/^[WL]\d+$/.test(c)) { streak = c; break; }
        if (/^\d+[WL]$/.test(c)) {
          streak = c.match(/[WL]/)[0] + c.match(/\d+/)[0]; break;
        }
      }

      // 최근 5경기 폼
      let form = null;
      for (let i = cells.length - 1; i >= 0; i--) {
        if (/^[승패무\s]+$/.test(cells[i]) && cells[i].replace(/\s/g,'').length >= 3) {
          form = cells[i].trim().split(/\s+/).filter(r => ['승','패','무'].includes(r));
          break;
        }
      }

      // 홈/원정 승률 (명시적 승률 뒤에 추가 0.xxx가 있으면)
      let homeWR = null, awayWR = null;
      if (winRateIdx >= 0) {
        let wrCount = 0;
        for (let i = winRateIdx + 1; i < cells.length; i++) {
          if (/^[01]\.\d{3}$/.test(cells[i])) {
            wrCount++;
            if (wrCount === 1) homeWR = parseFloat(cells[i]);
            if (wrCount === 2) { awayWR = parseFloat(cells[i]); break; }
          }
        }
      }

      // 팀명 정규화 (순위페이지 팀명 → 경기목록 팀명과 매핑되도록)
      const NAME_FIX = {
        'kt wiz': 'KT 위즈', 'KT wiz': 'KT 위즈',
        '한신 타이거스': '한신 타이거즈',
        '요코하마 DeNA 베이스타스': '요코하마 DeNA 베이스타즈',
        '홋카이도 닛폰햄 파이터스': '닛폰햄 파이터스',
        '사이타마 세이부 라이온스': '세이부 라이온스',
        '도호쿠 라쿠텐 골든이글스': '라쿠텐 골든이글스',
        '도쿄 야쿠르트 스왈로스': '도쿄 야쿠르트 스왈로스',
        '히로시마 도요 카프': '히로시마 도요 카프',
      };
      const normalizedName = NAME_FIX[teamName] || teamName;
      teams[normalizedName] = { winRate, wins, draws, losses, streak, form, homeWR, awayWR };
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
    const [mlbData, kboData, npbData, nbaData, kblData, scData, vlData, vlWNationsData, vlMNationsData, nationalData] = await Promise.all([
      fetchLeagueData('bs', '40'),    // MLB
      fetchLeagueData('bs', '39'),    // KBO
      fetchLeagueData('bs', '159'),   // NPB
      fetchLeagueData('bk', '45'),    // NBA
      fetchLeagueData('bk'),           // KBL (기본값)
      fetchLeagueData('sc'),           // 축구
      fetchLeagueData('vl', '254'),   // KOVO 남자배구
      fetchLeagueData('vl', '282'),   // 여자 네이션스리그
      fetchLeagueData('vl', '283'),   // 남자 네이션스리그
      fetchNationalData(),
    ]);
    const fifaData = getFifaData();
    const allTeams = { ...fifaData, ...nationalData, ...scData, ...mlbData, ...kboData, ...npbData, ...nbaData, ...kblData, ...vlData, ...vlWNationsData, ...vlMNationsData };

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
