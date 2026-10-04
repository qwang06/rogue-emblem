import { useEffect, type ComponentType } from 'react';
import { gameCommands } from '../bridge/commands.ts';
import { gameStore } from '../bridge/gameStore.ts';
import { ConfigsPage } from './ConfigsPage.tsx';
import { DialogConfigPage } from './DialogConfigPage.tsx';
import { DungeonConfigPage } from './DungeonConfigPage.tsx';
import type { Route } from './route.ts';

// Each config that has its own editing page, by catalog id (see
// configCatalog.ts). The index links to these; the rest are still to come.
export const CONFIG_PAGES: Readonly<Record<string, ComponentType>> = Object.freeze({
  dialogs: DialogConfigPage,
  'dungeon-floors': DungeonConfigPage,
});

// The config editor, shown on the #/configs routes in place of the title
// screen: the index, or one config's page (the index for an unknown id).
export function ConfigEditor({ route }: { route: Route }) {
  // A battle left running underneath would keep taking keyboard input, so
  // opening the editor ends it, as the Main Menu button does.
  useEffect(() => {
    if (gameStore.getState().screen === 'battle') gameCommands.send({ type: 'main-menu' });
  }, []);

  const Page = route.page === 'config' ? CONFIG_PAGES[route.id] : undefined;
  return Page ? <Page /> : <ConfigsPage editable={Object.keys(CONFIG_PAGES)} />;
}
