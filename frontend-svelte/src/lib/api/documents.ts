// ドキュメント管理APIとの通信モジュール

import { API_BASE_URL } from '$lib/config/constants';

export interface Document {
	filename: string;
	tags: string[];
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
	const response = await fetch(`${API_BASE_URL}/documents/details`);
	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}
	const data = await response.json();
	return data.documents || [];
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
	formData.append('files', file);
	if (tags.length > 0) {
		formData.append('tags', tags.join(','));
	}

	const response = await fetch(`${API_BASE_URL}/upload`, {
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
export async function deleteDocument(filename: string): Promise<{ message: string }> {
	const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`, {
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
	const response = await fetch(`${API_BASE_URL}/documents`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		throw new Error(`API Error: ${response.status} ${response.statusText}`);
	}
	return response.json();
}
