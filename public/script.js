const HEATMAP_BACKGROUND_COLOR = "17, 139, 238";

let songData;
const songDataFilepath = "master_sp_songs.csv";

function fetchSongDataFile() {
  fetch(songDataFilepath)
    .then((res) => {
      if (res.status === 200 || res.status === 304) {
        return res.text();
      } else {
        throw new Error(res.statusText);
      }
    })
    .then((resText) => {
      songData = resText;
      console.log("COMPLETE! :", resText);
    })
    .catch((statusText) => {
      console.log("Failed. HttpStatus:", statusText);
    });
}

async function setTextareaData() {
  let rawData;
  const csvInput = document.getElementById("csv").value;
  if (!csvInput && navigator.clipboard) {
    // inputが空でClipboard APIが使えるならクリップボードのデータを読み込む
    // https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
    rawData = await navigator.clipboard.readText();
  } else {
    // そうでなければinputのデータを使う
    rawData = csvInput;
  }
  const data = processCsv(rawData);
  const tweetUrl =
    '<a href="https://twitter.com/intent/tweet?hashtags=beat_motivator&ref_src=twsrc%5Etfw&text=' +
    encodeURI(data["statistics_summary"]) +
    '&tw_p=tweetbutton&url=https%3A%2F%2Fgoofy-wiles-fc39fe.netlify.app%2F" target="_blank" rel="noopener noreferrer"> Tweet your IIDX stats!! </a>';

  document.getElementById("list").innerHTML = data["list"];
  document.getElementById("statistics").innerHTML = data["statistics"];
  document.getElementById("tweet_button").innerHTML = tweetUrl;
}

function getMasterdata() {
  const ret = [];
  const splittedData = songData.split("\n");
  for (const line of splittedData) {
    const cols = line.split(",");
    if (cols.length < 2 || cols[0] === "version_full") {
      continue; // skip header
    }

    ret.push({
      title: cols[1],
      version_full: cols[0],
      version: cols[4],
      difficulty: cols[5],
      level: cols[7],
      notes: cols[8],
      kaiden_average: cols[9],
      top_score: cols[10],
    });
  }
  return ret;
}

