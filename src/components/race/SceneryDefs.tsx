import { KIT } from '../../lib/sceneryKit';

/**
 * Renders the scenery kit (src/lib/sceneryKit.ts) as one <symbol> per piece: an <image> (the
 * illustrated sprite) for a single piece, several <use> for a composite. The data lives in the
 * kit; this file only turns it into SVG.
 */
export default function SceneryDefs() {
  return (
    <>
      {KIT.map(symbol => (
        <symbol key={symbol.id} id={`sc-${symbol.id}`} overflow="visible">
          {symbol.shapes.map((shape, index) =>
            shape.tag === 'image' ? (
              <image
                key={index}
                href={shape.href}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                transform={shape.transform}
                preserveAspectRatio="none"
              />
            ) : (
              <use key={index} href={`#sc-${shape.href}`} transform={shape.transform} />
            )
          )}
        </symbol>
      ))}
    </>
  );
}
