// ドキュメント管理APIとの通信モジュール

const API_BASE_URL = 'http://localhost:8000';

export interface Document {
	id: string;
	content: string;
	metadata: {
		source?: string;
		tags?: string[];
		timestamp?: string;
		[key: string]: any;
	};
}

export interface DocumentStats {
	total_documents: number;
	total_chunks: number;
	tags: string[];
}

/**
 * ドキュメント統計を取得
 */
export async function getDocumentStats(): Promise<DocumentStats> {
	const response = await fetch(`${API_BASE_URL}/documents/stats`);
	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

/**
 * ドキュメント一覧を取得
 */
export async function getDocuments(
	limit: number = 100,
	offset: number = 0,
	tags?: string[]
): Promise<Document[]> {
	const params = new URLSearchParams({
		limit: limit.toString(),
		offset: offset.toString()
	});

	if (tags && tags.length > 0) {
		tags.forEach((tag) => params.append('tags', tag));
	}

	const response = await fetch(`${API_BASE_URL}/documents?${params}`);
	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

/**
 * ドキュメントを追加
 */
export async function addDocument(
	content: string,
	metadata: Record<string, any> = {}
): Promise<{ message: string; document_id: string }> {
	const response = await fetch(`${API_BASE_URL}/documents/add`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ content, metadata })
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

/**
 * ファイルをアップロード
 */
export async function uploadFile(
	file: File,
	tags: string[] = []
): Promise<{ message: string; chunks_created: number }> {
	const formData = new FormData();
	formData.append('file', file);
	if (tags.length > 0) {
		formData.append('tags', JSON.stringify(tags));
	}

	const response = await fetch(`${API_BASE_URL}/documents/upload`, {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `API Error: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

/**
 * ドキュメントを削除
 */
export async function deleteDocument(documentId: string): Promise<{ message: string }> {
	const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

/**
 * タグでドキュメントを検索
 */
export async function searchByTags(tags: string[]): Promise<Document[]> {
	const params = new URLSearchParams();
	tags.forEach((tag) => params.append('tags', tag));

	const response = await fetch(`${API_BASE_URL}/documents/search/tags?${params}`);
	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

/**
 * データベースをクリア（開発用）
 */
export async function clearDatabase(): Promise<{ message: string }> {
	const response = await fetch(`${API_BASE_URL}/documents/clear`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}
	return response.json();
}
