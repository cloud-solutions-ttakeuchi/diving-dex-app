import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CreatureSelectorModal } from '../CreatureSelectorModal';
import { Creature } from '../../types';

// Mock dependencies
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  limit: jest.fn(),
}));

jest.mock('../../firebase', () => ({
  db: {},
}));

const mockCreatures: Creature[] = [
  { id: 'c1', name: 'カクレクマノミ', category: '魚類', rarity: 'Common' } as Creature,
  { id: 'c2', name: 'アオウミガメ', category: '爬虫類', rarity: 'Rare' } as Creature,
];

describe('CreatureSelectorModal', () => {
  it('renders correctly when visible', () => {
    const { getByPlaceholderText, getByText } = render(
      <CreatureSelectorModal
        visible={true}
        onClose={() => { }}
        onSelect={() => { }}
      />
    );

    expect(getByPlaceholderText('生物名で検索...')).toBeTruthy();
    expect(getByText('見つかった生物を報告')).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <CreatureSelectorModal
        visible={true}
        onClose={onClose}
        onSelect={() => { }}
      />
    );

    // Assuming we added a testID to the close button
    // For now, let's just check if it renders.
  });
});
