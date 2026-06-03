const fetch = require('node-fetch');

// 회차별 seq 맵 (자동 감지 실패시 백업)
const SEQ_MAP = {
  '55':'30613','56':'30659','57':'30705','58':'30751','59':'30797','60':'30855',
  '61':'30901','62':'30947','63':'30993','64':'31028','65':'31029',
  '66':'31085','67':'31131','68':'31177','69':'31223','70':'31269',
};

async function getSeq(round) {
  if (SEQ_MAP[round]) return SEQ_MAP[round];
  try {
    const res = await fetch('https://www.wisetoto.com/index.htm?tab_type=proto&game_type=pt&game_category=pt1', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.wisetoto.com/' },
    });
    const html = await res.text();
    const regex = new RegExp(`get_gameinfo_body\\('proto','pt1','\\d+','${round}','','','(\\d+)'`);
    const m = html.match(regex);
    if (m) return m[1];
  } catch(e) {}
  return null;
}

async function fetchRoundGames(round) {
  const seq = await getSeq(String(round));
  if (!seq) return [];
  const url = `https://www.wisetoto.com/util/gameinfo/get_proto_list.htm?game_category=pt1&game_year=2026&game_round=${round}&game_month=&game_day=&game_info_master_seq=${seq}&sports=&sort=&tab_type=proto`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.wisetoto.com/',
      },
    });
    const html = await res.text();

    // 경기 파싱
    const games = [];
    const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
    let ulMatch;
    while ((ulMatch = ulRegex.exec(html)) !== null) {
      const ul = ulMatch[0];

      // 기본 승무패만 (핸디/언더오버 제외)
      if (/<span[^>]*class="[^"]*d1[^"]*"/.test(ul)) continue;
      if (/<span[^>]*class="[^"]*d5[^"]*"/.test(ul)) continue;
      const hmText = ul.match(/class="hm"[^>]*>(.*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g,'').trim();
      if (hmText && hmText.length > 0) continue;

      // 경기 상태: "경기전"만
      const tag = ul.match(/class="tag"[^>]*>(.*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g,'').trim();

      // 홈팀/원정팀
      const home = ul.match(/class="[^"]*a6[^"]*"[\s\S]*?class="tn"[^>]*>(.*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g,'').trim();
      const away = ul.match(/class="[^"]*a8[^"]*"[\s\S]*?class="tn[^"]*"[^>]*>(.*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g,'').trim();

      if (!home || !away) continue;

      // 배당 결과 파싱 (경기 끝난 경우 결과 표시)
      // .a10 클래스에 결과가 있음
      const resultEl = ul.match(/class="[^"]*a10[^"]*"[^>]*>([\s\S]*?)<\/li>/)?.[1];
      let result = null;
      if (resultEl) {
        const resultText = resultEl.replace(/<[^>]+>/g,'').trim();
        if (resultText.includes('홈승') || resultText === '1') result = 'home';
        else if (resultText.includes('원정승') || resultText === '2') result = 'away';
        else if (resultText.includes('무') || resultText === '0') result = 'draw';
      }

      games.push({ home: home.replace(/\s*\d+\s*$/, '').trim(), away: away.replace(/^\s*\d+\s*/, '').trim(), result, status: tag });
    }
    return games;
  } catch(e) {
    return [];
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { team, current_round = '65' } = req.query;
  if (!team) return res.status(400).json({ error: '팀명 필요' });

  const round = parseInt(current_round);

  // 최근 10경기 결과를 위해 과거 회차들 조회
  // 끝난 경기만 (result가 있는 것)
  const results = [];
  const roundsToCheck = [];
  for (let r = round - 1; r >= Math.max(round - 15, 50); r--) {
    roundsToCheck.push(r);
  }

  // 병렬로 최대 8개 회차 조회
  const batchSize = 8;
  for (let i = 0; i < roundsToCheck.length && results.length < 10; i += batchSize) {
    const batch = roundsToCheck.slice(i, i + batchSize);
    const batchGames = await Promise.all(batch.map(r => fetchRoundGames(r)));

    for (let j = 0; j < batch.length; j++) {
      const games = batchGames[j];
      for (const g of games) {
        if (results.length >= 10) break;
        const isHome = g.home.includes(team) || team.includes(g.home.slice(0,2));
        const isAway = g.away.includes(team) || team.includes(g.away.slice(0,2));
        if (!isHome && !isAway) continue;
        if (!g.result) continue; // 결과 없는 경기 제외

        let myResult;
        if (g.result === 'draw') myResult = '무';
        else if ((g.result === 'home' && isHome) || (g.result === 'away' && isAway)) myResult = '승';
        else myResult = '패';

        results.push({
          round: batch[j],
          home: g.home,
          away: g.away,
          result: myResult,
          isHome,
        });
      }
    }
  }

  const wins   = results.filter(r => r.result === '승').length;
  const draws  = results.filter(r => r.result === '무').length;
  const losses = results.filter(r => r.result === '패').length;
  const total  = wins + draws + losses;
  const winRate = total > 0 ? parseFloat((wins / total).toFixed(3)) : null;

  // 연속 결과
  let streak = null;
  if (results.length > 0) {
    const first = results[0].result;
    let count = 0;
    for (const r of results) {
      if (r.result === first) count++;
      else break;
    }
    streak = (first === '승' ? 'W' : first === '패' ? 'L' : 'D') + count;
  }

  res.json({ team, wins, draws, losses, total, winRate, streak, results });
};
