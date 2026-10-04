import { ConfigLayout } from './ConfigLayout.tsx';
import { getConfigCatalog } from './configCatalog.ts';
import { routeHash } from './route.ts';

const CATALOG = getConfigCatalog();

// The config editor's index (#/configs): every piece of tunable game data,
// grouped, with where it lives and what's in it now. Configs in `editable`
// have a page and their cards link to it; the rest are marked as coming.
export function ConfigsPage({ editable }: { editable: readonly string[] }) {
  return (
    <ConfigLayout
      title="Game Configs"
      lede="Everything that can be tuned: dialog, maps, units, equipment and rules."
      back={{ href: routeHash({ page: 'game' }), label: 'Back to Game' }}
    >
      {CATALOG.map((group) => (
        <section key={group.id} className="configs-group" aria-labelledby={`configs-group-${group.id}`}>
          <h2 id={`configs-group-${group.id}`} className="configs-group__title">
            {group.title}
          </h2>
          <ul className="configs-group__list">
            {group.entries.map((entry) => {
              const hasPage = editable.includes(entry.id);
              return (
                <li key={entry.id} className={hasPage ? 'config-card config-card--link' : 'config-card'}>
                  <div className="config-card__head">
                    <h3 className="config-card__title">
                      {hasPage ? <a href={routeHash({ page: 'config', id: entry.id })}>{entry.title}</a> : entry.title}
                    </h3>
                    <span className={hasPage ? 'config-card__badge config-card__badge--ready' : 'config-card__badge'}>
                      {hasPage ? 'Editable' : 'Coming soon'}
                    </span>
                  </div>
                  <p className="config-card__description">{entry.description}</p>
                  <p className="config-card__summary">{entry.summary}</p>
                  <ul className="config-card__sources" aria-label="Source files">
                    {entry.sources.map((source) => (
                      <li key={source}>
                        <code>{source}</code>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </ConfigLayout>
  );
}
