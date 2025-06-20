import * as vscode from 'vscode';
import { HtmlTemplateGenerator } from './HtmlTemplateGenerator';
import { IProjectInfo } from '../types/ScopeManagerTypes';

/**
 * スコープマネージャーのHTML生成を担当
 */
export class ScopeManagerTemplate {
  /**
   * スコープマネージャーのHTMLを生成
   * @param params パラメータオブジェクト
   */
  public static generateHtml(params: {
    webview: vscode.Webview;
    extensionUri: vscode.Uri;
    activeTabId: string;
    activeProject: IProjectInfo | null;
  }): string {
    const { webview, extensionUri, activeTabId, activeProject } = params;

    // nonce値を生成
    const nonce = HtmlTemplateGenerator.generateNonce();

    // CSPを設定
    const csp = HtmlTemplateGenerator.generateCSP(webview, nonce);

    // スタイルシートやスクリプトのURIを取得
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'styles', 'reset.css')
    );
    const designSystemStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'styles', 'design-system.css')
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'scopeManager.css')
    );
    // DialogManagerのスタイルシート
    const dialogManagerStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'components', 'dialogManager', 'dialogManager.css')
    );
    // PromptCardsのスタイルシート
    const promptCardsStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'components', 'promptCards', 'promptCards.css')
    );
    // スクリプト
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'scopeManager.js')
    );
    const sharingPanelScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'components', 'sharingPanel', 'sharingPanel.js')
    );
    const lpReplicaScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'components', 'lpReplica', 'lpReplica.js')
    );

    // Material Iconsの読み込み
    const materialIconsUrl = 'https://fonts.googleapis.com/icon?family=Material+Icons';

    // プロジェクト情報の取得
    const projectName = activeProject?.name || '選択なし';
    const projectPath = activeProject?.path || '';

    // HTMLを生成して返す
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="${csp}">
      <link href="${styleResetUri}" rel="stylesheet">
      <link href="${designSystemStyleUri}" rel="stylesheet">
      <link href="${styleMainUri}" rel="stylesheet">
      <link href="${dialogManagerStyleUri}" rel="stylesheet">
      <link href="${promptCardsStyleUri}" rel="stylesheet">
      <!-- ファイルブラウザのスタイルシートは削除済み -->
      <link href="${materialIconsUrl}" rel="stylesheet">
      <title>ブルーランプ</title>
      <style>
        /* LP開発専用モード: タブを非表示 */
        .tabs-container {
          display: none !important;
        }
        
        /* LP開発専用モード: プロジェクト表示部分も非表示 */
        .tabs {
          display: none !important;
        }
        
        /* LP開発専用モード: 他のタブコンテンツを非表示 */
        #scope-progress-tab,
        #files-tab,
        #claude-code-tab,
        #tools-tab,
        #requirements-tab {
          display: none !important;
        }
        
        /* LP開発専用モード: LPレプリカタブを常に表示 */
        #lp-replica-tab {
          display: block !important;
        }
        
        /* LP開発専用モード: カードの上部パディングを削除 */
        .card {
          padding-top: 0 !important;
        }
        
        /* LP開発専用モード: セクションの上部マージンを削減 */
        #lp-replica-tab .section {
          margin-top: 10px !important;
        }
        
        /* LP開発専用モード: レプリカ作成フォームが非表示の時はビューアを上に詰める */
        #replica-create-form[style*="display: none"] + #replica-viewer,
        #replica-create-form:not([style]) + #replica-viewer {
          margin-top: 0 !important;
        }
        
        /* LP開発専用モード: レプリカビューアのヘッダーも上に詰める */
        #replica-viewer .viewer-header {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        
        /* LP開発専用モード: レプリカが存在する場合の調整 */
        #lp-replica-tab .section:has(#replica-create-form[style*="display: none"]) h3 {
          display: none !important;
        }
        
        /* LP開発専用モード: レプリカビューアが表示されている時のセクション調整 */
        #lp-replica-tab .section:has(#replica-viewer[style*="display: block"]) {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        
        /* LP開発専用モード: iframeを画面いっぱいに表示 */
        #replica-iframe {
          height: calc(100vh - 100px) !important;
          min-height: 500px !important;
          max-height: calc(100vh - 100px) !important;
        }
        
        /* インラインスタイルを上書き */
        iframe#replica-iframe[style] {
          height: calc(100vh - 100px) !important;
        }
        
        /* LP開発専用モード: レプリカビューアコンテナも高さ調整 */
        #replica-viewer {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        /* LP開発専用モード: コンテンツエリア全体の高さ調整 */
        .content-area {
          height: 100vh !important;
          overflow: hidden !important;
          max-height: 100vh !important;
          padding: 0 !important;
        }
        
        .card {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
        }
        
        #lp-replica-tab {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        
        #lp-replica-tab .section {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        
        /* tab-contentのデフォルトスタイルを上書き */
        .tab-content {
          height: 100% !important;
          max-height: 100% !important;
          overflow: hidden !important;
        }
        
        /* レプリカビューアのフレックスボックス調整 */
        #replica-viewer {
          flex: 1 !important;
          overflow: hidden !important;
        }
        
        /* ビューアヘッダーとインフォの高さを固定 */
        #replica-viewer .viewer-header {
          flex-shrink: 0;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
        }
        
        #replica-viewer .viewer-header h4 {
          margin: 0;
          font-size: 16px;
        }
        
        #replica-viewer .viewer-info-inline {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--app-text-secondary);
          font-size: 12px;
          flex: 1;
          margin: 0 20px;
        }
        
        #replica-viewer .viewer-info-inline .material-icons {
          font-size: 16px;
        }
        
        #replica-viewer .viewer-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        /* ズームボタンのスタイル */
        #zoom-reset-btn {
          min-width: 50px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .zoom-level {
          font-size: 12px;
        }
        
        .viewer-actions .divider {
          width: 1px;
          height: 20px;
          background-color: var(--app-border-color);
          margin: 0 5px;
        }
        
        /* iframeのズーム用ラッパー */
        .iframe-wrapper {
          width: 100%;
          height: 100%;
          overflow: hidden;
          position: relative;
          flex: 1;
        }
        
        #replica-iframe {
          border: 1px solid var(--app-border) !important;
        }
        
        /* VSCodeのネイティブドラッグ&ドロップメッセージを非表示にする */
        .monaco-editor .dnd-overlay, 
        .monaco-editor .dnd-overlay *,
        .monaco-dnd-overlay,
        .monaco-dnd-tree-overlay,
        [role="tooltip"][aria-label*="シフト"],
        [role="tooltip"][aria-label*="ドロップ"],
        [role="tooltip"][aria-label*="⌘"],
        [role="tooltip"][aria-label*="Cmd"] {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        
        /* ドラッグ中のデフォルトポインタを変更 */
        body.dragging * {
          cursor: copy !important;
        }
        
        /* ドラッグ効果をより目立たせる */
        .drag-effect.active {
          background-color: rgba(74, 105, 189, 0.3) !important;
          z-index: 9999999 !important;
        }
        
        /* 選択中プロジェクトのスタイル */
        .project-item.active {
          background-color: rgba(74, 105, 189, 0.1);
          border-left: 3px solid var(--app-primary);
        }
        
        .file-input {
          opacity: 0;
          position: absolute;
          pointer-events: none;
        }
      </style>
      <script nonce="${nonce}">
        // 即時関数でVSCodeのドラッグ&ドロップメッセージを抑制
        (function() {
          // VSCodeのドラッグ&ドロップメッセージを検出して非表示にする
          function suppressVSCodeDragDropMessage() {
            // ドラッグ&ドロップ関連のオーバーレイを監視して非表示にする
            const observer = new MutationObserver(function(mutations) {
              document.querySelectorAll('.monaco-editor .dnd-overlay, .monaco-dnd-overlay, [aria-label*="ドロップする"], [aria-label*="⌘"]').forEach(function(el) {
                if (el) {
                  el.style.display = 'none';
                  el.style.opacity = '0';
                  el.style.visibility = 'hidden';
                  el.style.pointerEvents = 'none';
                }
              });
            });
            
            // document全体を監視
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style', 'class']
            });
            
            // ドラッグ&ドロップイベントをキャプチャ
            ['dragstart', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(function(eventName) {
              document.addEventListener(eventName, function(e) {
                // VSCodeのオーバーレイを強制的に非表示
                document.querySelectorAll('.monaco-editor .dnd-overlay, .monaco-dnd-overlay, [aria-label*="ドロップする"], [aria-label*="⌘"]').forEach(function(el) {
                  if (el) el.style.display = 'none';
                });
              }, true);
            });
          }
          
          // DOM読み込み完了時または既に読み込まれている場合に実行
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', suppressVSCodeDragDropMessage);
          } else {
            suppressVSCodeDragDropMessage();
          }
        })();
      </script>
    </head>
    <body>
      <div class="scope-manager-container">
        <div class="main-content">
          <!-- 左側: プロジェクトナビゲーション -->
          <div class="project-nav">
            <button class="toggle-nav-btn" id="toggle-nav-btn" title="パネルを開閉">
              <span class="material-icons">chevron_left</span>
            </button>
            <div class="project-label">PRJ</div>
            <div class="filter-bar">
              <input type="text" class="search-input" placeholder="プロジェクト検索...">
            </div>
            <h3 style="margin-top: 10px;">プロジェクト</h3>
            
            <div class="project-actions">
              <button class="button button-secondary" id="new-project-btn">
                <span class="material-icons">add</span>
                新規作成
              </button>
              <button class="button button-secondary" id="load-project-btn">
                <span class="material-icons">folder_open</span>
                読み込む
              </button>
            </div>
            
            <div id="project-list" class="project-list">
              <!-- プロジェクトリストはJSで動的に生成 -->
            </div>
          </div>
          
          <!-- 右側: コンテンツエリア -->
          <div class="content-area">
            <!-- タブ付きカード -->
            <div class="card">
              <div class="tabs">
                <div class="project-display">
                  <span class="project-name">${projectName}</span>
                  <span class="project-path-display">${projectPath}</span>
                </div>
                <div class="tabs-container">
                  <div class="tab ${activeTabId === 'scope-progress' ? 'active' : ''}" data-tab="scope-progress">進捗状況</div>
                  <div class="tab ${activeTabId === 'files' ? 'active' : ''}" data-tab="files">ファイル</div>
                  <div class="tab ${activeTabId === 'claude-code' ? 'active' : ''}" data-tab="claude-code">ClaudeCode連携</div>
                  <div class="tab ${activeTabId === 'tools' ? 'active' : ''}" data-tab="tools">モックアップギャラリー</div>
                  <div class="tab ${activeTabId === 'lp-replica' ? 'active' : ''}" data-tab="lp-replica">LPレプリカ</div>
                </div>
              </div>
              
              <!-- 進捗状況タブコンテンツ -->
              ${this._generateProgressTabContent(activeTabId)}

              <!-- ファイルブラウザタブコンテンツ -->
              <!-- ファイルブラウザタブコンテンツは削除されました -->

              <!-- ClaudeCode連携タブコンテンツ -->
              ${this._generateClaudeCodeTabContent(activeTabId)}
              
              <!-- 開発ツールタブコンテンツ (モックアップギャラリー表示用のプレースホルダ) -->
              ${this._generateToolsTabContent(activeTabId)}

              <!-- ファイルタブコンテンツ -->
              ${this._generateFilesTabContent(activeTabId)}

              <!-- LPレプリカタブコンテンツ -->
              ${this._generateLPReplicaTabContent(activeTabId)}
            </div>
          </div>
        </div>
      </div>
      
      <!-- 開発プロンプトモーダル -->
      ${this._generatePromptModalContent()}
      
      <div id="error-container" style="display: none; position: fixed; bottom: 20px; right: 20px; background-color: var(--app-danger); color: white; padding: 10px; border-radius: 4px;"></div>
      
      <!-- メインスクリプト -->
      <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      
      <!-- 共有パネルコンポーネント専用スクリプト -->
      <script type="module" nonce="${nonce}" src="${sharingPanelScriptUri}"></script>
      
      <!-- LPレプリカコンポーネント専用スクリプト -->
      <script type="module" nonce="${nonce}" src="${lpReplicaScriptUri}"></script>
      
      <!-- ファイルブラウザコンポーネント専用スクリプト -->
      <!-- ファイルブラウザのスクリプトは削除済み -->
    </body>
    </html>`;
  }

  /**
   * 進捗状況タブのコンテンツを生成
   */
  private static _generateProgressTabContent(activeTabId: string): string {
    return `
      <div id="scope-progress-tab" class="tab-content ${activeTabId === 'scope-progress' ? 'active' : ''}">
        <div class="card-body">
          <div class="markdown-content">
            <!-- ここにSCOPE_PROGRESS.mdの内容がマークダウン表示される -->
            <p>読み込み中...</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 要件定義タブのコンテンツを生成
   */
  private static _generateRequirementsTabContent(activeTabId: string): string {
    return `
      <div id="requirements-tab" class="tab-content ${activeTabId === 'requirements' ? 'active' : ''}">
        <div class="card-body">
          <div class="markdown-content">
            <!-- ここにrequirements.mdの内容がマークダウン表示される -->
            <p>読み込み中...</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ClaudeCode連携タブのコンテンツを生成
   */
  private static _generateClaudeCodeTabContent(activeTabId: string): string {
    return `
      <div id="claude-code-tab" class="tab-content ${activeTabId === 'claude-code' ? 'active' : ''}">
        <div class="claude-share-container">
          <!-- 左側：テキスト入力エリア -->
          <div class="text-input-area">
            <textarea class="share-textarea" placeholder="ここにClaudeCodeと共有したいテキストを入力..."></textarea>
            <!-- ボタンエリア -->
            <div class="action-buttons">
              <button class="button button-secondary" id="clear-button">クリア</button>
              <button class="button" id="share-to-claude">保存</button>
            </div>
            
            <!-- 保存結果通知（成功時のみ表示） -->
            <div class="save-notification" id="save-notification" style="display: none;">
              <span class="material-icons success-icon">check_circle</span>
              <span class="notification-text">保存完了</span>
            </div>
          </div>
          
          <!-- 右側：画像アップロードエリアと履歴 -->
          <div class="image-upload-area">
            <!-- ドロップゾーン -->
            <div class="drop-zone" id="drop-zone">
              <span class="material-icons">add_photo_alternate</span>
              <p>画像をアップロード<br><span style="font-size: 12px; color: var(--app-text-secondary);">（ファイルをドラッグ＆ドロップ）</span></p>
              <button class="button-secondary" id="file-select-btn">ブラウズ...</button>
              <input type="file" id="file-input" accept="image/*" style="display: none;">
            </div>
            
            <!-- 履歴表示エリア -->
            <div class="history-container">
              <h4>共有履歴</h4>
              <div class="shared-history-list">
                <!-- 履歴アイテムはJSで動的に生成 -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ツールタブのコンテンツを生成
   */
  private static _generateToolsTabContent(activeTabId: string): string {
    return `
      <div id="tools-tab" class="tab-content ${activeTabId === 'tools' ? 'active' : ''}">
        <!-- モックアップギャラリーを表示するための空のコンテナ -->
      </div>
    `;
  }

  /**
   * ファイルタブのコンテンツを生成
   */
  private static _generateFilesTabContent(activeTabId: string): string {
    return `
      <div id="files-tab" class="tab-content ${activeTabId === 'files' ? 'active' : ''}">
        <!-- マークダウンビューワーを表示するための空のコンテナ -->
        <div class="files-container">
          <div class="files-placeholder">
            <span class="material-icons">description</span>
            <h3>マークダウンビューワーを開いています...</h3>
            <p>マークダウンビューワーが別ウィンドウで開かれます</p>
            <div class="loading-indicator">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * プロンプトモーダルのコンテンツを生成
   */
  private static _generatePromptModalContent(): string {
    return `
      <div class="toggle-share-btn" id="toggle-share-btn" style="display: flex;">
        <span class="material-icons">description</span>
        <span>開発プロンプト</span>
      </div>
      
      <div class="claude-code-share-area" id="claude-code-share">
        <div class="claude-code-share-header">
          <h3>開発プロンプト</h3>
          <div>
            <button class="button button-secondary" id="minimize-share-btn">
              <span class="material-icons">expand_more</span>
            </button>
          </div>
        </div>
        
        <!-- プロンプトグリッド - 初期表示要素なし、JSで動的に生成 -->
        <div class="prompt-grid">
          <!-- プロンプトカードはJSで動的に生成 -->
        </div>
      </div>
    `;
  }

  /**
   * LPレプリカタブのコンテンツを生成
   */
  private static _generateLPReplicaTabContent(activeTabId: string): string {
    const isActive = activeTabId === 'lp-replica';
    
    return `
      <div id="lp-replica-tab" class="tab-content ${isActive ? 'active' : ''}">
        <div class="section">
          <h3>LPレプリカ作成</h3>
          
          <!-- レプリカ作成フォーム -->
          <div class="replica-create-form" id="replica-create-form">
            <div class="input-group">
              <label for="replica-url">対象ページのURL</label>
              <input 
                type="url" 
                id="replica-url" 
                class="input" 
                placeholder="https://example.com" 
                required
              />
            </div>
            
            <button id="create-replica-btn" class="button button-primary">
              <span class="material-icons">content_copy</span>
              レプリカを作成
            </button>
            
            <div id="replica-status" class="status-message" style="display: none;"></div>
          </div>
          
          <!-- レプリカビューア -->
          <div class="replica-viewer" id="replica-viewer" style="display: none;">
            <div class="viewer-header">
              <h4>レプリカビューア</h4>
              <div class="viewer-info-inline">
                <span class="material-icons">info</span>
                <span class="info-text">要素をAlt+クリック（Mac: Option+クリック）すると、要素情報を取得できます。</span>
              </div>
              <div class="viewer-actions">
                <button id="zoom-out-btn" class="button button-icon" title="縮小">
                  <span class="material-icons">zoom_out</span>
                </button>
                <button id="zoom-reset-btn" class="button button-icon" title="100%">
                  <span class="zoom-level">100%</span>
                </button>
                <button id="zoom-in-btn" class="button button-icon" title="拡大">
                  <span class="material-icons">zoom_in</span>
                </button>
                <div class="divider"></div>
                <button id="refresh-replica-btn" class="button button-icon" title="更新">
                  <span class="material-icons">refresh</span>
                </button>
                <button id="open-external-btn" class="button button-icon" title="ブラウザで開く">
                  <span class="material-icons">open_in_new</span>
                </button>
              </div>
            </div>
            
            <div class="iframe-wrapper">
              <iframe 
                id="replica-iframe" 
                class="replica-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                style="width: 100%; height: 600px; border: 1px solid var(--app-border);"
              ></iframe>
            </div>
          </div>
          
          <!-- 要素情報表示エリア -->
          <div class="element-info" id="element-info" style="display: none;">
            <h4>選択された要素情報</h4>
            <pre id="element-info-content"></pre>
            <button id="copy-element-info-btn" class="button button-secondary">
              <span class="material-icons">content_copy</span>
              情報をコピー
            </button>
          </div>
        </div>
      </div>
    `;
  }
}