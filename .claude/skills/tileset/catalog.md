# Tilesheet catalog

Every frame of `tilemap_packed.png` (18 columns x 11 rows, `frame = row * 18 + col`), decoded and confirmed one sheet row at a time — all 198 frames are covered. Look frames up here before decoding anything.

Sprites marked *overlay* have transparent corners and are meant to be drawn on top of a terrain tile rather than used as terrain themselves.

## Buildings and props by faction

The same building shapes repeat once per faction. Neutral (grey) versions are in row 0; faction columns are filled in as their rows are confirmed.

| Name | Neutral | Green | Blue | Red | Orange |
|---|---|---|---|---|---|
| City | 8 | 26 | 44 | 62 | 80 |
| Shop | 9 | 27 | 45 | 63 | 81 |
| HQ | 10 | 28 | 46 | 64 | 82 |
| Factory | 11 | 29 | 47 | 65 | 83 |
| Construction site | 12 | 30 | 48 | 66 | 84 |
| Comm tower | 13 | 31 | 49 | 67 | 85 |
| Power line / electrical tower | 14 | 32 | 50 | 68 | 86 |
| Port / dock | 15 | 33 | 51 | 69 | 87 |
| Flag (pose A) | 16 | 34 | 52 | 70 | 88 |
| Flag (pose B) | 17 | 35 | 53 | 71 | 89 |

## Units by faction

Unit sprites face right, with transparent backgrounds (overlays). Grey is the **neutral** faction (row 5); faction columns are filled in as their rows are confirmed.

| Name | Neutral | Green | Blue | Red | Orange |
|---|---|---|---|---|---|
| Truck | 95 | 113 | 131 | 149 | 167 |
| Supply truck | 96 | 114 | 132 | 150 | 168 |
| APC | 97 | 115 | 133 | 151 | 169 |
| Tank | 98 | 116 | 134 | 152 | 170 |
| Artillery | 99 | 117 | 135 | 153 | 171 |
| Jet fighter | 100 | 118 | 136 | 154 | 172 |
| Helicopter | 101 | 119 | 137 | 155 | 173 |
| Air carrier (transports units) | 102 | 120 | 138 | 156 | 174 |
| Transport boat | 103 | 121 | 139 | 157 | 175 |
| Warship | 104 | 122 | 140 | 158 | 176 |
| Submarine | 105 | 123 | 141 | 159 | 177 |
| Soldier (rifle) | 106 | 124 | 142 | 160 | 178 |
| Bazooka infantry | 107 | 125 | 143 | 161 | 179 |

## By frame

### Row 0 (frames 0–17) — confirmed

| Frame | Description |
|---|---|
| 0 | Grass, plain |
| 1 | Grass with small tufts |
| 2 | Grass with two orange flowers |
| 3 | 2x2 pond, top-left: grass above, sand shoreline, water below (bottom half is 21/22) |
| 4 | 2x2 pond, top-right |
| 5 | Mountain — brown peak on a green base; overlay |
| 6 | Generic SUV, grey vehicle; overlay |
| 7 | Lamppost, grey; overlay |
| 8 | City (neutral) — cluster of buildings with windows |
| 9 | Shop (neutral) — building with windows and a door |
| 10 | HQ (neutral) — tall multi-storey building with many windows |
| 11 | Factory (neutral) — sawtooth roof |
| 12 | Construction site (neutral) — building with a crane arm |
| 13 | Comm tower (neutral) — pointed tower on legs |
| 14 | Power line / electrical tower (neutral) |
| 15 | Port / dock (neutral) — building with a dark band along its base |
| 16 | Flag (neutral), pole on the left |
| 17 | Flag (neutral), second pose — likely an animation frame pairing with 16 |

### Row 1 (frames 18–35) — confirmed

| Frame | Description |
|---|---|
| 18 | Water edge, top-left — grass rim top and left with sand shoreline (`TERRAIN_EDGE_FRAMES.water`) |
| 19 | Water edge, top |
| 20 | Water edge, top-right |
| 21 | 2x2 pond, bottom-left — water rounding off into grass (top half is 3/4) |
| 22 | 2x2 pond, bottom-right |
| 23 | Anti-tank "hedgehog" barrier, grey; overlay |
| 24 | Armored vehicle, grey — defended, not necessarily a tank; overlay |
| 25 | Fence, grey; overlay |
| 26 | City (green) |
| 27 | Shop (green) |
| 28 | HQ (green) |
| 29 | Factory (green) |
| 30 | Construction site (green) |
| 31 | Comm tower (green) |
| 32 | Power line / electrical tower (green) |
| 33 | Port / dock (green) |
| 34 | Flag (green), pose A |
| 35 | Flag (green), pose B |

### Row 2 (frames 36–53) — confirmed

