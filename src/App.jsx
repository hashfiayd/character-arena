import { useState } from 'react';
import { useRoster } from './hooks/useRoster.js';
import { CharacterForge } from './features/spinwheel/CharacterForge.jsx';
import { RosterPanel } from './features/roster/RosterPanel.jsx';
import { BattleScreen } from './features/arena/BattleScreen.jsx';

const TABS = [
  { id: 'forge', label: 'Forge' },
  { id: 'roster', label: 'Roster' },
  { id: 'arena', label: 'Arena' },
];

export default function App() {
  const [tab, setTab] = useState('forge');
  const roster = useRoster();

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">Character Arena</h1>
          <p className="app__subtitle">
            Putar roda untuk merakit karakter, lalu adu mereka sebagai bola
            berfisika di arena.
          </p>
        </div>

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="tabs__item"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'forge' && (
        <CharacterForge
          onSave={(character) => {
            roster.addCharacter(character);
            setTab('roster');
          }}
        />
      )}

      {tab === 'roster' && (
        <RosterPanel
          roster={roster}
          onAdd={roster.addCharacter}
          onRemove={roster.removeCharacter}
          onRename={roster.renameCharacter}
          onClear={roster.clearAll}
        />
      )}

      {tab === 'arena' && (
        <BattleScreen roster={roster} onRecordResult={roster.recordBattle} />
      )}
    </div>
  );
}
