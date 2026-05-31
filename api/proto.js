const fetch = require('node-fetch');

// seq를 와이즈토토에서 동적으로 가져오기
async function getSeq(game_round) {
  // 하드코딩 백업 맵 (API 실패시 사용)
  const SEQ_MAP = {
    '61':'30901','62':'30947','63':'30993',
    '64':'31028','65':'31085','66':'31131',
    '67':'31177','68':'31223','69':'31269','70':'31315',
  };
  if (SEQ_MAP[game_round]) return SEQ_MAP[game_round];

  // 와이즈토토에서 동적으로 찾기
  try {
    const res = await fetch('https://www.wisetoto.com/index.htm?tab_type=proto&game_type=pt&game_category=pt1', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.wisetoto.com/' },
    });
    const html = await res.text();
    const regex = new RegExp(`get_gameinfo_body\\('proto','pt1','\\d+','${game_round}','','','(\\d+)'`);
    const m = html.match(regex);
    if (m) return m[1];
  } catch(e) {}
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { game_round = '64', game_year = '2026', sports = '', sort = '' } = req.query;

  const seq = await getSeq(game_round);
  if (!seq) return res.status(400).json({ error: `${game_round}회차 seq를 찾을 수 없습니다.` });

  const url = `https://www.wisetoto.com/util/gameinfo/get_proto_list.htm?game_category=pt1&game_year=${game_year}&game_round=${game_round}&game_month=&game_day=&game_info_master_seq=${seq}&sports=${sports}&sort=${sort}&tab_type=proto`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.wisetoto.com/',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return res.status(response.status).json({ error: '와이즈토토 응답 오류' });
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
