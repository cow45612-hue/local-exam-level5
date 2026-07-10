# 地方特考五等免費刷題 App

這是一個純前端刷題網頁，使用 `HTML + CSS + JavaScript`，不需要後端。題庫集中在 `questions.json`，手機瀏覽器也可以使用。

## 功能

- 選擇科目
- 隨機出題
- 每次 20 題
- 送出後自動批改
- 顯示答對率
- 顯示每題解析
- 錯題自動存到 `localStorage`
- 可重新練習錯題

## 題庫來源

目前已匯入「地方特考五等－一般行政」民國 109-112 年可取得的 A/B/C/D 選擇題，共 500 題。

資料來源是考選部歷屆試題，並使用 LawPlayer 的結構化資料輔助整理成 `questions.json`。官方題庫主要提供題目與答案，所以目前解析欄位會顯示官方答案與來源註記；尚未加入補習班詳解。

考選部公告指出地方特考五等自 113 年起不再舉辦，相關職缺改提列初等考試。因此本題庫不混入 113 年以後的初等考試題目；若要練習初等考，建議另開題庫分類。

部分年度/科目在來源 API 中資料不完整，因此本題庫不是所有年度、所有類科的完整總集合。要擴充其他類科或年份，可修改 `tools/import-lawplayer-questions.mjs` 後重新執行。

## 檔案

```text
exam-project/
  index.html
  style.css
  app.js
  questions.json
  tools/
    import-lawplayer-questions.mjs
```

## Windows 本機使用

1. 開啟 PowerShell。
2. 進入專案資料夾：

```powershell
cd "C:\Users\ome\Documents\New project\exam-project"
```

3. 啟動本機靜態伺服器：

```powershell
python -m http.server 8080
```

4. 用瀏覽器打開：

```text
http://localhost:8080
```

## 手機使用

如果 GitHub Pages 已啟用，手機直接打開 GitHub Pages 網址即可使用。第一次載入後，錯題會存在該手機瀏覽器的 `localStorage` 裡。
