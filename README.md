# 初等考試免費刷題 App

這是一個純前端刷題網頁，使用 `HTML + CSS + JavaScript`，不需要後端。題庫集中在 `questions.json`，手機瀏覽器也可以使用。

## 功能

- 選擇科目
- 隨機出題
- 每次 20 題
- 點選答案後即時批改
- 顯示答對率
- 顯示每題答案與解析
- 錯題自動存到 `localStorage`
- 可重新練習錯題

## 題庫來源

目前已匯入「公務人員初等考試－一般行政」民國 109-115 年可取得的單選題，共 1324 題。

資料來源：

- 民國 109-114 年：考選部歷屆試題，並使用 LawPlayer 結構化資料輔助整理。
- 民國 115 年：直接由考選部 115 年公務人員初等考試考畢試題 PDF 與標準答案 PDF 解析匯入。

目前 App 是單選練習模式，所以複選題先排除，避免使用者只能選一個答案卻遇到多選答案。官方題庫主要提供題目與答案，所以解析欄位目前顯示官方答案與來源註記；尚未加入補習班詳解。

## 檔案

```text
exam-project/
  index.html
  style.css
  app.js
  questions.json
  tools/
    import-initial-exam-questions.mjs
    import-moex-115-initial.py
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

如果 GitHub Pages 已啟用，手機直接打開 GitHub Pages 網址即可使用。錯題會存在該手機瀏覽器的 `localStorage` 裡。

## 重新匯入題庫

```powershell
python -m pip install pypdf pdfplumber
node tools\import-initial-exam-questions.mjs
python tools\import-moex-115-initial.py
```