| Frame | Description |
|---|---|
| 36 | Water edge, left |
| 37 | Water, open (center of the water set; `TERRAIN_FRAMES.water`) |
| 38 | Water edge, right |
| 39 | Water with grass notches in both bottom corners — open water narrowing into a 1-wide river heading down (flipped counterpart of 75) |
| 40 | Movement arrow, head up (blue; `ARROW_FRAMES['head-up']`); overlay |
| 41 | Movement arrow, head left (`head-left`); overlay |
| 42 | Movement arrow, horizontal straight (`left-right`); overlay |
| 43 | Movement arrow, head right (`head-right`); overlay |
| 44 | City (blue) |
| 45 | Shop (blue) |
| 46 | HQ (blue) |
| 47 | Factory (blue) |
| 48 | Construction site (blue) |
| 49 | Comm tower (blue) |
| 50 | Power line / electrical tower (blue) |
| 51 | Port / dock (blue) |
| 52 | Flag (blue), pose A |
| 53 | Flag (blue), pose B |

### Row 3 (frames 54–71) — confirmed

| Frame | Description |
|---|---|
| 54 | Water edge, bottom-left |
| 55 | Water edge, bottom |
| 56 | Water edge, bottom-right |
| 57 | River, vertical, 1 tile wide — grass banks with sand on both sides; the light bands are just flowing water |
| 58 | Movement arrow, vertical straight (`up-down`); overlay |
| 59 | Movement arrow, corner joining bottom and right edges (`down-right`); overlay |
| 60 | Movement arrow, corner joining bottom and left edges (`down-left`); overlay |
| 61 | Map cursor — four corner brackets (`UI_FRAMES.cursor`); overlay |
| 62 | City (red) |
| 63 | Shop (red) |
| 64 | HQ (red) |
| 65 | Factory (red) |
| 66 | Construction site (red) |
| 67 | Comm tower (red) |
| 68 | Power line / electrical tower (red) |
| 69 | Port / dock (red) |
| 70 | Flag (red), pose A |
| 71 | Flag (red), pose B |

### Row 4 (frames 72–89) — confirmed

