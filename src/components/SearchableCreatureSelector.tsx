import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronDown, Search, Fish } from 'lucide-react';
import clsx from 'clsx';

interface SearchableCreatureSelectorProps {
  value: string;
  onChange: (creatureId: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
}

export const SearchableCreatureSelector: React.FC<SearchableCreatureSelectorProps> = ({
  value,
  onChange,
  className,
  label = "TARGET CREATURE (OPTIONAL)",
  placeholder = "生物名、和名、学名で検索..."
}) => {
  const { creatures } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCreatures = useMemo(() => {
    if (!searchTerm) return creatures;
    const s = searchTerm.toLowerCase();
    return creatures.filter(c =>
      c.name.toLowerCase().includes(s) ||
      c.scientificName?.toLowerCase().includes(s) ||
      c.category?.toLowerCase().includes(s)
    );
  }, [creatures, searchTerm]);

  const selectedCreature = useMemo(() =>
    creatures.find(c => c.id === value),
    [creatures, value]
  );

  return (
    <div className={clsx("bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100 space-y-4", className)}>
      <div className="flex items-center justify-between px-1">
        <label className="block text-[10px] font-black text-indigo-400 tracking-widest uppercase">
          {label}
        </label>
        <span className="text-[10px] font-black text-indigo-500 tracking-widest uppercase">
          {filteredCreatures.length} hits
        </span>
      </div>

      <div className="space-y-3">
        {/* Search Box */}
        <div className="relative group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 group-hover:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-indigo-100 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all placeholder:text-indigo-200"
          />
        </div>

        {/* Selected / Dropdown Result */}
        <div className="relative group">
          <Fish size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-white border border-indigo-100 rounded-2xl text-sm font-bold text-gray-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all appearance-none cursor-pointer"
          >
            <option value="">生物を選択してください</option>
            {filteredCreatures.slice(0, 100).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.scientificName ? `(${c.scientificName})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none transition-transform group-hover:text-indigo-500" />
        </div>
      </div>

      {selectedCreature && (
        <div className="px-1 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-indigo-100 shrink-0">
            <img
              src={selectedCreature.imageUrl || '/images/no-image-creature.png'}
              className="w-full h-full object-cover"
              alt={selectedCreature.name}
            />
          </div>
          <div>
            <p className="text-xs font-black text-gray-700">{selectedCreature.name}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{selectedCreature.category}</p>
          </div>
        </div>
      )}

      {!value && !searchTerm && (
        <p className="text-[10px] text-indigo-300 font-bold px-1 italic">
          ※ 名前やキーワードで生物を検索できます
        </p>
      )}
    </div>
  );
};
