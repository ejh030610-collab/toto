const fetch = require('node-fetch');

const SEQ_MAP = {
  '61': '30901', '62': '30947', '63': '30993',
  '64': '31028', '65': '31085', '66': '31131',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { game_round = '64', game_year = '2026', game_info_master_seq = '', sports = '', sort = '' } = req.query;
  const seq = game_info_master_seq || SEQ_MAP[game_round] || '31028';
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
