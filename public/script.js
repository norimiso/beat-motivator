window.onload = function() {
    let raw_data;
    let button = document.getElementById("sub");

    function setTextareaData() {
        raw_data = document.getElementById("csv").value;
        let hoge = document.getElementById("hoge");
        let data = processCsv(raw_data);
        hoge.innerHTML = data;
    }

    function processCsv(csv) {

        let splittedData = csv.split("\n");
        if (splittedData[0].split(",")[0] !== "バージョン") {
            return "CSV 入れて！！！！！！"
        }

        // 半角ダブルクォートがあるとパースできないので置換
        // replaceだと1個めしか置換しないのでsplit&joinを使用
        csv = csv.split('"').join('”');
        let data = $.csv.toObjects(csv);

        // 半角ダブルクォートに戻す
        for (const row of data) {
            row["タイトル"] = (row["タイトル"]).split('”').join('"');
            row["アーティスト"] = (row["アーティスト"]).split('”').join('"');
            row["ジャンル"] = (row["ジャンル"]).split('”').join('"');
            row["バージョン"] = (row["バージョン"]).split('”').join('"');
        }

        let AA = "空っぽ";

        for (const row of data) {
            if (row["タイトル"] == "AA") {
                AA = row["ANOTHER スコア"];
            }
        }
        console.dir(AA);
        return "あなたの AA(SPA) の点数は" + AA + "点です!!";
    }


    button.onclick = setTextareaData;
}
