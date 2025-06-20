#!/usr/bin/env python3
"""
Website Replicator - URLを指定してウェブサイトの完全なローカルレプリカを作成するツール

使用方法:
    python3 website_replicator.py https://example.com
"""

import os
import sys
import re
import json
import time
import argparse
import requests
from urllib.parse import urljoin, urlparse
from datetime import datetime
import shutil


class WebsiteReplicator:
    """ウェブサイトレプリケータークラス"""
    
    def __init__(self, url, output_dir=None):
        self.url = url.rstrip('/')
        self.domain = urlparse(url).netloc
        self.output_dir = output_dir or f"replica_{self.domain}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.downloaded = set()
        self.failed = []
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        
        # 統計情報
        self.stats = {
            'html_files': 0,
            'css_files': 0,
            'js_files': 0,
            'images': 0,
            'fonts': 0,
            'other': 0,
            'total_size': 0
        }
    
    def replicate(self):
        """メインの複製処理"""
        print(f"\n🚀 Website Replicator v1.0")
        print(f"📍 Target URL: {self.url}")
        print(f"📁 Output Directory: {self.output_dir}")
        print("=" * 60)
        
        # ディレクトリ作成
        os.makedirs(self.output_dir, exist_ok=True)
        
        # ステップ1: HTMLを取得
        print("\n[1/7] 📄 Fetching HTML...")
        html_content = self.fetch_html()
        if not html_content:
            print("❌ Failed to fetch HTML. Exiting.")
            return False
        
        # ステップ2: リソースを抽出
        print("\n[2/7] 🔍 Extracting resources...")
        resources = self.extract_resources(html_content)
        self.save_resource_list(resources)
        
        # ステップ3: リソースをダウンロード
        print("\n[3/7] 📥 Downloading resources...")
        self.download_all_resources(resources)
        
        # ステップ4: パスを変換
        print("\n[4/7] 🔄 Converting paths...")
        html_content = self.convert_paths(html_content)
        
        # ステップ5: 失敗したリソースを修正
        print("\n[5/7] 🔧 Fixing missing resources...")
        self.fix_missing_resources()
        
        # ステップ6: 動的コンテンツを静的化
        print("\n[6/7] 📦 Staticizing dynamic content...")
        html_content = self.staticize_content(html_content)
        
        # ステップ7: 最終的なHTMLを保存
        print("\n[7/7] 💾 Saving final HTML...")
        self.save_html(html_content)
        
        # 結果を表示
        self.show_results()
        
        # ヘルパーファイルを作成
        self.create_helper_files()
        
        return True
    
    def fetch_html(self):
        """HTMLを取得"""
        try:
            response = self.session.get(self.url, timeout=30)
            response.raise_for_status()
            response.encoding = response.apparent_encoding
            
            self.stats['html_files'] = 1
            self.stats['total_size'] += len(response.content)
            
            print(f"✅ Fetched HTML ({len(response.text):,} characters)")
            return response.text
            
        except Exception as e:
            print(f"❌ Error: {e}")
            return None
    
    def extract_resources(self, html_content):
        """HTMLからリソースを抽出"""
        resources = {
            'css': set(),
            'js': set(),
            'images': set(),
            'fonts': set(),
            'other': set()
        }
        
        # CSS
        for match in re.findall(r'<link[^>]+href=["\']([^"\']+\.css[^"\']*)["\']', html_content):
            resources['css'].add(urljoin(self.url, match))
        
        # JS
        for match in re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html_content):
            resources['js'].add(urljoin(self.url, match))
        
        # Images
        image_patterns = [
            r'<img[^>]+src=["\']([^"\']+)["\']',
            r'data-src=["\']([^"\']+)["\']',
            r'background-image:\s*url\(["\']?([^"\')\s]+)["\']?\)',
        ]
        for pattern in image_patterns:
            for match in re.findall(pattern, html_content):
                if not match.startswith('data:'):
                    resources['images'].add(urljoin(self.url, match))
        
        # Fonts
        for match in re.findall(r'["\']([^"\']+\.(woff2?|ttf|otf|eot))["\']', html_content):
            resources['fonts'].add(urljoin(self.url, match[0]))
        
        # 統計を表示
        total = sum(len(urls) for urls in resources.values())
        print(f"✅ Found {total} resources:")
        for category, urls in resources.items():
            if urls:
                print(f"   - {category}: {len(urls)} files")
        
        # 辞書をリストに変換
        return {k: list(v) for k, v in resources.items()}
    
    def save_resource_list(self, resources):
        """リソースリストを保存"""
        with open(os.path.join(self.output_dir, 'resources.json'), 'w') as f:
            json.dump(resources, f, indent=2)
    
    def download_all_resources(self, resources):
        """すべてのリソースをダウンロード"""
        total = sum(len(urls) for urls in resources.values())
        current = 0
        
        for category, urls in resources.items():
            for url in urls:
                current += 1
                print(f"\r[{current}/{total}] Downloading: {os.path.basename(url)[:50]}...", end='')
                self.download_resource(url, category)
                time.sleep(0.1)  # レート制限
        
        print(f"\n✅ Downloaded {len(self.downloaded)} files")
        if self.failed:
            print(f"⚠️  Failed: {len(self.failed)} files")
    
    def download_resource(self, url, category):
        """個別のリソースをダウンロード"""
        if url in self.downloaded:
            return
        
        try:
            local_path = self.url_to_local_path(url)
            full_path = os.path.join(self.output_dir, local_path)
            
            # ディレクトリ作成
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # ダウンロード
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # 保存
            with open(full_path, 'wb') as f:
                f.write(response.content)
            
            self.downloaded.add(url)
            self.stats[category] = self.stats.get(category, 0) + 1
            self.stats['total_size'] += len(response.content)
            
            # CSS/JSの依存関係も処理
            if category in ['css', 'js'] and response.text:
                self.process_dependencies(response.text, url, category)
                
        except Exception as e:
            self.failed.append((url, str(e)))
    
    def process_dependencies(self, content, base_url, file_type):
        """CSS/JS内の依存関係を処理"""
        if file_type == 'css':
            # @import
            for match in re.findall(r'@import\s+["\']([^"\']+)["\']', content):
                dep_url = urljoin(base_url, match)
                self.download_resource(dep_url, 'css')
            
            # url()
            for match in re.findall(r'url\(["\']?([^"\')\s]+)["\']?\)', content):
                if not match.startswith('data:'):
                    dep_url = urljoin(base_url, match)
                    category = self.get_resource_category(dep_url)
                    self.download_resource(dep_url, category)
    
    def get_resource_category(self, url):
        """URLからリソースカテゴリを判定"""
        ext = os.path.splitext(urlparse(url).path)[1].lower()
        
        if ext in ['.css']:
            return 'css'
        elif ext in ['.js']:
            return 'js'
        elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico']:
            return 'images'
        elif ext in ['.woff', '.woff2', '.ttf', '.otf', '.eot']:
            return 'fonts'
        else:
            return 'other'
    
    def url_to_local_path(self, url):
        """URLをローカルパスに変換"""
        parsed = urlparse(url)
        
        # 同じドメインの場合
        if parsed.netloc == self.domain:
            path = parsed.path.lstrip('/')
            if parsed.query:
                # クエリパラメータをファイル名に含める
                base, ext = os.path.splitext(path)
                path = f"{base}_{parsed.query}{ext}"
            return path
        
        # 外部ドメインの場合
        else:
            domain_dir = parsed.netloc.replace(':', '_')
            path = parsed.path.lstrip('/')
            if parsed.query:
                base, ext = os.path.splitext(path)
                path = f"{base}_{parsed.query}{ext}"
            return os.path.join('external', domain_dir, path)
    
    def convert_paths(self, html_content):
        """HTMLパスを相対パスに変換"""
        # 自ドメインのURLを相対パスに
        patterns = [
            (f'https://{self.domain}/', './'),
            (f'http://{self.domain}/', './'),
            (f'//{self.domain}/', './')
        ]
        
        for pattern, replacement in patterns:
            html_content = html_content.replace(pattern, replacement)
        
        # 絶対パスを相対パスに
        html_content = re.sub(r'(href|src|data-src)="/([^"]+)"', r'\1="./\2"', html_content)
        html_content = re.sub(r"(href|src|data-src)='/([^']+)'", r"\1='./\2'", html_content)
        
        # クエリパラメータ付きファイル名の修正
        def fix_query_params(match):
            attr = match.group(1)
            path = match.group(2)
            ext = match.group(3)
            query = match.group(4)
            
            if path.startswith('./'):
                return f'{attr}="{path}_{query}{ext}"'
            return match.group(0)
        
        # CSS/JSファイルのクエリパラメータを修正
        html_content = re.sub(
            r'(href|src)="([^"]+)(\.(?:css|js))\?([^"]+)"',
            fix_query_params,
            html_content
        )
        
        return html_content
    
    def fix_missing_resources(self):
        """失敗したリソースにプレースホルダーを作成"""
        if not self.failed:
            return
        
        # 透明な1x1画像
        transparent_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\xdac\xf8\x0f\x00\x00\x01\x01\x00\x05\x00\x00\x00\x00IEND\xaeB`\x82'
        
        for url, error in self.failed:
            local_path = self.url_to_local_path(url)
            full_path = os.path.join(self.output_dir, local_path)
            
            # 画像の場合はプレースホルダーを作成
            if self.get_resource_category(url) == 'images':
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, 'wb') as f:
                    f.write(transparent_png)
        
        # 失敗リストを保存
        with open(os.path.join(self.output_dir, 'failed_downloads.txt'), 'w') as f:
            for url, error in self.failed:
                f.write(f"{url} - {error}\n")
    
    def staticize_content(self, html_content):
        """動的コンテンツを静的化"""
        # Google Tag Manager等を無効化
        html_content = re.sub(
            r'<!-- Google Tag Manager -->.*?<!-- End Google Tag Manager -->',
            '<!-- Analytics disabled for offline use -->',
            html_content,
            flags=re.DOTALL
        )
        
        # Font Awesome Kitを無効化
        html_content = re.sub(
            r'<script src="https://kit\.fontawesome\.com/[^"]+"></script>',
            '<!-- Font Awesome Kit disabled for offline use -->',
            html_content
        )
        
        return html_content
    
    def save_html(self, html_content):
        """最終的なHTMLを保存"""
        output_file = os.path.join(self.output_dir, 'index.html')
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"✅ Saved to {output_file}")
    
    def show_results(self):
        """結果を表示"""
        print("\n" + "=" * 60)
        print("📊 REPLICATION RESULTS")
        print("=" * 60)
        
        print(f"\n✅ Successfully replicated: {self.url}")
        print(f"📁 Output directory: {self.output_dir}")
        print(f"📦 Total size: {self.stats['total_size'] / 1024 / 1024:.2f} MB")
        
        print("\n📈 File statistics:")
        for category, count in self.stats.items():
            if category != 'total_size' and count > 0:
                print(f"   - {category}: {count} files")
        
        if self.failed:
            print(f"\n⚠️  Failed downloads: {len(self.failed)}")
            print("   (See failed_downloads.txt for details)")
    
    def create_helper_files(self):
        """ヘルパーファイルを作成"""
        # README
        readme_content = f"""# Website Replica - {self.domain}

Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Original URL: {self.url}

## 📁 Contents

- `index.html` - Main entry point
- `resources.json` - List of all resources
- `failed_downloads.txt` - Failed downloads (if any)

## 🚀 Usage

1. **Direct Access**: Open `index.html` in your browser
2. **Local Server** (recommended):
   ```bash
   python3 -m http.server 8000
   # Open http://localhost:8000 in your browser
   ```

## 📊 Statistics

- Total files: {len(self.downloaded)}
- Total size: {self.stats['total_size'] / 1024 / 1024:.2f} MB
- Failed downloads: {len(self.failed)}

## ⚠️ Notes

- Some dynamic features may not work offline
- External resources (CDN) require internet connection
- JavaScript functionality may be limited when opened directly
"""
        
        with open(os.path.join(self.output_dir, 'README.md'), 'w') as f:
            f.write(readme_content)
        
        # サーバー起動スクリプト
        server_script = '''#!/usr/bin/env python3
import http.server
import socketserver
import os

PORT = 8000

os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Server running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()
'''
        
        server_file = os.path.join(self.output_dir, 'start_server.py')
        with open(server_file, 'w') as f:
            f.write(server_script)
        os.chmod(server_file, 0o755)


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(
        description='Website Replicator - Create offline copies of websites',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python3 website_replicator.py https://example.com
  python3 website_replicator.py https://example.com -o my_replica
  python3 website_replicator.py https://example.com --include-external
        '''
    )
    
    parser.add_argument('url', help='URL of the website to replicate')
    parser.add_argument('-o', '--output', help='Output directory name')
    parser.add_argument('--include-external', action='store_true', 
                        help='Include external resources (CDN, etc.)')
    
    args = parser.parse_args()
    
    # レプリケーターを実行
    replicator = WebsiteReplicator(args.url, args.output)
    success = replicator.replicate()
    
    if success:
        print(f"\n✨ Success! Your replica is ready in: {replicator.output_dir}")
        print(f"🌐 To view: open {os.path.join(replicator.output_dir, 'index.html')}")
    else:
        print("\n❌ Replication failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()