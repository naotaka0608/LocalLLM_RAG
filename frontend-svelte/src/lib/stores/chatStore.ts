import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { Message } from '$lib/api/chat';

export interface Chat {
	id: string;
	title: string;
	messages: Message[];
	createdAt: number;
	updatedAt: number;
}

interface ChatState {
	chats: Chat[];
	currentChatId: string | null;
}

// LocalStorageのキー
const STORAGE_KEY = 'chatHistory';

// 初期状態をLocalStorageから読み込む
function loadInitialState(): ChatState {
	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				return JSON.parse(stored);
			}
		} catch (error) {
			console.error('Failed to load chat history:', error);
		}
	}
	return {
		chats: [],
		currentChatId: null
	};
}

// チャット履歴のStore
function createChatStore() {
	const { subscribe, set, update } = writable<ChatState>(loadInitialState());

	// LocalStorageに保存
	function saveToStorage(state: ChatState) {
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			} catch (error) {
				console.error('Failed to save chat history:', error);
			}
		}
	}

	return {
		subscribe,

		// 新しいチャットを作成
		createNewChat: () => {
			update((state) => {
				const newChat: Chat = {
					id: `chat_${Date.now()}`,
					title: '新しいチャット',
					messages: [],
					createdAt: Date.now(),
					updatedAt: Date.now()
				};

				const newState = {
					chats: [newChat, ...state.chats],
					currentChatId: newChat.id
				};

				saveToStorage(newState);
				return newState;
			});
		},

		// チャットを選択
		selectChat: (chatId: string) => {
			update((state) => {
				const newState = { ...state, currentChatId: chatId };
				saveToStorage(newState);
				return newState;
			});
		},

		// メッセージを追加
		addMessage: (chatId: string, message: Message) => {
			update((state) => {
				const chats = state.chats.map((chat) => {
					if (chat.id === chatId) {
						const updatedChat = {
							...chat,
							messages: [...chat.messages, message],
							updatedAt: Date.now()
						};

						// タイトルが「新しいチャット」の場合、最初のユーザーメッセージをタイトルにする
						if (
							updatedChat.title === '新しいチャット' &&
							message.role === 'user' &&
							updatedChat.messages.length === 1
						) {
							updatedChat.title =
								message.content.length > 30
									? message.content.substring(0, 30) + '...'
									: message.content;
						}

						return updatedChat;
					}
					return chat;
				});

				const newState = { ...state, chats };
				saveToStorage(newState);
				return newState;
			});
		},

		// 最後のメッセージを更新（ストリーミング用）
		updateLastMessage: (chatId: string, content: string) => {
			update((state) => {
				const chats = state.chats.map((chat) => {
					if (chat.id === chatId) {
						const messages = [...chat.messages];
						if (messages.length > 0) {
							messages[messages.length - 1] = {
								...messages[messages.length - 1],
								content
							};
						}
						return {
							...chat,
							messages,
							updatedAt: Date.now()
						};
					}
					return chat;
				});

				const newState = { ...state, chats };
				saveToStorage(newState);
				return newState;
			});
		},

		// 最後のメッセージにソース情報を追加
		updateLastMessageSources: (
			chatId: string,
			sources: import('$lib/api/chat').SourceInfo[],
			qualityScore: number
		) => {
			update((state) => {
				const chats = state.chats.map((chat) => {
					if (chat.id === chatId) {
						const messages = [...chat.messages];
						if (messages.length > 0) {
							messages[messages.length - 1] = {
								...messages[messages.length - 1],
								sources,
								qualityScore
							};
						}
						return {
							...chat,
							messages,
							updatedAt: Date.now()
						};
					}
					return chat;
				});

				const newState = { ...state, chats };
				saveToStorage(newState);
				return newState;
			});
		},

		// 最後のメッセージに速度情報を追加
		updateLastMessageSpeed: (
			chatId: string,
			responseTime: number,
			generationTime: number,
			speed: number
		) => {
			update((state) => {
				const chats = state.chats.map((chat) => {
					if (chat.id === chatId) {
						const messages = [...chat.messages];
						if (messages.length > 0) {
							messages[messages.length - 1] = {
								...messages[messages.length - 1],
								responseTime,
								generationTime,
								speed
							};
						}
						return {
							...chat,
							messages,
							updatedAt: Date.now()
						};
					}
					return chat;
				});

				const newState = { ...state, chats };
				saveToStorage(newState);
				return newState;
			});
		},

		// チャットのタイトルを変更
		renameChat: (chatId: string, newTitle: string) => {
			update((state) => {
				const chats = state.chats.map((chat) => {
					if (chat.id === chatId) {
						return {
							...chat,
							title: newTitle,
							updatedAt: Date.now()
						};
					}
					return chat;
				});

				const newState = { ...state, chats };
				saveToStorage(newState);
				return newState;
			});
		},

		// チャットを削除
		deleteChat: (chatId: string) => {
			update((state) => {
				const chats = state.chats.filter((chat) => chat.id !== chatId);
				let currentChatId = state.currentChatId;

				// 削除したチャットが選択中だった場合
				if (currentChatId === chatId) {
					currentChatId = chats.length > 0 ? chats[0].id : null;
				}

				const newState = { chats, currentChatId };
				saveToStorage(newState);
				return newState;
			});
		},

		// すべてのチャットをクリア
		clearAll: () => {
			const newState = {
				chats: [],
				currentChatId: null
			};
			saveToStorage(newState);
			set(newState);
		}
	};
}

export const chatStore = createChatStore();

// 現在選択中のチャットを取得する派生Store
export const currentChat = derived(chatStore, ($chatStore) => {
	if (!$chatStore.currentChatId) return null;
	return $chatStore.chats.find((chat) => chat.id === $chatStore.currentChatId) || null;
});
