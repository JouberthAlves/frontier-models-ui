import { KIT, type KitShape } from '../../lib/sceneryKit';

/**
 * Renders the scenery kit (src/lib/sceneryKit.ts) as one <symbol> per piece. The geometry lives
 * in the kit as plain data; this file only turns it into SVG.
 */
function Shape({ shape }: { shape: KitShape }) {
  const { tag, cls, transform } = shape;
  switch (tag) {
    case 'path':
      return <path d={shape.d} className={cls} transform={transform} />;
    case 'circle':
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} className={cls} transform={transform} />;
    case 'ellipse':
      return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} className={cls} transform={transform} />;
    case 'rect':
      return (
        <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} className={cls} transform={transform} />
      );
    default:
      return <use href={`#sc-${shape.href}`} transform={transform} />;
  }
}

export default function SceneryDefs() {
  return (
    <>
      {KIT.map(symbol => (
        <symbol key={symbol.id} id={`sc-${symbol.id}`} overflow="visible">
          {symbol.shapes.map((shape, index) => (
            <Shape key={index} shape={shape} />
          ))}
        </symbol>
      ))}
    </>
  );
}
