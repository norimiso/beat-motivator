window.onload = function(){
    let raw_data;
    let button = document.getElementById('sub');

    function setTextareaData(){
        raw_data = document.getElementById('csv').value;
        let hoge = document.getElementById('hoge');
        let data = processCsv(raw_data);
        hoge.innerHTML = data;
    }

    function processCsv(csv){
        splittedData = csv.split("\n");
        if (splittedData[0].split(",")[0] !== "バージョン") {
            return "CSV 入れて！！！！！！"
        }

        let AA = "空っぽ";

        for (const line of splittedData) {
            temp = line.split(",");
            if (temp[1] === "AA"){
                AA = temp;
            }
        }
        console.dir(AA);
        return "あなたの AA{SPA) の点数は" + AA[27] + "点です!!";
    }


    button.onclick = setTextareaData;
}