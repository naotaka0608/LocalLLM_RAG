// キャラクター設定のユーティリティ関数

export const characterNames: Record<string, string> = {
	none: '',
	samurai: '侍',
	gal: 'ギャル',
	kansai: '関西人',
	cat: '猫',
	moe: '萌えキャラ'
};

/**
 * キャラクター設定からアシスタント表示名を取得
 */
export function getAssistantDisplayName(characterPreset?: string): string {
	if (!characterPreset || characterPreset === 'none') {
		return 'アシスタント';
	}
	const characterName = characterNames[characterPreset] || '';
	return characterName ? `アシスタント（${characterName}）` : 'アシスタント';
}
