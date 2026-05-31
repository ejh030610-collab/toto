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

    // 결과 파싱: 홈승/무/원정승 카운트
    // "홈승", "홈패", "홈무", "원정승", "원정패", "원정무" 패턴
    const results = [];
    const rowRegex = /홈승|홈패|홈무|원정승|원정패|원정무/g;
    let m;
    while ((m = rowRegex.exec(html)) !== null) {
      results.push(m[0]);
    }

    // target 기준으로 승/무/패 계산
    let wins = 0, draws = 0, losses = 0;
    results.forEach(r => {
      if (target === 'h') {
        if (r === '홈승') wins++;
        else if (r === '홈무') draws++;
        else if (r === '홈패') losses++;
      } else {
        if (r === '원정승') wins++;
        else if (r === '원정무') draws++;
        else if (r === '원정패') losses++;
      }
    });

    const total = wins + draws + losses;
    const winRate = total > 0 ? parseFloat((wins / total).toFixed(3)) : null;

    res.json({ wins, draws, losses, total, winRate, results: results.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
