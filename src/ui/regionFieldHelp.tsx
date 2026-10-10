// What each Regions setting means, shown in the info popover beside
// its field (see DraftFields.tsx), keyed by the setting's name in the file.

import type { ReactNode } from 'react';
import { REGION_LIMITS } from '../game/warband/regionsFile.ts';

const [MIN_SIZE, MAX_SIZE] = REGION_LIMITS.mapSize;

// A map seen from above with `x` / `y` (fractions, as in an enemy group's
// area) shaded, its edges labeled, and the player's start marked at the
// bottom.
function AreaDiagram({ x = [0, 1], y = [0, 1], caption }: { x?: number[]; y?: number[]; caption: string }) {
  const pct = (n: number) => `${n * 100}%`;
  return (
    <figure className="area-diagram">
      <div className="area-diagram__frame">
        <span className="area-diagram__edge area-diagram__edge--top">0 · north</span>
        <span className="area-diagram__edge area-diagram__edge--bottom">1 · south, where your units start</span>
        <span className="area-diagram__edge area-diagram__edge--left">0 · west</span>
        <span className="area-diagram__edge area-diagram__edge--right">1 · east</span>
        <div className="area-diagram__map">
          <span
            className="area-diagram__box"
            style={{ left: pct(x[0]), width: pct(x[1] - x[0]), top: pct(y[0]), height: pct(y[1] - y[0]) }}
          />
          <span className="area-diagram__start" />
        </div>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

const distanceSteps = (
  <p>
    Steps are counted the way a unit walks from the deployment zone, going around water, mountains and walls, so an
    enemy just across a lake can be many steps away. Each tile is one step, forests included (even though they cost more
    movement).
  </p>
);

const patchSize = (
  <p>
    Each patch is a random size between min and max tiles. Blank uses the default shown. A crowded map may fit smaller
    patches or fewer of them.
  </p>
);

export interface FieldHelp {
  title: string;
  body: ReactNode;
}

const HELP: Record<string, FieldHelp> = {
  stagesPerRegion: {
    title: 'Stages per region',
    body: (
      <p>
        How many stages in a row a Warband Mode run spends in each region before moving on to the next. With 2, stages
        1–2 are in the first region, stages 3–4 the second, and so on. Once the regions run out, the last one repeats
        forever.
      </p>
    ),
  },
  name: {
    title: 'Name',
    body: <p>Shown to the player on the Objective and Victory screens, e.g. &ldquo;Stage 2: Lakeside&rdquo;.</p>,
  },
  description: {
    title: 'Description',
    body: <p>Notes for whoever edits these configs. The game doesn&apos;t show it.</p>,
  },
  width: {
    title: 'Width and height',
    body: (
      <p>
        The map&apos;s size in tiles ({MIN_SIZE}–{MAX_SIZE}). Your units deploy at the middle of the bottom (south)
        edge, and a dirt path winds from there to the top (north) edge.
      </p>
    ),
  },
  palette: {
    title: 'Palette',
    body: <p>The color scheme every building and wall on the map is drawn in.</p>,
  },
  treeChance: {
    title: 'Tree chance',
    body: (
      <p>
        The chance (0–1) that each open grass tile gets a tree. 0.05 is about one tile in twenty. Trees are scenery:
        they don&apos;t block or slow units.
      </p>
    ),
  },
  turnChance: {
    title: 'Path winding',
    body: (
      <p>
        How much the dirt path from your start to the north edge wanders (0–1): the chance it steps sideways before
        moving up a row. 0 runs straight north; higher values twist more. Blank uses the default shown.
      </p>
    ),
  },
  castle: {
    title: 'Castle',
    body: <p>Whether a castle stands beside the north end of the path.</p>,
  },
  lakes: {
    title: 'Lakes',
    body: (
      <>
        <p>How many lakes to grow. Water can&apos;t be crossed, so lakes funnel units around them.</p>
        {patchSize}
      </>
    ),
  },
  mountains: {
    title: 'Mountain ranges',
    body: (
      <>
        <p>How many mountain ranges to grow. Nothing can cross mountains yet.</p>
        {patchSize}
      </>
    ),
  },
  forests: {
    title: 'Forests',
    body: (
      <>
        <p>How many forests to grow. Forests cost 2 movement to enter, so they slow units down.</p>
        {patchSize}
      </>
    ),
  },
  meadows: {
    title: 'Meadows',
    body: (
      <>
        <p>
          How many meadows to grow. Meadows are open ground that looks different from grass; they don&apos;t slow units.
        </p>
        {patchSize}
      </>
    ),
  },
  ruins: {
    title: 'Walled ruins',
    body: (
      <p>
        How many walled ruins to place: a ring of wall with one gap and a temple or fort inside. Walls can&apos;t be
        crossed. Blank uses the default shown.
      </p>
    ),
  },
  buildings: {
    title: 'Buildings',
    body: (
      <p>
        How many lone buildings (houses, farms, windmills, towers and so on) to place on open grass. Blank uses the
        default shown.
      </p>
    ),
  },
  enemies: {
    title: 'Enemy groups',
    body: (
      <>
        <p>
          Each group places some enemies of one class on random tiles that pass all of its limits. Leave a limit blank
          and the group can use the whole map.
        </p>
        <p>
          Groups are placed in order, and a group can&apos;t use tiles an earlier group took. Saving checks the region
          on sample maps and tells you if a group&apos;s limits leave it nowhere to stand.
        </p>
      </>
    ),
  },
  count: {
    title: 'Count',
    body: <p>How many enemies this group places ({REGION_LIMITS.enemyCount[1]} at most across all groups).</p>,
  },
  unitClass: {
    title: 'Class',
    body: (
      <p>
        The unit class these enemies are, e.g. villagers (fists only) for an easy early stage, soldiers or archers for a
        harder one. Blank: soldiers.
      </p>
    ),
  },
  minDistance: {
    title: 'Min distance',
    body: (
      <>
        <p>
          The fewest steps from where your units start to these enemies. Raise it to keep the group away from the start,
          e.g. 8 so nothing attacks on turn one. Blank: no minimum.
        </p>
        {distanceSteps}
      </>
    ),
  },
  maxDistance: {
    title: 'Max distance',
    body: (
      <>
        <p>
          The most steps from where your units start to these enemies. Lower it to put the group close by, e.g. an
          ambush. Blank: no maximum.
        </p>
        <p>
          It has to reach the group&apos;s area: an area in the north of the map is far from your start, so a small max
          distance there leaves the group nowhere to stand.
        </p>
        {distanceSteps}
      </>
    ),
  },
  health: {
    title: 'Health',
    body: (
      <p>
        The HP these enemies start the battle with, e.g. low for a first stage the player should win. It never goes past
        their max HP. Blank: full health.
      </p>
    ),
  },
  levelUpOnKill: {
    title: 'Level up on kill',
    body: (
      <p>
        Whether killing one of these enemies gives the killer exactly the XP it needs for its next level, whatever its
        class, e.g. so a first stage&apos;s kill always earns a level up. Off: the usual XP.
      </p>
    ),
  },
  x: {
    title: 'Area x (columns)',
    body: (
      <>
        <p>
          Which columns of the map the group may stand in, from left to right, as fractions of the width: 0 is the west
          (left) edge and 1 the east (right) edge, whatever the map&apos;s size. Blank: every column.
        </p>
        <AreaDiagram x={[0, 0.5]} caption="x from 0 to 0.5: the left half." />
        <p>Use it with Area y to pick a box. E.g. x 0.7 to 1 is a strip down the right side.</p>
      </>
    ),
  },
  y: {
    title: 'Area y (rows)',
    body: (
      <>
        <p>
          Which rows of the map the group may stand in, from top to bottom, as fractions of the height: 0 is the north
          (top) edge, farthest from your units, and 1 the south (bottom) edge, where they start. Blank: every row.
        </p>
        <AreaDiagram y={[0, 0.34]} caption="y from 0 to 0.34: the top third, the classic enemy side." />
        <p>Use it with Area x to pick a box. E.g. y 0.4 to 0.6 is a band across the middle.</p>
      </>
    ),
  },
};

// Width and height are explained together.
export const FIELD_HELP: Readonly<Record<string, FieldHelp>> = Object.freeze({ ...HELP, height: HELP.width });
