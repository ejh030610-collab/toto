const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const response = await fetch('https://www.wisetoto.com/index.htm?tab_type=proto&game_type=pt&game_category=pt1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.wisetoto.com/',
      },
    });
    const html = await response.text();

    // 현재 발매중인 회차 추출: "승부식 XX회차 발매중" 패턴
    const rounds = [];
    const activeMatch = html.match(/승부식.*?(\d+)회차.*?발매중/);
    const currentRound = activeMatch ? parseInt(activeMatch[1]) : null;

    // master_seq 추출: get_gameinfo_body('proto','pt1','2026','XX','','','YYYYY' 패턴
    const seqMap = {};
    const seqRegex = /get_gameinfo_body\('proto','pt1','\d+','(\d+)','','','(\d+)'/g;
    let m;
    while ((m = seqRegex.exec(html)) !== null) {
      seqMap[m[1]] = m[2];
    }

    if (currentRound) {
      // 현재 회차 기준 앞뒤 3개씩 표시
      for (let i = currentRound - 2; i <= currentRound + 3; i++) {
        if (i > 0) rounds.push({ round: i, seq: seqMap[i] || null, current: i === currentRound });
      }
    }

    res.json({ currentRound, rounds, seqMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
