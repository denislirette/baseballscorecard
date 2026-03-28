# The Play Cell

Each play cell represents one batter's plate appearance in one inning. It's the fundamental unit of the scorecard.

## Examples

<div class="live-preview">
  <PlayCell notation="G6-3" out="1" count="1-2" label="Groundout" description="Ground ball to SS, thrown to 1B"
    :pitches="[{speed:94,type:'FF',strike:true},{speed:87,type:'CH',strike:false},{speed:91,type:'SL',strike:true},{speed:96,type:'FF',inPlay:true}]"/>
  <PlayCell notation="K" out="2" count="1-2" label="Strikeout" description="Swinging strikeout"
    :pitches="[{speed:95,type:'FF',strike:false},{speed:88,type:'CH',strike:true},{speed:95,type:'FF',strike:true},{speed:82,type:'CU',strike:true}]"/>
  <PlayCell notation="BB" count="3-1" label="Walk" description="Base on balls (4 balls)"
    :pitches="[{speed:93,type:'FF',strike:false},{speed:87,type:'CH',strike:true},{speed:94,type:'FF',strike:false},{speed:92,type:'FF',strike:false},{speed:88,type:'CH',strike:false}]"/>
  <PlayCell notation="HR" :rbi="2" count="2-1" label="Home Run" description="Solid filled diamond, 2 RBI"
    :pitches="[{speed:94,type:'FF',strike:false},{speed:87,type:'SL',strike:true},{speed:95,type:'FF',strike:false},{speed:88,type:'CH',inPlay:true}]"/>
</div>

## Hits

<div class="live-preview">
  <PlayCell notation="1B" :hashes="1" count="0-0" label="Single" description="1 hash mark on HP-1B path"
    :pitches="[{speed:93,type:'FF',inPlay:true}]"/>
  <PlayCell notation="2B" :hashes="2" count="1-0" label="Double" description="2 hash marks, path to 2B"
    :pitches="[{speed:91,type:'SI',strike:false},{speed:86,type:'CH',inPlay:true}]"/>
  <PlayCell notation="3B" :hashes="3" count="0-1" label="Triple" description="3 hash marks, path to 3B"
    :pitches="[{speed:94,type:'FF',strike:true},{speed:89,type:'SL',inPlay:true}]"/>
</div>

## Substitution Indicators

<div class="live-preview">
  <PlayCell notation="G4-3" out="1" :ph="true" count="0-2" label="Pinch Hitter" description="Dotted line on LEFT (before at-bat)"/>
  <PlayCell notation="BB" :pr="true" count="3-1" label="Pinch Runner" description="Dotted line on RIGHT (after at-bat)"/>
  <PlayCell notation="F8" out="3" :thirdOut="true" count="1-2" label="Third Out" description="Diagonal notch marks end of half-inning"/>
  <PlayCell notation="K" out="2" :pitcherChange="true" count="0-2" label="Pitcher Change" description="Dotted line at bottom with stats"/>
</div>

## Scored Runners

<div class="live-preview">
  <PlayCell notation="1B" :hashes="1" :scored="true" count="1-0" label="Scored (not HR)" description="3 diagonal hatch lines fill the diamond"/>
  <PlayCell notation="HR" :rbi="1" count="3-2" label="Home Run" description="Solid black diamond with white HR text"/>
</div>

## RBI Indicators

<div class="live-preview">
  <PlayCell notation="HR" :rbi="1" count="1-1" label="1 RBI" description="Solo home run"/>
  <PlayCell notation="2B" :hashes="2" :rbi="2" count="0-1" label="2 RBI" description="Two-run double"/>
  <PlayCell notation="HR" :rbi="4" count="3-1" label="Grand Slam" description="4 RBI, bases were loaded"/>
</div>

## Zones

A play cell is divided into zones:

| Zone | Location | Content |
|------|----------|---------|
| Top-left | Out badge | Numbered circle (1, 2, or 3) |
| Top-right | Count + pitches | Balls-strikes and pitch sequence |
| Center | Diamond or notation | Base paths for hits, large text for outs |
| Bottom-left | RBI | Small filled diamonds, one per RBI |
| Bottom-right | Strike zone | Mini zone with pitch dots (when 10 or fewer pitches) |
| Left edge | PH line | Dotted squares, sub before at-bat |
| Right edge | PR line | Dotted squares, sub after at-bat |
| Bottom edge | Pitcher line | Dotted squares with departing pitcher stats |

## Count

Displays as `B-S` (balls-strikes) at the moment the at-bat ended.

**Rules:**
- Balls: count `B` and `*` pitch codes
- Strikes: count `C`, `S`, `F`, `W`, `T`, capped at 2
- Foul balls after 2 strikes do not increment

## Third-Out Notch

A diagonal line in the bottom-right corner of the cell where the third out occurs. Traditional scorekeeping convention that marks where each half-inning ended.
