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

    // 테이블 행 파싱
    const rawResults = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const row = rowMatch[1];
      const cells = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
      }

      // 날짜 패턴으로 경기 행 감지
      if (cells.length >= 5 && /\d{4}\.\d{2}\.\d{2}/.test(cells[0])) {
        const dateMatch = cells[0].match(/(\d{4}\.\d{2}\.\d{2})/);
        const date = dateMatch ? dateMatch[1].slice(5) : cells[0].slice(0,10);
        const league = cells[1] || '';
        const homeTeam = cells[2] || '';
        const score = cells[3] || '';
        const awayTeam = cells[4] || '';
        const resultRaw = cells[cells.length - 2] || '';

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

        if (result !== '-') {
          rawResults.push({ date, league, home: homeTeam, score, away: awayTeam, result });
        }
      }
    }

    // 승/무/패 집계
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
