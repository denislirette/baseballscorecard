# Diamond and Base Paths

The diamond represents the four bases arranged in a rotated square. Home plate is at the bottom, first base at the right, second base at the top, and third base at the left.

## How base paths work

When a runner moves between bases, a thick line (polyline) is drawn connecting the bases they touched. The path tells the visual story of where every runner went during the play.

- **Reached base**: path drawn from home plate to the base reached
- **Advanced on another play**: path extends from current base to the next
- **Scored**: path goes all the way around back to home plate
- **Out on the bases**: path is truncated at the midpoint between the last two bases, with a numbered out marker

## Home run

The entire diamond is filled solid black with "HR" in white centered text. No base paths are drawn — the fill itself represents the complete circuit around the bases.

## Scored runner (hatch lines)

When a runner scores on a play that is not a home run, the diamond shows exactly **3 diagonal hatch lines** instead of a solid fill. This design was introduced in v0.9.0 to replace the previous grey fill.

The lines are:
- Drawn at 45 degrees (bottom-left to top-right)
- Evenly spaced (R x 0.5 apart)
- Clipped to the diamond boundary using an SVG clip path
- Same stroke weight as the base paths

This applies to all scored runners except home runs (which stay solid black).

## Hash marks for hits

Short perpendicular lines drawn across the home-plate-to-first-base segment. The number of hash marks tells you the type of hit:

| Hit | Hash marks |
|-----|------------|
| Single (1B) | 1 hash mark |
| Double (2B) | 2 hash marks |
| Triple (3B) | 3 hash marks |

Each hash is perpendicular to the 45-degree HP-1B path, centered at evenly spaced intervals along the segment.

## Out markers

When a runner is retired on the bases:

1. The base path is drawn only to the **midpoint** between the last two bases (truncated)
2. A **numbered circle** (1, 2, or 3) marks where the out occurred
3. The number indicates which out of the inning it was

**Important rule**: each out number appears exactly **once** per inning across all cells. In a double play, the batter's cell shows only the batter's out. The other runner's out appears in their own cell. This prevents confusion from seeing the same number twice.
