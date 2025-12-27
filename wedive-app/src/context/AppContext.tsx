import React, { createContext, useContext, useMemo } from 'react';
// import { Point, Creature, PointCreature } from '../types';
// フックの呼び出しを削除

// AppContextは非推奨となります。各コンポーネントで usePoints, useCreatures などを使用してください。
// 互換性のために型定義は残しますが、データは常に空になります。
type AppContextType = {
  // points: Point[];
  // creatures: Creature[];
  // pointCreatures: PointCreature[];
  // isLoading: boolean;
  // error: Error | null;
  [key: string]: any; // 一時的な逃げ道
};

const AppContext = createContext<AppContextType>({}); // 空のオブジェクト

export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ここでのデータ取得は廃止
  // コンポーネントが必要な時に必要なデータを取得する TanStack Query の思想に準拠

  return (
    <AppContext.Provider value={{}}>
      {children}
    </AppContext.Provider>
  );
};
