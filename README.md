# Red & White Flag Challenge

GameGen 可直接遊玩的網頁交付版本。根目錄是已建置的 React 19 遊戲，含 9:16 動態封面，採 HTML ZIP 直接上傳模式。

## 本地預覽

在本目錄執行 `python -m http.server 8000`，瀏覽 `http://localhost:8000/`。請使用 HTTP 服務載入設定與資產。

## GameGen 打包

在本目錄執行 PowerShell：

```powershell
Compress-Archive -Path index.html,poster.webp,assets,common,config -DestinationPath ../redwhiteflag.zip -Force
```

將 `redwhiteflag.zip` 上傳後台。ZIP 根目錄須直接包含 `index.html`、`poster.webp`、`assets/`、`common/`、`config/`，不可再包一層目錄。專案及 ZIP 名稱只保留遊戲名稱，不添加 noskin 或 html 後綴。

## 檔案與維護

- `index.html`：已建置入口。
- `assets/`：已編譯 JS/CSS。
- `common/textures/`、`common/audio/`：遊戲圖片與音訊；其他媒體依 `config/asset-manifest.json` 保留。
- `config/language/`：英文、繁體中文、簡體中文、日文；預設英文。
- `config/generalConfiguration.json`：載入設定；本交付版本使用包內資產，本地預覽不需要後台注入 assets.baseUrl。
- `poster.webp`：936 × 1664、精確 9:16、無損 WebP，供四語系共用；此為平台封面，不加入遊戲內資產表。

此儲存庫本次同步的是使用者提供的建置產物，未包含對應 React／TypeScript 原始碼或依賴鎖定檔，無法從這份 checkout 重新編譯。後續修改玩法須取得對應原始碼後重新建置；本次取代的舊版獨立 JS 與舊素材可由 Git 歷史查閱。

## 驗證與限制

2026-09-10：交付 ZIP 的 CRC、入口、檔名唯一性及封面解碼／比例均通過。同步後每個執行檔案均與交付 ZIP 逐一比對 SHA-256，並在 HTTP 子路徑逐檔讀回核對內容一致。初次交付已在 HTTP 子路徑抽查進入遊戲及玩法；這不代表完整回歸測試通過。

- 2026-09-16 已將 20 張正式 PNG 原尺寸轉為保留 alpha 的高品質 WebP，同步更新 manifest、JS 與 CSS 引用；本機 HTTP 子路徑完成 100% 預載且無 console 警告或錯誤，重建 ZIP 由 27.30 MB 降至 7.23 MB。
- 2026-09-16 全遊戲回歸時修正建置 bundle 內 10 張結局 CG 仍動態組合 `.png` 的路徑，並更換 bundle 檔名避免瀏覽器沿用舊快取；CG WebP 已實際載入且無 console error。
- 尚未驗證 GameGen 後台實際上傳結果、全關卡、四語系完整流程及遠端 style/commonPath 故障降級。