| Frame | Description |
|---|---|
| 72 | Water inner corner, grass top-right — plus a 3px grass notch on the bottom edge that continues into 91 when stacked above it; use 91 for a lone corner |
| 73 | Water with the tip of a 1-wide grass strip (sand rim) reaching down from above, reflected in the water below |
| 74 | Water inner corner, grass top-left — plus a bottom notch that continues into 90; use 90 for a lone corner |
| 75 | River mouth — a 1-wide river enters from above and opens into water (grass in both top corners) |
| 76 | Movement arrow, head down (`head-down`); overlay |
| 77 | Movement arrow, corner joining top and right edges (`up-right`); overlay |
| 78 | Movement arrow, corner joining top and left edges (`up-left`); overlay |
| 79 | Range selection — yellow diagonal hatch stripes on transparency (the highlight in Kenney's sample image); overlay. Name is provisional — may be repurposed |
| 80 | City (orange) |
| 81 | Shop (orange) |
| 82 | HQ (orange) |
| 83 | Factory (orange) |
| 84 | Construction site (orange) |
| 85 | Comm tower (orange) |
| 86 | Power line / electrical tower (orange) |
| 87 | Port / dock (orange) |
| 88 | Flag (orange), pose A |
| 89 | Flag (orange), pose B |

### Row 5 (frames 90–107) — confirmed

| Frame | Description |
|---|---|
| 90 | Water inner corner, grass top-left (`TERRAIN_EDGE_FRAMES.water['inner-top-left']`) |
| 91 | Water inner corner, grass top-right (`TERRAIN_EDGE_FRAMES.water['inner-top-right']`) |
| 92 | Water inner corner, grass bottom-right (`TERRAIN_EDGE_FRAMES.water['inner-bottom-right']`) |
| 93 | Water inner corner, grass bottom-left (`TERRAIN_EDGE_FRAMES.water['inner-bottom-left']`) |
| 94 | Tree — small green pine; overlay |
| 95 | Truck (neutral) — cab on the right, box bed behind |
| 96 | Supply truck (neutral) — the truck carrying an orange crate |
| 97 | APC (neutral) — boxy tracked vehicle with a small window, no turret |
| 98 | Tank (neutral) — tracked hull with a turret |
| 99 | Artillery (neutral) — tracked vehicle with angled barrels |
| 100 | Jet fighter (neutral), side view |
| 101 | Helicopter (neutral) |
| 102 | Air carrier (neutral) — aircraft for transporting units, two rotors/engines |
| 103 | Transport boat (neutral) — flat deck, raised bow, on a water line |
| 104 | Warship (neutral) — hull with superstructure, on a water line |
| 105 | Submarine (neutral), surfaced, on a water line |
| 106 | Soldier (neutral) — rifle held across the body |
| 107 | Bazooka infantry (neutral) — arms raised, brown belt |

### Row 6 (frames 108–125) — confirmed

| Frame | Description |
|---|---|
| 108 | Road, single isolated tile — dark asphalt with light edge lines on all four sides |
| 109 | Road, horizontal, left end — edge lines top, left, bottom; opens right |
| 110 | Road, horizontal straight — dashed center line |
| 111 | Road, horizontal, right end — edge lines top, right, bottom; opens left |
| 112 | Trees — two small pines together (denser version of 94); overlay |
| 113 | Truck (green) |
| 114 | Supply truck (green) |
| 115 | APC (green) |
| 116 | Tank (green) |
| 117 | Artillery (green) |
| 118 | Jet fighter (green) |
| 119 | Helicopter (green) |
| 120 | Air carrier (green) |
| 121 | Transport boat (green) |
| 122 | Warship (green) |
| 123 | Submarine (green) |
| 124 | Soldier (green) — current player unit (`UNIT_FRAMES.player`) |
| 125 | Bazooka infantry (green) |

### Row 7 (frames 126–143) — confirmed

| Frame | Description |
|---|---|
| 126 | Road, vertical, top end — rounded cap, edge lines left/top/right, opens down; overlay |
| 127 | Road turn connecting right and down — outer edge curves round the top-left, inner curb at bottom-right; overlay |
| 128 | Road T-junction — horizontal road open left and right, branch going down, top edge closed |
| 129 | Road turn connecting left and down — mirror of 127; overlay |
| 130 | Bridge, horizontal — road deck with white railings top and bottom; crosses the vertical river (57) |
| 131 | Truck (blue) |
| 132 | Supply truck (blue) |
| 133 | APC (blue) |
| 134 | Tank (blue) |
| 135 | Artillery (blue) |
| 136 | Jet fighter (blue) |
| 137 | Helicopter (blue) |
| 138 | Air carrier (blue) |
| 139 | Transport boat (blue) |
| 140 | Warship (blue) |
| 141 | Submarine (blue) |
| 142 | Soldier (blue) |
| 143 | Bazooka infantry (blue) |

### Row 8 (frames 144–161) — confirmed

| Frame | Description |
|---|---|
| 144 | Road, vertical straight — edge lines left and right, dashed center line |
| 145 | Road T-junction — vertical road open up and down, branch to the right |
| 146 | Road crossroads — open on all four sides, curbs in all four corners |
| 147 | Road T-junction — vertical road open up and down, branch to the left |
| 148 | Water under a bridge — stone edge along the top, shadow band beneath, supports at the top corners; sits below the bridge (130) |
| 149 | Truck (red) |
| 150 | Supply truck (red) |
| 151 | APC (red) |
| 152 | Tank (red) |
| 153 | Artillery (red) |
| 154 | Jet fighter (red) |
| 155 | Helicopter (red) |
| 156 | Air carrier (red) |
| 157 | Transport boat (red) |
| 158 | Warship (red) |
| 159 | Submarine (red) |
| 160 | Soldier (red) — current enemy unit (`UNIT_FRAMES.enemy`) |
| 161 | Bazooka infantry (red) |

### Row 9 (frames 162–179) — confirmed

| Frame | Description |
|---|---|
| 162 | Road, vertical, bottom end — rounded cap, opens up; overlay |
| 163 | Road turn connecting up and right — outer edge curves round the bottom-left; overlay |
| 164 | Road T-junction — horizontal road open left and right, branch going up, bottom edge closed |
| 165 | Road turn connecting up and left — mirror of 163; overlay |
| 166 | Bridge, vertical — road deck with railings down both sides; vertical counterpart of 130 |
| 167 | Truck (orange) |
| 168 | Supply truck (orange) |
| 169 | APC (orange) |
| 170 | Tank (orange) |
| 171 | Artillery (orange) |
| 172 | Jet fighter (orange) |
| 173 | Helicopter (orange) |
| 174 | Air carrier (orange) |
| 175 | Transport boat (orange) |
| 176 | Warship (orange) |
| 177 | Submarine (orange) |
| 178 | Soldier (orange) |
| 179 | Bazooka infantry (orange) |

### Row 10 (frames 180–197) — confirmed

| Frame | Description |
|---|---|
| 180–189 | Digits 0–9 — small dark badge in the bottom-right corner, transparent elsewhere; frame = 180 + digit. Drawn on a unit to show a count or HP; overlay |
| 190 | "?" badge, same style as the digits; overlay |
| 191 | Ammo icon — bullet/cartridge with a brass tip |
| 192 | Fuel icon — red jerry can |
| 193 | Padlock icon (locked) |
| 194 | White flag icon |
| 195 | Heart icon (health) |
| 196 | Pointer cursor — white gloved hand |
| 197 | Aircraft shadow — dithered dark oval, drawn under aircraft; overlay |
