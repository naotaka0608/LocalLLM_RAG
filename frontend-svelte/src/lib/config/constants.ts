// アプリケーション全体で使用する定数

export const API_BASE_URL = 'http://localhost:8000';

export const ERROR_MESSAGES = {
	SERVER_NOT_RUNNING:
		'FastAPIサーバーが起動しているか確認してください（http://localhost:8000）',
	GENERATION_STOPPED: '[生成が停止されました]',
	DELETE_FAILED: '削除に失敗しました',
	CLEAR_FAILED: 'データベースのクリアに失敗しました',
	UNKNOWN_ERROR: '不明なエラー'
} as const;

export const SUPPORTED_FILE_TYPES = {
	EXTENSIONS: ['.pdf', '.txt', '.md', '.csv'],
	ACCEPT: '.txt,.md,.pdf'
} as const;
