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

    // master_seq 추출
    const seqMap = {};
    const seqRegex = /get_gameinfo_body\('proto','pt1','\d+','(\d+)','','','(\d+)'/g;
    let m;
    while ((m = seqRegex.exec(html)) !== null) {
      seqMap[m[1]] = m[2];
    }

    // 발매중 회차 찾기 - 여러 패턴 시도
    let currentRound = null;
    const patterns = [
      /승부식.*?(\d+)회차.*?발매중/,
      /(\d+)회차\s*발매중/,
      /발매중[^<]*(\d+)회차/,
    ];
    for (const pat of patterns) {
      const match = html.match(pat);
      if (match) { currentRound = parseInt(match[1]); break; }
    }

    // 패턴 실패시 seqMap의 가장 큰 회차 사용
    if (!currentRound && Object.keys(seqMap).length > 0) {
      currentRound = Math.max(...Object.keys(seqMap).map(Number));
    }

    // 현재 회차 기준 앞뒤 회차 목록 생성
    const rounds = [];
    if (currentRound) {
      for (let i = currentRound - 2; i <= currentRound + 3; i++) {
        if (i > 0) {
          rounds.push({
            round: i,
            seq: seqMap[i] || null,
            current: i === currentRound,
          });
        }
      }
    }

    res.json({ currentRound, rounds, seqMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
