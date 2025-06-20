import * as vscode from 'vscode';
import { IMessageHandler } from './types';
import { ReplicaService } from '../../../../services/ReplicaService';
import { Logger } from '../../../../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

/**
 * レプリカ関連のメッセージハンドラー
 */
export class ReplicaMessageHandler implements IMessageHandler {
    private replicaService: ReplicaService;

    constructor(
        private panel: vscode.WebviewPanel,
        private extensionPath: string,
        private projectPath: string | null
    ) {
        this.replicaService = ReplicaService.getInstance(extensionPath);
    }

    /**
     * メッセージを処理できるかチェック
     */
    canHandle(command: string): boolean {
        return command && command.startsWith('replica');
    }

    /**
     * メッセージを処理
     */
    async handleMessage(
        message: any,
        panel: vscode.WebviewPanel,
        context: {
            projectPath: string,
            showError: (message: string) => void,
            showSuccess: (message: string) => void,
            [key: string]: any
        }
    ): Promise<boolean> {
        try {
            switch (message.command) {
                case 'replicaCreate':
                    await this.handleCreateReplica(message.url);
                    break;
                    
                case 'replicaCheck':
                    await this.handleCheckReplica();
                    break;
                    
                case 'replicaOpen':
                    await this.handleOpenReplica();
                    break;
                    
                case 'replicaCopyElementInfo':
                    await this.handleCopyElementInfo(message.text);
                    break;
                    
                case 'replicaGetWebviewUri':
                    await this.handleGetWebviewUri(message.path);
                    break;
                    
                default:
                    Logger.warn('未処理のレプリカコマンド', { command: message.command });
            }
        } catch (error) {
            Logger.error('レプリカメッセージ処理エラー', 
                error instanceof Error ? error : new Error(String(error)), 
                { command: message.command });
            
            // エラーをWebviewに送信
            await this.panel.webview.postMessage({
                command: 'replicaError',
                error: error instanceof Error ? error.message : 'レプリカ処理中にエラーが発生しました'
            });
        }
        return true;
    }

    /**
     * レプリカを作成
     */
    private async handleCreateReplica(url: string): Promise<void> {
        if (!this.projectPath) {
            throw new Error('プロジェクトが選択されていません');
        }

        if (!url || !this.isValidUrl(url)) {
            throw new Error('有効なURLを入力してください');
        }

        // 進行状況を送信
        await this.panel.webview.postMessage({
            command: 'replicaCreateProgress',
            message: 'レプリカを作成中...'
        });

        // レプリカを作成
        const result = await this.replicaService.createReplica(url, this.projectPath);

        if (result.success) {
            // 成功を通知
            await this.panel.webview.postMessage({
                command: 'replicaCreateSuccess',
                path: result.outputDir,
                stats: result.stats
            });

            // VSCodeで通知
            vscode.window.showInformationMessage(`レプリカが作成されました: ${result.outputDir}`);
        } else {
            // エラーを通知
            await this.panel.webview.postMessage({
                command: 'replicaCreateError',
                error: result.error || 'レプリカの作成に失敗しました'
            });
        }
    }

    /**
     * レプリカの存在をチェック
     */
    private async handleCheckReplica(): Promise<void> {
        if (!this.projectPath) {
            await this.panel.webview.postMessage({
                command: 'replicaExists',
                exists: false
            });
            return;
        }

        const exists = await this.replicaService.checkReplicaExists(this.projectPath);
        
        await this.panel.webview.postMessage({
            command: 'replicaCheckResult',
            exists,
            path: exists ? this.replicaService.getReplicaPath(this.projectPath) : null
        });
    }

    /**
     * レプリカを外部ブラウザで開く
     */
    private async handleOpenReplica(): Promise<void> {
        if (!this.projectPath) {
            throw new Error('プロジェクトが選択されていません');
        }

        const replicaPath = this.replicaService.getReplicaPath(this.projectPath);
        
        // ファイルが存在するかチェック
        try {
            await fs.promises.access(replicaPath);
        } catch {
            throw new Error('レプリカが見つかりません');
        }

        // ファイルURIとして開く
        const uri = vscode.Uri.file(replicaPath);
        await vscode.env.openExternal(uri);
    }

    /**
     * 要素情報をクリップボードにコピー
     */
    private async handleCopyElementInfo(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
        
        // 成功を通知
        await this.panel.webview.postMessage({
            command: 'elementInfoCopied'
        });
        
        vscode.window.showInformationMessage('要素情報をコピーしました');
    }

    /**
     * URLの妥当性をチェック
     */
    private isValidUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * WebviewURIを取得してフロントエンドに送信
     */
    private async handleGetWebviewUri(filePath: string): Promise<void> {
        try {
            console.log('[DEBUG] WebviewURI変換リクエスト:', filePath);
            
            // ファイルが存在するかチェック
            await fs.promises.access(filePath);
            
            // VSCode WebviewURIに変換
            const fileUri = vscode.Uri.file(filePath);
            const webviewUri = this.panel.webview.asWebviewUri(fileUri);
            
            console.log('[DEBUG] WebviewURI変換完了:', webviewUri.toString());
            
            // フロントエンドに送信
            await this.panel.webview.postMessage({
                command: 'replicaWebviewUri',
                webviewUri: webviewUri.toString()
            });
        } catch (error) {
            console.error('[ERROR] WebviewURI変換エラー:', error);
            await this.panel.webview.postMessage({
                command: 'replicaError',
                error: 'レプリカファイルの読み込みに失敗しました'
            });
        }
    }

    /**
     * プロジェクトパスを更新
     */
    updateProjectPath(projectPath: string | null): void {
        this.projectPath = projectPath;
    }
}