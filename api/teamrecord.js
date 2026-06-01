const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { home_seq, away_seq, game_date, target = 'h' } = req.query;
  if (!home_seq || !away_seq || !game_date) {
    return res.status(400).json({ error: '필수 파라미터 없음' });
  }

  const url = `https://www.wisetoto.com/gameinfo/team_record.htm?game_category=pt1&home_team_info_seq=${home_seq}&away_team_info_seq=${away_seq}&game_date=${encodeURIComponent(game_date)}&target=${target}&type=all&list_num=10`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.wisetoto.com/',
      },
    });
    const html = await response.text();

    const rawResults = [];

    // <tr> 행 파싱
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(html)) !== null) {
      const rowHtml = trMatch[1];
      // td 텍스트 추출
      const tds = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        const text = tdMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        tds.push(text);
      }

      // 날짜 패턴 있는 행만 처리
      if (tds.length < 4 || !/^\d{4}\.\d{2}\.\d{2}/.test(tds[0])) continue;

      // 결과 찾기 (홈승/홈패/홈무/원정승/원정패/원정무)
      const resultCell = tds.find(t => /홈승|홈패|홈무|원정승|원정패|원정무/.test(t));
      if (!resultCell) continue;

      const resultMatch = resultCell.match(/홈승|홈패|홈무|원정승|원정패|원정무/);
      const resultRaw = resultMatch ? resultMatch[0] : '';

      let result = '-';
      if (target === 'h') {
        if (resultRaw === '홈승') result = '승';
        else if (resultRaw === '홈무') result = '무';
        else if (resultRaw === '홈패') result = '패';
      } else {
        if (resultRaw === '원정승') result = '승';
        else if (resultRaw === '원정무') result = '무';
        else if (resultRaw === '원정패') result = '패';
      }
      if (result === '-') continue;

      // 날짜, 리그, 홈팀, 스코어, 원정팀 파싱
      const dateStr = tds[0].slice(0, 10).replace(/\.\d+\(.*?\)/, '').trim();
      const league = tds[1] || '';
      // 홈팀명 (볼드 제거)
      const homeTeam = tds[2]?.replace(/\*\*/g,'').trim() || '';
      // 스코어: "숫자 : 숫자" 패턴
      const scoreCell = tds.find(t => /\d\s*:\s*\d/.test(t)) || '';
      const score = scoreCell.match(/(\d)\s*:\s*(\d)/)?.[0] || '';
      const awayTeam = tds[4]?.replace(/\*\*/g,'').trim() || '';

      rawResults.push({
        date: tds[0].slice(0,10),
        league,
        home: homeTeam,
        score,
        away: awayTeam,
        result,
      });

      if (rawResults.length >= 10) break;
    }

    const wins   = rawResults.filter(r => r.result === '승').length;
    const draws  = rawResults.filter(r => r.result === '무').length;
    const losses = rawResults.filter(r => r.result === '패').length;
    const total  = wins + draws + losses;
    const winRate = total > 0 ? parseFloat((wins / total).toFixed(3)) : null;

    res.json({ wins, draws, losses, total, winRate, rawResults });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
