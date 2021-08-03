const HEATMAP_BACKGROUND_COLOR = "17, 139, 238";

let musicData;
const xhr = new XMLHttpRequest();
const songDataFilepath = "master_sp_songs.csv";

function fetchSongDataFile() {
  xhr.open("GET", songDataFilepath);

  xhr.onreadystatechange = function () {
    switch (xhr.readyState) {
      case 0:
        // 未初期化状態.
        console.log("uninitialized!");
        break;
      case 1: // データ送信中.
        console.log("loading...");
        break;
      case 2: // 応答待ち.
        console.log("loaded.");
        break;
      case 3: // データ受信中.
        console.log("interactive... " + xhr.responseText.length + " bytes.");
        break;
      case 4: // データ受信完了.
        if (xhr.status === 200 || xhr.status === 304) {
          musicData = xhr.responseText; // responseXML もあり
          console.log("COMPLETE! :" + musicData);
        } else {
          console.log("Failed. HttpStatus: " + xhr.statusText);
        }
        break;
    }
  };
  xhr.send(null);
}

async function setTextareaData() {
  let rawData;
  const tmpData = document.getElementById("csv").value;
  if (!tmpData && navigator.clipboard) {
    // inputが空でClipboard APIが使えるならクリップボードのデータを読み込む
    // https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
    rawData = await navigator.clipboard.readText();
  } else {
    // そうでなければinputのデータを使う
    rawData = tmpData;
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
  const splittedData = musicData.split("\n");
  for (const line of splittedData) {
    const cols = line.split(",");
    if (cols.length < 2 || cols[0] === "version_full") {
      console.log(cols);
      continue; // skip header
    }

    ret.push({
      title: cols[1],
      version: cols[0],
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

  for (const line of splittedData) {
    const cols = line.split(",");
    if (cols[0] === "バージョン") {
      continue; // skip header
    }
    csvData.push({
      title: cols[1],
      version: cols[0],
      playcount: cols[4],
      SPB_level: cols[5],
      SPB_score: cols[6],
      SPB_misscount: cols[9],
      SPB_clearlamp: cols[10],
      SPB_djlevel: cols[11],
      SPN_level: cols[12],
      SPN_score: cols[13],
      SPN_misscount: cols[16],
      SPN_clearlamp: cols[17],
      SPN_djlevel: cols[18],
      SPH_level: cols[19],
      SPH_score: cols[20],
      SPH_misscount: cols[23],
      SPH_clearlamp: cols[24],
      SPH_djlevel: cols[25],
      SPA_level: cols[26],
      SPA_score: cols[27],
      SPA_misscount: cols[30],
      SPA_clearlamp: cols[31],
      SPA_djlevel: cols[32],
      SPL_level: cols[33],
      SPL_score: cols[34],
      SPL_misscount: cols[37],
      SPL_clearlamp: cols[38],
      SPL_djlevel: cols[39],
    });
  }
  // console.dir(csvData);

  const masterData = getMasterdata();
  // console.dir(masterData);

  const masterDataSong = {};
  for (const data of masterData) {
    masterDataSong[data["title"] + "_" + data["difficulty"]] = {
      version: data["version"],
      level: data["level"],
      notes: data["notes"],
      kaiden_average: data["kaiden_average"],
      top_score: data["top_score"],
    };
  }
  // console.dir(masterDataSong);
  const songScores = [];

  for (const song of csvData) {
    const difficulties = ["SPB", "SPN", "SPH", "SPA", "SPL"];
    for (const difficulty of difficulties) {
      if (song[difficulty + "_score"] > 0) {
        const songScore = {};
        const key = song["title"] + "_" + difficulty;
        songScore["level"] = song[difficulty + "_level"];
        songScore["title"] = song["title"];
        songScore["difficulty"] = difficulty;
        songScore["score"] = song[difficulty + "_score"];
        if (masterDataSong[key]) {
          songScore["rate"] =
            song[difficulty + "_score"] / masterDataSong[key]["notes"] / 2;
          songScore["notes"] = masterDataSong[key]["notes"];
          songScore["max-"] =
            masterDataSong[key]["notes"] * 2 - song[difficulty + "_score"];
          // rate validation
          if (songScore["rate"] < 0) {
            songScore["rate"] = 0;
          }
        } else {
          songScore["rate"] = 0.0;
          songScore["notes"] = 1;
          songScore["max-"] = 9999;
          console.log("not found:" + key);
        }
        songScores.push(songScore);
      }
    }
  }

  // sort by rate, in descending order
  songScores.sort((a, b) => b["rate"] - a["rate"]);

  const stats = {};
  for (const song of Object.values(masterDataSong)) {
    if (song["level"] === "-1") {
      continue;
    }
    if (stats[song["level"]] && stats[song["level"]]["total"] >= 0) {
      stats[song["level"]]["total"]++;
      // for debug
      if (song["level"] === "12") {
        console.dir(song);
        console.log(stats[song["level"]]["total"]);
      }
    } else {
      stats[song["level"]] = {
        total: 0,
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

  console.dir(songScores);

  for (const s of songScores) {
    if (s["max-"] === 9999) {
      continue; // because we have no data about this song.
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
  for (let i = 12; i >= 1; i--) {
    const row = stats[i];
    statistics.push("<tr>");
    statistics.push("<td>" + "☆" + i + "</td>");
    statistics.push("<td>" + row["played"] + "/" + row["total"] + "</td>");
    statistics.push("<td>" + (row["average_rate"] * 100).toFixed(3) + "%</td>");
    [
      "1keta",
      "2keta",
      ...[...Array(5)].map((_, i) => 100 - (i + 1) + "%"),
      "MAX-",
      "AAA",
      "AA",
      "A",
    ].forEach((name) => {
      statistics.push(createStatisticsCell(row, name));
    });
  }
  statistics.push("</table>");

  const statisticsSummary = [];
  let num1keta = 0;
  let num99p = 0;
  let num98p = 0;
  for (let i = 12; i >= 1; i--) {
    if (i === 12) {
      let line = "";
      line +=
        "☆12 avg: " +
        (stats[i]["average_rate"] * 100).toFixed(2) +
        "% (" +
        stats[i]["played"] +
        "/" +
        stats[i]["total"] +
        ") | ";
      line += "max-**: " + stats[i]["2keta"] + " / ";
      line += "99%: " + stats[i]["99%"] + " / ";
      line += "98%: " + stats[i]["98%"] + " / ";
      line += "97%: " + stats[i]["97%"] + " / ";
      line += "max-: " + stats[i]["MAX-"] + " / ";
      line += "AAA: " + stats[i]["AAA"] + "\n";
      statisticsSummary.push(line);
    } else if (i === 11) {
      let line = "";
      line +=
        "☆11 avg: " +
        (stats[i]["average_rate"] * 100).toFixed(2) +
        "% (" +
        stats[i]["played"] +
        "/" +
        stats[i]["total"] +
        ") | ";
      line += "max-**: " + stats[i]["2keta"] + " / ";
      line += "99%: " + stats[i]["99%"] + " / ";
      line += "98%: " + stats[i]["98%"] + " / ";
      line += "97%: " + stats[i]["97%"] + " / ";
      line += "max-: " + stats[i]["MAX-"] + " / ";
      line += "AAA: " + stats[i]["AAA"] + "\n";
      statisticsSummary.push(line);
    }
    num1keta += stats[i]["1keta"];
    num99p += stats[i]["99%"];
    num98p += stats[i]["98%"];
  }
  statisticsSummary.push("Total | max-*: " + num1keta + " / ");
  statisticsSummary.push("99%: " + num99p + " / ");
  statisticsSummary.push("98%: " + num98p + "\n\n");

  console.log(statisticsSummary.join(""));

  const list = ["<table>"];
  const listHeader = `
    <thead>
    <tr>
    <td> ☆ </td>
    <td> title </td>
    <td> score </td>
    <td> rate </td>
    <td> MAX- </td>
    </tr>
    </thead>
    `;
  list.push(listHeader);

  for (const songScore of songScores) {
    // console.log(s);
    if (
      document.getElementById("check_12").checked === true &&
      songScore["level"] !== "12"
    ) {
      continue;
    }
    list.push("<tr>");
    list.push("<td>☆" + songScore["level"] + "</td>");
    list.push(
      "<td>" +
        songScore["title"] +
        " (" +
        songScore["difficulty"] +
        ")" +
        "</td>"
    );
    list.push("<td>" + songScore["score"] + "</td>");
    list.push("<td>" + (songScore["rate"] * 100).toFixed(2) + "%</td>");
    list.push(
      "<td>MAX-" + (songScore["notes"] * 2 - songScore["score"]) + "</td>"
    );
    list.push("</tr>");
  }
  list.push("</table>");

  // console.dir(list);

  return {
    list: list.join(""),
    statistics: statistics.join(""),
    statistics_summary: statisticsSummary.join(""),
  };
}

function createStatisticsCell(row, name) {
  const value = row[name];
  const alpha = value / row["total"];
  const style =
    "background-color: rgba(" + HEATMAP_BACKGROUND_COLOR + ", " + alpha + ");";
  return '<td style="' + style + '">' + value + "</td>";
}

window.onload = function () {
  const button = document.getElementById("sub");

  fetchSongDataFile();
  button.onclick = setTextareaData;
};

function toggleHeatmap(checked) {
  document.getElementById("statistics").classList.toggle("heatmap", checked);
}
