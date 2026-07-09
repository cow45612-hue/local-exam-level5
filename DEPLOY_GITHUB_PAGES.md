# GitHub Pages 部署方式

這個資料夾已經是可直接部署的靜態網站。

## 第一次部署

1. 到 GitHub 建立新 repository，例如：

```text
local-exam-level5
```

2. 在 PowerShell 進入專案資料夾：

```powershell
cd "C:\Users\ome\Documents\New project\exam-project"
```

3. 初始化 Git 並推上 GitHub：

```powershell
git init
git branch -M main
git add .
git commit -m "Initial exam app"
git remote add origin https://github.com/你的帳號/local-exam-level5.git
git push -u origin main
```

請把 `你的帳號` 換成你的 GitHub 帳號。

4. 到 GitHub repository 頁面：

```text
Settings -> Pages
```

5. Source 選：

```text
Deploy from a branch
```

6. Branch 選：

```text
main / root
```

7. 儲存後等待 1 到 3 分鐘。

網站網址通常會是：

```text
https://你的帳號.github.io/local-exam-level5/
```

## 之後更新題庫

修改 `questions.json` 後執行：

```powershell
git add questions.json
git commit -m "Update questions"
git push
```

GitHub Pages 會自動更新網站。
