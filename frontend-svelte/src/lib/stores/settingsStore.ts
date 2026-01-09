import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Settings {
	// モデル設定
	model: string;

	// プリセット
	preset: 'balanced' | 'fast' | 'accurate' | 'custom';

	// RAG設定
	use_rag: boolean;
	use_hybrid_search: boolean;
	query_expansion: boolean;

	// LLMパラメータ
	temperature: number;
	top_p: number;
	repeat_penalty: number;
	num_predict: number;

	// 検索パラメータ
	document_count: number;
	search_multiplier: number;

	// 詳細パラメータ（オプション）
	top_k?: number;
	num_ctx?: number;
	seed?: number;
	mirostat?: number;
	mirostat_tau?: number;
	mirostat_eta?: number;

	// システムプロンプト
	character_preset: 'none' | 'samurai' | 'gal' | 'kansai' | 'cat' | 'moe' | 'custom';
	system_prompt: string;

	// タグフィルター
	tags: string[];

	// UI設定
	theme: 'light' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'purple';
	fontSize: number;
}

// プリセット定義
export const presets = {
	balanced: {
		temperature: 0.3,
		top_p: 0.9,
		repeat_penalty: 1.1,
		num_predict: 2048,
		document_count: 10,
		search_multiplier: 10
	},
	fast: {
		temperature: 0.2,
		top_p: 0.8,
		repeat_penalty: 1.2,
		num_predict: 1024,
		document_count: 5,
		search_multiplier: 5
	},
	accurate: {
		temperature: 0.1,
		top_p: 0.95,
		repeat_penalty: 1.15,
		num_predict: 4096,
		document_count: 15,
		search_multiplier: 15
	}
};

// キャラクタープリセット定義（vanilla JSと完全に同一）
export const characterPresets = {
	none: '',
	samurai: "あなたは江戸時代の侍です。古風で格調高い言葉遣いを使い、武士道の精神を重んじて回答してください。「～でござる」「～候」などの表現を使用してください。敬語を用いて、礼儀正しく接してください。",
	gal: "あなたは明るく元気なギャルです。フレンドリーでカジュアルな口調で話してください。「～だよね」「マジで」「ヤバい」「超」などの若者言葉を使い、親しみやすく接してください。たまに「☆」「♪」などの記号も使ってOKです。",
	kansai: "あなたは関西人です。関西弁で親しみやすく話してください。「～やで」「～やん」「めっちゃ」「ほんま」「せやな」などの関西弁を積極的に使用してください。明るくて気さくな雰囲気で回答してください。",
	cat: "あなたは人間の言葉を話せる猫です。「にゃ」「にゃん」「にゃー」などの語尾を使い、猫らしい自由気ままな性格で回答してください。時々気まぐれで、甘えたり、ツンデレな態度を見せたりしてください。",
	moe: "あなたは可愛らしい萌え系キャラクターです。「～です♪」「～ですよ☆」「えへへ」「わぁ！」など、可愛らしい表現を使ってください。明るく元気で、少し天然な性格です。語尾に「♪」「☆」「♡」などの記号を使うこともあります。"
};

// デフォルト設定
const defaultSettings: Settings = {
	model: '',
	preset: 'balanced',
	use_rag: true,
	use_hybrid_search: true,
	query_expansion: false,
	...presets.balanced,
	character_preset: 'none',
	system_prompt: '',
	tags: [],
	theme: 'light',
	fontSize: 16
};

const STORAGE_KEY = 'appSettings';

// LocalStorageから設定を読み込む
function loadSettings(): Settings {
	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				// デフォルト値とマージして、新しい設定項目に対応
				return { ...defaultSettings, ...parsed };
			}
		} catch (error) {
			console.error('Failed to load settings:', error);
		}
	}
	return defaultSettings;
}

// 設定Store
function createSettingsStore() {
	const { subscribe, set, update } = writable<Settings>(loadSettings());

	// LocalStorageに保存
	function saveToStorage(settings: Settings) {
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			} catch (error) {
				console.error('Failed to save settings:', error);
			}
		}
	}

	return {
		subscribe,

		// 設定を更新
		update: (newSettings: Partial<Settings>) => {
			update((current) => {
				const updated = { ...current, ...newSettings };
				saveToStorage(updated);
				return updated;
			});
		},

		// プリセットを適用
		applyPreset: (presetName: 'balanced' | 'fast' | 'accurate') => {
			update((current) => {
				const presetValues = presets[presetName];
				const updated = {
					...current,
					preset: presetName,
					...presetValues
				};
				saveToStorage(updated);
				return updated;
			});
		},

		// キャラクタープリセットを適用
		applyCharacterPreset: (
			presetName: 'none' | 'samurai' | 'gal' | 'kansai' | 'cat' | 'moe'
		) => {
			update((current) => {
				const updated = {
					...current,
					character_preset: presetName,
					system_prompt: characterPresets[presetName]
				};
				saveToStorage(updated);
				return updated;
			});
		},

		// 設定をリセット
		reset: () => {
			saveToStorage(defaultSettings);
			set(defaultSettings);
		},

		// デフォルト設定を取得
		getDefaults: () => defaultSettings
	};
}

export const settingsStore = createSettingsStore();