function processCsv(csv) {
  const splittedData = csv.split("\n");
  if (splittedData[0].split(",")[0] !== "バージョン") {
    return "CSV 入れて！！！！！！";
  }

  const csvData = [];
  // テキストエリアの CSV をパース
  for (const line of splittedData) {
    const cols = line.split(",");
    if (cols[0] === "バージョン") {
      continue; // skip header
    }
    csvData.push({
      title: cols[1],
      version_full: cols[0],
      playcount: cols[4],
      SPB: {
        level: cols[5],
        score: cols[6],
        misscount: cols[9],
        clearlamp: cols[10],
        djlevel: cols[11],
      },
      SPN: {
        level: cols[12],
        score: cols[13],
        misscount: cols[16],
        clearlamp: cols[17],
        djlevel: cols[18],
      },
      SPH: {
        level: cols[19],
        score: cols[20],
        misscount: cols[23],
        clearlamp: cols[24],
        djlevel: cols[25],
      },
      SPA: {
        level: cols[26],
        score: cols[27],
        misscount: cols[30],
        clearlamp: cols[31],
        djlevel: cols[32],
      },
      SPL: {
        level: cols[33],
        score: cols[34],
        misscount: cols[37],
        clearlamp: cols[38],
        djlevel: cols[39],
      },
    });
  }
  // console.dir(csvData);

  // マスターデータを読み込み
  const masterData = getMasterdata();
  // console.dir(masterData);

  // 後で処理がしやすいように"曲名_難易度"みたいなキーでmasterDataSongに入れ直す
  const masterDataSong = {};
  for (const data of masterData) {
    masterDataSong[`${data["title"]}_${data["difficulty"]}`] = {
      version: data["version"],
      level: data["level"],
      notes: data["notes"],
      kaiden_average: data["kaiden_average"],
      top_score: data["top_score"],
    };
  }
  // console.dir(masterDataSong);
  const songScores = [];

  // バラしたcsvのデータsongScores に良い感じに格納
  for (const song of csvData) {
    const difficulties = ["SPB", "SPN", "SPH", "SPA", "SPL"];
    for (const difficulty of difficulties) {
      if (
        song[difficulty]["score"] > 0 ||
        // no play を表示するための条件分岐
        (song[difficulty]["score"] >= 0 &&
          document.getElementById("include_no_play").checked === true &&
          song[difficulty]["level"] !== "0")
      ) {
        const songScore = {};
        const key = `${song["title"]}_${difficulty}`;
        songScore["level"] = song[difficulty]["level"];
        songScore["title"] = song["title"];
        songScore["difficulty"] = difficulty;
        songScore["score"] = song[difficulty]["score"];
        if (masterDataSong[key] && masterDataSong[key]["notes"] > 0) {
          songScore["version"] = masterDataSong[key]["version"];
          songScore["rate"] =
            song[difficulty]["score"] / masterDataSong[key]["notes"] / 2;
          songScore["notes"] = masterDataSong[key]["notes"];
          songScore["max-"] =
            masterDataSong[key]["notes"] * 2 - song[difficulty]["score"];
          // rate validation
          if (songScore["rate"] < 0) {
            songScore["rate"] = 0;
          }
          songScores.push(songScore);
        } else {
          console.log("not found:", key);
        }
      }
    }
  }

  // sort by rate, in descending order
  songScores.sort((a, b) => b["rate"] - a["rate"]);

  // 表に表示するための統計データの作成。まずはここで初期化。
  const stats = {};
  for (const song of Object.values(masterDataSong)) {
    if (song["level"] === "-1") {
      continue;
    }
    if (stats[song["level"]] && stats[song["level"]]["total"] >= 0) {
      stats[song["level"]]["total"]++;
    } else {
      stats[song["level"]] = {
        total: 1,
        played: 0,
        average_rate: 0.0,
        A: 0,
        AA: 0,
        AAA: 0,
        "MAX-": 0,
        "95%": 0,
        "96%": 0,
        "97%": 0,
        "98%": 0,
        "99%": 0,
        "1keta": 0,
        "2keta": 0,
      };
    }
  }

  // 統計情報の作成
  for (const s of songScores) {
    if (s["level"] === "0") {
      continue;
    }
    const songLv = s["level"];
    stats[songLv]["played"]++;
    stats[songLv]["average_rate"] += s["rate"]; // will be devined by "played"
    if (s["max-"] < 10) {
      stats[songLv]["1keta"]++;
    } else if (s["max-"] < 100) {
      stats[songLv]["2keta"]++;
    }
    if (s["rate"] >= 0.99) {
      stats[songLv]["99%"]++;
    } else if (s["rate"] >= 0.98) {
      stats[songLv]["98%"]++;
    } else if (s["rate"] >= 0.97) {
      stats[songLv]["97%"]++;
    } else if (s["rate"] >= 0.96) {
      stats[songLv]["96%"]++;
    } else if (s["rate"] >= 0.95) {
      stats[songLv]["95%"]++;
    } else if (s["rate"] >= 17 / 18) {
      stats[songLv]["MAX-"]++;
    } else if (s["rate"] >= 16 / 18) {
      stats[songLv]["AAA"]++;
    } else if (s["rate"] >= 14 / 18) {
      stats[songLv]["AA"]++;
    } else if (s["rate"] >= 12 / 18) {
      stats[songLv]["A"]++;
    }
  }

  for (let lv = 1; lv <= 12; lv++) {
    if (stats[lv]["played"] > 0) {
      stats[lv]["average_rate"] /= stats[lv]["played"];
    } else {
      stats[lv]["average_rate"] = 0;
    }
    stats[lv]["2keta"] += stats[lv]["1keta"];
    stats[lv]["98%"] += stats[lv]["99%"];
    stats[lv]["97%"] += stats[lv]["98%"];
    stats[lv]["96%"] += stats[lv]["97%"];
    stats[lv]["95%"] += stats[lv]["96%"];
    stats[lv]["MAX-"] += stats[lv]["95%"];
    stats[lv]["AAA"] += stats[lv]["MAX-"];
    stats[lv]["AA"] += stats[lv]["AAA"];
    stats[lv]["A"] += stats[lv]["AA"];
  }

  console.dir(stats);

  // 作った統計情報を元にHTMLのテーブル作成
  // まずはヘッダー
  const statistics = ["<table>"];
  const statisticsHeader = `
    <thead>
    <tr>
    <td> ☆ </td>
    <td> played / total </td>
    <td> average rate </td>
    <td> MAX-* </td>
    <td> MAX-** </td>
    <td> 99% </td>
    <td> 98% </td>
    <td> 97% </td>
    <td> 96% </td>
    <td> 95% </td>
    <td> MAX- </td>
    <td> AAA </td>
    <td> AA </td>
    <td> A </td>
    </tr>
    </thead>
    `;
  statistics.push(statisticsHeader);

  // 次は中身
  for (let lv = 12; lv >= 1; lv--) {
    const row = stats[lv];
    statistics.push("<tr>");
    statistics.push(`<td>☆${lv}</td>`);
    statistics.push(`<td>${row["played"]}/${row["total"]}</td>`);
    statistics.push(`<td>${(row["average_rate"] * 100).toFixed(3)}%</td>`);
    [
      "1keta",
      "2keta",
      ...[...Array(5)].map((_, i) => `${100 - (i + 1)}%`),
      "MAX-",
      "AAA",
      "AA",
      "A",
    ].forEach((name) => {
      statistics.push(createStatisticsCell(row, name));
    });
  }
  statistics.push("</table>");

  // Twitter 投稿用の統計情報のサマリの作成
  const statisticsSummary = [];
  let num1keta = 0;
  let num99p = 0;
  let num98p = 0;
  for (let lv = 12; lv >= 1; lv--) {
    if (lv === 12 || lv === 11) {
      statisticsSummary.push(statSummaryLineOfLevel(stats, lv));
    }
    num1keta += stats[lv]["1keta"];
    num99p += stats[lv]["99%"];
    num98p += stats[lv]["98%"];
  }
  statisticsSummary.push(`Total | max-*: ${num1keta} / `);
  statisticsSummary.push(`99%: ${num99p} / `);
  statisticsSummary.push(`98%: ${num98p}\n\n`);

  // 全曲のデータ用のHTMLテーブル作成
  const list = ["<table>"];
  const listHeader = `
    <thead>
    <tr>
    <td> Ver </td>
    <td> ☆ </td>
    <td> Title </td>
    <td> Score </td>
    <td> Rate </td>
    <td> MAX- </td>
    </tr>
    </thead>
    `;
  list.push(listHeader);

  for (const songScore of songScores) {
    if (
      document.getElementById("check_12").checked === true &&
      songScore["level"] !== "12"
    ) {
      continue;
    }
    list.push("<tr>");
    list.push(`<td>${songScore["version"]}</td>`);
    list.push(`<td>☆${songScore["level"]}</td>`);
    list.push(`<td>${songScore["title"]} (${songScore["difficulty"]})</td>`);
    list.push(`<td>${songScore["score"]}</td>`);
    list.push(`<td>${(songScore["rate"] * 100).toFixed(2)}%</td>`);
    list.push(`<td>MAX-${songScore["notes"] * 2 - songScore["score"]}</td>`);
    list.push("</tr>");
  }
  list.push("</table>");

  // HTML を作って返却。
  return {
    list: list.join(""),
    statistics: statistics.join(""),
    statistics_summary: statisticsSummary.join(""),
  };
}

function statSummaryLineOfLevel(stats, lv) {
  let line = "";

  const formattedAvgRate = (stats[lv]["average_rate"] * 100).toFixed(2);
  line += `☆${lv} avg: ${formattedAvgRate}% (${stats[lv]["played"]}/${stats[lv]["total"]}) | `;
  line += `max-**: ${stats[lv]["2keta"]} / `;
  line += `99%: ${stats[lv]["99%"]} / `;
  line += `98%: ${stats[lv]["98%"]} / `;
  line += `97%: ${stats[lv]["97%"]} / `;
  line += `max-: ${stats[lv]["MAX-"]} / `;
  line += `AAA: ${stats[lv]["AAA"]}\n`;
  return line;
}

function createStatisticsCell(row, name) {
  const value = row[name];
  const alpha = value / row["total"];
  const style = `background-color: rgba(${HEATMAP_BACKGROUND_COLOR}, ${alpha});`;
  return `<td style="${style}">${value}</td>`;
}

window.onload = function () {
  const button = document.getElementById("sub");

  fetchSongDataFile();
  button.onclick = setTextareaData;
};

function toggleHeatmap(checked) {
  document.getElementById("statistics").classList.toggle("heatmap", checked);
}
