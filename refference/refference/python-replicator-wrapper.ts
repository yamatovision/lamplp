/**
 * Python Website Replicator Wrapper
 * 
 * 既存のPythonスクリプトをTypeScriptから呼び出すラッパー
 * website-replicator.tsの完全置き換え
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { promises as fs } from 'fs';
import { logger } from './logger';

/**
 * レプリカ結果インターフェース（既存のものと互換性を保持）
 */
export interface ReplicaResult {
  success: boolean;
  html: string;
  css: string;
  outputDir: string;
  error?: string;
}

/**
 * Python Website Replicator Wrapper クラス
 */
export class PythonWebsiteReplicator {
  private scriptPath: string;
  private outputDir: string;

  constructor(
    private targetUrl: string,
    outputDir?: string,
    _disableJavaScript: boolean = true, // Pythonスクリプトは基本的にJavaScript無効（使用されないが互換性のため保持）
    private projectId?: string // プロジェクトID（ファイル保存用）
  ) {
    // Pythonスクリプトのパスを解決
    this.scriptPath = path.join(process.cwd(), 'scripts', 'website_replicator.py');
    this.outputDir = outputDir || `replica_${Date.now()}`;
  }

  /**
   * ウェブサイトレプリカを作成
   */
  async replicate(): Promise<ReplicaResult> {
    try {
      logger.info('Python Website Replicator開始', { 
        url: this.targetUrl,
        outputDir: this.outputDir,
        scriptPath: this.scriptPath
      });

      // Pythonスクリプトの存在確認
      try {
        await fs.access(this.scriptPath);
      } catch (error) {
        throw new Error(`Pythonスクリプトが見つかりません: ${this.scriptPath}`);
      }

      // Pythonの実行可能性チェック
      await this.checkPythonEnvironment();

      // Pythonスクリプト実行
      const result = await this.executePythonScript();

      if (result.success) {
        // 成功時: 出力ファイルを読み込んでレスポンス形式に変換
        const { html, css } = await this.loadGeneratedFiles(result.outputDir);
        
        // プロジェクトIDが指定されている場合、ファイルをプロジェクトディレクトリに移動
        let finalOutputDir = result.outputDir;
        if (this.projectId) {
          finalOutputDir = await this.moveFilesToProjectDirectory(result.outputDir, this.projectId);
        }
        
        logger.info('Python Website Replicator完了', {
          url: this.targetUrl,
          outputDir: finalOutputDir,
          htmlSize: html.length,
          cssSize: css.length
        });

        return {
          success: true,
          html,
          css,
          outputDir: finalOutputDir
        };
      } else {
        throw new Error(result.error || 'Python スクリプトの実行に失敗しました');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Python Website Replicatorエラー', {
        url: this.targetUrl,
        error: errorMessage
      });

      return {
        success: false,
        html: '',
        css: '',
        outputDir: this.outputDir,
        error: errorMessage
      };
    }
  }

  /**
   * Python環境をチェック
   */
  private async checkPythonEnvironment(): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['--version']);
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          logger.debug('Python環境確認完了');
          resolve();
        } else {
          reject(new Error('Python3が利用できません。Python3をインストールしてください。'));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Python環境エラー: ${error.message}`));
      });
    });
  }

  /**
   * Pythonスクリプトを実行
   */
  private async executePythonScript(): Promise<{ success: boolean; outputDir: string; error?: string }> {
    return new Promise((resolve) => {
      const args = [this.scriptPath, this.targetUrl];
      
      // 出力ディレクトリが指定されている場合
      if (this.outputDir) {
        args.push('-o', this.outputDir);
      }

      logger.info('Pythonスクリプト実行開始', { 
        command: 'python3',
        args: args.join(' '),
        url: this.targetUrl 
      });

      const pythonProcess = spawn('python3', args);
      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // リアルタイムでログ出力（プログレス表示のため）
        logger.debug('Python stdout:', output.trim());
      });

      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        logger.warn('Python stderr:', output.trim());
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          // 成功時: 出力ディレクトリを解析
          const outputDirMatch = stdout.match(/Output directory: (.+)/);
          const detectedOutputDir = outputDirMatch && outputDirMatch[1]
            ? outputDirMatch[1].trim() 
            : this.outputDir;

          logger.info('Pythonスクリプト実行成功', { 
            url: this.targetUrl,
            outputDir: detectedOutputDir,
            exitCode: code
          });

          resolve({
            success: true,
            outputDir: detectedOutputDir
          });
        } else {
          logger.error('Pythonスクリプト実行失敗', { 
            url: this.targetUrl,
            exitCode: code,
            stderr: stderr
          });

          resolve({
            success: false,
            outputDir: this.outputDir,
            error: stderr || `プロセスがコード ${code} で終了しました`
          });
        }
      });

      pythonProcess.on('error', (error) => {
        logger.error('Pythonプロセスエラー', { 
          url: this.targetUrl,
          error: error.message 
        });

        resolve({
          success: false,
          outputDir: this.outputDir,
          error: `Pythonプロセスの起動に失敗: ${error.message}`
        });
      });
    });
  }

  /**
   * 生成されたファイルを読み込み
   */
  private async loadGeneratedFiles(outputDir: string): Promise<{ html: string; css: string }> {
    try {
      const htmlPath = path.join(outputDir, 'index.html');
      const cssPath = path.join(outputDir, 'styles.css');

      // HTMLファイルを読み込み
      let html = '';
      try {
        html = await fs.readFile(htmlPath, 'utf-8');
        logger.debug('HTMLファイル読み込み成功', { 
          path: htmlPath,
          size: html.length 
        });
      } catch (error) {
        logger.warn('HTMLファイル読み込み失敗', { 
          path: htmlPath,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new Error(`HTMLファイルの読み込みに失敗: ${htmlPath}`);
      }

      // CSSファイルを読み込み（存在しない場合は空文字列）
      let css = '';
      try {
        css = await fs.readFile(cssPath, 'utf-8');
        logger.debug('CSSファイル読み込み成功', { 
          path: cssPath,
          size: css.length 
        });
      } catch (error) {
        logger.info('CSSファイルが見つかりません（問題なし）', { path: cssPath });
        // CSSファイルが存在しない場合は空文字列を使用
        css = '';
      }

      // CSSファイルからスタイルを抽出してHTMLに統合
      html = await this.integrateCssIntoHtml(html, css, outputDir);

      return { html, css };

    } catch (error) {
      logger.error('生成ファイル読み込みエラー', { 
        outputDir,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * CSSをHTMLに統合し、相対パスを修正
   */
  private async integrateCssIntoHtml(html: string, css: string, outputDir: string): Promise<string> {
    try {
      // 外部CSSファイルをHTMLに統合
      if (css.trim()) {
        // <style>タグとして追加
        const styleTag = `<style>\n${css}\n</style>`;
        
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${styleTag}\n</head>`);
        } else {
          // <head>タグがない場合は先頭に追加
          html = `<html><head>${styleTag}</head><body>${html}</body></html>`;
        }
      }

      // Pythonスクリプトが生成した相対パスを適切に処理
      html = await this.fixRelativePaths(html, outputDir);

      logger.debug('CSS統合と相対パス修正完了', {
        outputDir,
        htmlLength: html.length,
        cssLength: css.length
      });

      return html;

    } catch (error) {
      logger.warn('CSS統合エラー', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return html; // エラーが発生してもHTMLはそのまま返す
    }
  }

  /**
   * 相対パスを修正
   */
  private async fixRelativePaths(html: string, outputDir: string): Promise<string> {
    try {
      // data URLはそのまま保持
      html = html.replace(/src="data:[^"]+"/g, (match) => match);
      html = html.replace(/href="data:[^"]+"/g, (match) => match);

      // 外部リソースの相対パスを確認し、存在しないものは適切なプレースホルダーに置き換え
      const srcMatches = html.match(/src="\.\/[^"]+"/g) || [];
      const hrefMatches = html.match(/href="\.\/[^"]+"/g) || [];
      
      // 透明な1x1px画像のデータURL
      const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      
      for (const match of [...srcMatches, ...hrefMatches]) {
        const pathMatch = match.match(/"\.\/([^"]+)"/);
        if (pathMatch && pathMatch[1]) {
          const relativePath = pathMatch[1];
          const fullPath = path.join(outputDir, relativePath);
          
          try {
            await fs.access(fullPath);
            // ファイルが存在する場合はそのまま
          } catch {
            // ファイルが存在しない場合は適切なプレースホルダーに置き換え
            logger.debug('参照ファイルが見つかりません（プレースホルダーで置き換え）', { 
              path: fullPath,
              relativePath 
            });
            
            // ファイルタイプに応じた処理
            const fileExtension = path.extname(relativePath).toLowerCase();
            let replacement = match;
            
            if (match.startsWith('src=')) {
              // 画像ファイルの場合は透明画像で置き換え
              if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(fileExtension)) {
                replacement = `src="${transparentPixel}"`;
              } else {
                // その他のsrcの場合は空文字
                replacement = 'src=""';
              }
            } else if (match.startsWith('href=')) {
              // CSSファイルの場合は空のdata URLで置き換え
              if (fileExtension === '.css') {
                replacement = 'href="data:text/css;base64,"';
              } else {
                // その他のhrefの場合は#で置き換え
                replacement = 'href="#"';
              }
            }
            
            html = html.replace(match, replacement);
          }
        }
      }

      return html;

    } catch (error) {
      logger.warn('相対パス修正エラー', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return html;
    }
  }

  /**
   * ファイルをプロジェクトディレクトリに移動
   */
  private async moveFilesToProjectDirectory(sourceDir: string, projectId: string): Promise<string> {
    try {
      // プロジェクトディレクトリのパスを構築
      const projectDir = `/tmp/lplamp-projects/${projectId}`;
      const replicaDir = path.join(projectDir, 'replica');
      
      // レプリカディレクトリを作成
      await fs.mkdir(replicaDir, { recursive: true });
      
      logger.info('ファイル移動開始', {
        sourceDir,
        targetDir: replicaDir,
        projectId
      });
      
      // ソースディレクトリの内容を再帰的にコピー
      await this.copyDirectory(sourceDir, replicaDir);
      
      // 元のディレクトリを削除
      await fs.rm(sourceDir, { recursive: true, force: true });
      
      logger.info('ファイル移動完了', {
        sourceDir,
        targetDir: replicaDir,
        projectId
      });
      
      return replicaDir;
      
    } catch (error) {
      logger.error('ファイル移動エラー', {
        error: error instanceof Error ? error.message : String(error),
        sourceDir,
        projectId
      });
      
      // エラーが発生した場合は元のディレクトリを返す
      return sourceDir;
    }
  }

  /**
   * ディレクトリを再帰的にコピー
   */
  private async copyDirectory(source: string, target: string): Promise<void> {
    const stats = await fs.stat(source);
    
    if (stats.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      const entries = await fs.readdir(source);
      
      for (const entry of entries) {
        const sourcePath = path.join(source, entry);
        const targetPath = path.join(target, entry);
        await this.copyDirectory(sourcePath, targetPath);
      }
    } else {
      await fs.copyFile(source, target);
    }
  }
}

/**
 * 後方互換性のためのエクスポート
 */
export const WebsiteReplicator = PythonWebsiteReplicator;