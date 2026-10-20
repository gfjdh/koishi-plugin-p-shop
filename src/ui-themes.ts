export type UiTheme = 'classic' | 'p3' | 'p4' | 'p5'
export type ModernTheme = Exclude<UiTheme, 'classic'>

export const THEME_LABELS: Record<UiTheme, string> = {
  classic: '经典木纹', p3: 'P3 蓝色', p4: 'P4 黄黑', p5: 'P5 品红',
}

// 主题是免费的用户偏好，不对应任何道具、价格或使用效果。
export function parseUiTheme(value: unknown): UiTheme | null {
  const aliases: Record<string, UiTheme> = {
    classic: 'classic', '经典': 'classic', '经典版': 'classic', '经典木纹': 'classic', '原版': 'classic',
    p3: 'p3', '蓝': 'p3', '蓝色': 'p3', 'p3蓝色': 'p3',
    p4: 'p4', '黄': 'p4', '黄色': 'p4', '黄黑': 'p4', 'p4黄黑': 'p4',
    p5: 'p5', '品红': 'p5', '品红色': 'p5', 'p5品红': 'p5',
  }
  return aliases[String(value ?? '').trim().toLowerCase().replace(/\s+/g, '')] || null
}

export interface UiPalette {
  bg: string; text: string; muted: string; accent: string; value: string; line: string
  panel: string; onPanel: string; title: string; heroMuted: string
  band: string; bandText: string; category: string; categoryText: string
  selected: string; selectedText: string; selectedValue: string
}

const palettes: Record<ModernTheme, Record<'shop' | 'inventory', UiPalette>> = {
  p3: {
    shop: {
      bg: '#0b2056', text: '#f3f6fd', muted: '#a4b9df', accent: '#66dceb', value: '#66dceb', line: '#354d7c',
      panel: '#071735', onPanel: '#f3f6fd', title: '#f3f6fd', heroMuted: '#a4b9df',
      band: '#1546b9', bandText: '#f3f6fd', category: '#f3f6fd', categoryText: '#102b64',
      selected: '#1d4bb3', selectedText: '#f3f6fd', selectedValue: '#f3f6fd',
    },
    inventory: {
      bg: '#0737b9', text: '#f5f8ff', muted: '#a9c9ff', accent: '#00d9ed', value: '#00d9ed', line: '#3b75c8',
      panel: '#081f68', onPanel: '#f5f8ff', title: '#f5f8ff', heroMuted: '#a9c9ff',
      band: '#081f68', bandText: '#f5f8ff', category: '#f5f8ff', categoryText: '#081f68',
      selected: '#f5f8ff', selectedText: '#081f68', selectedValue: '#0344cc',
    },
  },
  p4: {
    shop: {
      bg: '#242421', text: '#fff9e8', muted: '#c6c3b2', accent: '#f4d348', value: '#f4d348', line: '#505044',
      panel: '#171815', onPanel: '#fff9e8', title: '#22231f', heroMuted: '#c6c3b2',
      band: '#f2cd2c', bandText: '#22231f', category: '#f2cd2c', categoryText: '#22231f',
      selected: '#f2cd2c', selectedText: '#22231f', selectedValue: '#22231f',
    },
    inventory: {
      bg: '#f3f0dc', text: '#252621', muted: '#706f5e', accent: '#f3cf29', value: '#705716', line: '#c6c0a5',
      panel: '#22231f', onPanel: '#fff9e8', title: '#22231f', heroMuted: '#d8d3bc',
      band: '#22231f', bandText: '#fff9e8', category: '#f3cf29', categoryText: '#22231f',
      selected: '#22231f', selectedText: '#f5d641', selectedValue: '#f5d641',
    },
  },
  p5: {
    shop: {
      bg: '#202027', text: '#f8f5fa', muted: '#bcb2c4', accent: '#ff4eac', value: '#ff4eac', line: '#50404d',
      panel: '#111116', onPanel: '#f8f5fa', title: '#f8f5fa', heroMuted: '#bcb2c4',
      band: '#d40070', bandText: '#f8f5fa', category: '#f8f5fa', categoryText: '#211d28',
      selected: '#e60078', selectedText: '#fff', selectedValue: '#fff',
    },
    inventory: {
      bg: '#eae8ed', text: '#222129', muted: '#74717d', accent: '#f40083', value: '#d0006b', line: '#c3bec8',
      panel: '#1b1b22', onPanel: '#faf7fa', title: '#faf7fa', heroMuted: '#c0b9c7',
      band: '#1b1b22', bandText: '#faf7fa', category: '#f8f5fa', categoryText: '#211d28',
      selected: '#ed007e', selectedText: '#fff', selectedValue: '#fff',
    },
  },
}

export function uiPalette(theme: ModernTheme, mode: 'shop' | 'inventory'): UiPalette {
  return palettes[theme][mode]
}
