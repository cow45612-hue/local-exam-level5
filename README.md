# 地方特考五等免費刷題 App

純前端網頁版刷題工具，使用 `HTML + CSS + JavaScript`，不需要後端。題庫由 `questions.json` 管理，支援手機瀏覽器使用。

## 功能

- 選擇科目
- 隨機出題
- 每次最多 20 題
- 送出後自動批改
- 顯示答對率
- 顯示每題解析
- 錯題自動存到 `localStorage`
- 可重新練習錯題

## 檔案

```text
exam-project/
  index.html
  style.css
  app.js
  questions.json
```

## Windows 本機使用方式

建議用本機伺服器開啟，避免瀏覽器直接雙擊 HTML 時擋掉 `questions.json`。

1. 開啟 PowerShell。
2. 進入專案資料夾：

```powershell
cd "C:\Users\ome\Documents\New project\exam-project"
```

3. 啟動本機伺服器：

```powershell
python -m http.server 8080
```

4. 用瀏覽器打開：

```text
http://localhost:8080
```

## 手機在外面使用

請把本資料夾部署到 GitHub Pages。部署後會得到一個公開網址，手機不需要跟電腦連同一個 Wi-Fi，也能直接開網址刷題。

詳細步驟請看 `DEPLOY_GITHUB_PAGES.md`。

## 題庫格式

在 `questions.json` 新增題目時，使用以下格式：

```json
{
  "id": "chinese-001",
  "subject": "國文",
  "question": "題目文字",
  "A": "選項 A",
  "B": "選項 B",
  "C": "選項 C",
  "D": "選項 D",
  "answer": "B",
  "explanation": "解析文字"
}
```

`id` 請保持唯一，錯題功能會用 `id` 存到瀏覽器的 `localStorage`。
