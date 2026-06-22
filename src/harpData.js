// 🎯 [이미지 악보와 주파수 세미톤 100% 동기화 마스터 테이블]
export const HARP_LAYOUT = {
  holes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  topBb: [null, null, null, null, null, null, null, null, null, 46],
  overBlow: [15, 20, 24, 27, 30, 34, null, 40, 42, 47],
  blow: [0, 4, 7, 12, 16, 19, 24, 28, 31, 36],
  draw: [2, 7, 11, 14, 17, 21, 23, 26, 29, 33],
  bends1: [1, 6, 10, 13, null, 20, 25, 27, 30, 32],
  bends2: [null, 5, 9, null, null, null, null, null, null, null],
  bends3: [null, null, 8, null, null, null, null, null, null, null]
};

export const standardKeys = {
  'G': { semi: 7, oct: 3 }, 'Ab': { semi: 8, oct: 3 }, 'A': { semi: 9, oct: 3 },
  'Bb': { semi: 10, oct: 3 }, 'B': { semi: 11, oct: 3 }, 'C': { semi: 0, oct: 4 },
  'Db': { semi: 1, oct: 4 }, 'D': { semi: 2, oct: 4 }, 'Eb': { semi: 3, oct: 4 },
  'E': { semi: 4, oct: 4 }, 'F': { semi: 5, oct: 4 }, 'Gb': { semi: 6, oct: 4 }, 'High G': { semi: 7, oct: 4 }
};

export const lowKeys = {
  'LF': { semi: 5, oct: 3 }, 'LE': { semi: 4, oct: 3 }, 'LEb': { semi: 3, oct: 3 },
  'LD': { semi: 2, oct: 3 }, 'LDb': { semi: 1, oct: 3 }, 'LC': { semi: 0, oct: 3 },
  'LB': { semi: 11, oct: 2 }, 'LBb': { semi: 10, oct: 2 }, 'LA': { semi: 9, oct: 2 },
  'LAb': { semi: 8, oct: 2 }, 'LG': { semi: 7, oct: 2 }, 'LGb': { semi: 6, oct: 2 }, 'LLF': { semi: 5, oct: 2 }
};
