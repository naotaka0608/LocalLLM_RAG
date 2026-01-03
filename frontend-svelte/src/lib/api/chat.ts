// FastAPI APIとの通信モジュール

const API_BASE_URL = 'http://localhost:8000';

export interface SourceInfo {
	source: string;
	score: number;
}

export interface Message {
	role: 'user' | 'assistant';
	content: string;
	sources?: SourceInfo[];
	qualityScore?: number;
	responseTime?: number; // 応答時間（秒）
	generationTime?: number; // 生成時間（秒）
	speed?: number; // 生成速度（文字/秒）
	characterPreset?: string; // メッセージ送信時のキャラクター設定
}

export interface QueryRequest {
	question: string;
	stream?: boolean;
	model?: string;
	use_rag?: boolean;
	query_expansion?: boolean;
	use_hybrid_search?: boolean;
	chat_history?: Message[];
	system_prompt?: string;
	tags?: string[];
	temperature?: number;
	document_count?: number;
	search_multiplier?: number;
	top_p?: number;
	repeat_penalty?: number;
	num_predict?: number;
}

/**
 * ストリーミング形式で質問をAPIに送信
 */
export async function sendQuestionStream(
	question: string,
	options: Partial<QueryRequest> = {},
	signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
	const requestBody: QueryRequest = {
		question,
		stream: true,
		use_rag: true,
		use_hybrid_search: true,
		...options
	};

	const response = await fetch(`${API_BASE_URL}/query/stream`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requestBody),
		signal
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}

	if (!response.body) {
		throw new Error('Response body is null');
	}

	return response.body;
}

/**
 * ストリーミングレスポンスを処理
 * @param stream ReadableStream
 * @param onChunk 各チャンクを受信したときのコールバック
 * @param onSources ソース情報を受信したときのコールバック
 * @param onComplete 完了時のコールバック
 * @param onSpeed 速度情報更新時のコールバック
 */
export async function processStream(
	stream: ReadableStream<Uint8Array>,
	onChunk: (chunk: string) => void,
	onComplete?: () => void,
	onSources?: (sources: SourceInfo[], qualityScore: number) => void,
	onSpeed?: (responseTime: number, generationTime: number, speed: number) => void
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();

	const requestStartTime = Date.now();
	let firstChunkTime: number | null = null;
	let charCount = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				// 最終速度を計算
				if (firstChunkTime && charCount > 0) {
					const responseTime = (firstChunkTime - requestStartTime) / 1000;
					const generationTime = (Date.now() - firstChunkTime) / 1000;
					const speed = charCount / generationTime;
					onSpeed?.(responseTime, generationTime, speed);
				}
				onComplete?.();
				break;
			}

			const chunk = decoder.decode(value, { stream: true });
			const lines = chunk.split('\n');

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const data = line.slice(6); // "data: " を削除
					if (data.trim()) {
						// ソース情報のマーカーをチェック
						if (data.includes('__SOURCES__')) {
							// ソース情報をパース
							try {
								// 新しい形式: __SOURCES__:{json}
								const sourcesMatch = data.match(/__SOURCES__:(.*)/);
								if (sourcesMatch) {
									const sourcesJson = sourcesMatch[1];
									const sourceData = JSON.parse(sourcesJson);

									// source_scoresをSourceInfo配列に変換
									const sources: SourceInfo[] = sourceData.source_scores || [];
									const qualityScore = sourceData.quality_score || 0;

									onSources?.(sources, qualityScore);
								}
							} catch (error) {
								console.error('Failed to parse sources:', error);
							}
						} else {
							// 最初のチャンクの時刻を記録
							if (!firstChunkTime && data.length > 0) {
								firstChunkTime = Date.now();
							}

							// 文字数をカウント
							if (data.length > 0) {
								charCount += data.length;
							}

							onChunk(data);

							// 速度情報を更新（リアルタイム）
							if (firstChunkTime && charCount > 0) {
								const responseTime = (firstChunkTime - requestStartTime) / 1000;
								const generationTime = (Date.now() - firstChunkTime) / 1000;
								const speed = charCount / generationTime;
								onSpeed?.(responseTime, generationTime, speed);
							}
						}
					}
				}
			}
		}
	} catch (error) {
		console.error('Stream processing error:', error);
		throw error;
	} finally {
		reader.releaseLock();
	}
}

/**
 * 非ストリーミング形式で質問をAPIに送信（将来用）
 */
export async function sendQuestion(
	question: string,
	options: Partial<QueryRequest> = {}
): Promise<{ answer: string; sources: string[] }> {
	const requestBody: QueryRequest = {
		question,
		stream: false,
		use_rag: true,
		...options
	};

	const response = await fetch(`${API_BASE_URL}/query`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}

	return response.json();
}
