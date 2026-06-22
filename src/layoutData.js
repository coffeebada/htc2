export const standardKeys = {
  'G': { semi: 7, oct: 3 }, 'Ab': { semi: 8, oct: 3 }, 'A': { semi: 9, oct: 3 },
  'Bb': { semi: 10, oct: 3 }, 'B': { semi: 11, oct: 3 }, 'C': { semi: 0, oct: 4 },
  'Db': { semi: 1, oct: 4 }, 'D': { semi: 2, oct: 4 }, 'Eb': { semi: 3, oct: 4 },
  'E': { semi: 4, oct: 4 }, 'F': { semi: 5, oct: 4 }, 'Gb': { semi: 6, oct: 4 },
  'High G': { semi: 7, oct: 4 }
};

export const lowKeys = {
  'LF': { semi: 5, oct: 3 }, 'LE': { semi: 4, oct: 3 }, 'LEb': { semi: 3, oct: 3 },
  'LD': { semi: 2, oct: 3 }, 'LDb': { semi: 1, oct: 3 }, 'LC': { semi: 0, oct: 3 },
  'LB': { semi: 11, oct: 2 }, 'LBb': { semi: 10, oct: 2 }, 'LA': { semi: 9, oct: 2 },
  'LAb': { semi: 8, oct: 2 }, 'LG': { semi: 7, oct: 2 }, 'LGb': { semi: 6, oct: 2 },
  'LLF': { semi: 5, oct: 2 }
};

export const layoutData = {
  holes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  // 8번(E6=28), 9번(G6=31), 10번(C7=36) 정밀 반영
  blow: [0, 4, 7, 12, 16, 19, 24, 28, 31, 36],
  // 6번(A5=21), 7번(B5=23), 8번(D6=26), 9번(F6=29), 10번(A6=33) 정밀 반영
  draw: [2, 7, 11, 14, 17, 21, 23, 26, 29, 33],
  // 7번(Db6=25), 8번(F6=29), 9번(Ab6=32), 10번(Db7=37) 커스텀 오버로우 배치
  overBlow: [3, 8, 12, 15, 18, 22, 25, 29, 32, 37],
  bends: [
    [-1],           // 1번홀: Db4
    [-1, -2],       // 2번홀: Gb4, F4
    [-1, -2, -3],   // 3번홀: Bb4, A4, Ab4
    [-1],           // 4번홀: Db5
    [],             // 5번홀: 공란
    [-1],           // 6번홀: 마시는음(A5)에서 반음 다운하여 Ab5 매핑
    [],             // 7번홀: 공란
    [-1],           // 8번홀: 부는음(E6)에서 반음 다운하여 Eb6 매핑
    [-1],           // 9번홀: 부는음(G6)에서 반음 다운하여 Gb6 매핑
    [-1, -2]        // 10번홀: 부는음(C7)에서 반음 다운하여 B6, 온음 다운하여 Bb6 매핑
  ]
};

export const topSpecialSemi = 46;
