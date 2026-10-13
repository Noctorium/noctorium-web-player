/*
 * Small drawings of each player bar and each now playing layout, for Settings' cards, in the theme's own colours:
 * enough to tell them apart at a glance before choosing. Drawn here, not taken from anywhere.
 */

export function BarPreview({ name }: { name: string }) {
  if (name === 'TOOLBAR') {
    return (
      <svg className="mini" viewBox="0 0 160 34" aria-hidden>
        <rect className="panel" width="160" height="34" rx="4" />
        <rect className="art" x="5" y="9" width="16" height="16" rx="2" />
        <rect className="ink" x="25" y="12" width="18" height="3" rx="1.5" />
        <rect className="faint" x="25" y="19" width="13" height="3" rx="1.5" />
        {[52, 60, 68, 76, 84, 92].map((x, i) => <rect key={x} className={i === 2 ? 'accent' : 'ink'} x={x} y="14" width="5" height="6" rx="1" />)}
        <rect className="track" x="102" y="16" width="34" height="2" rx="1" />
        <rect className="accent" x="102" y="16" width="13" height="2" rx="1" />
        <circle className="handle" cx="115" cy="17" r="3" />
        {[141, 148, 155].map((x) => <rect key={x} className="faint" x={x - 2} y="14" width="4" height="6" rx="1" />)}
      </svg>
    );
  }
  if (name === 'TOOLBAR_2') {
    // Three buttons where the Toolbar has six, play and pause one of them, a shorter slider, and a longer row of
    // buttons after it in three groups: like, lyrics, the queue; repeat, shuffle; the timer, Connect, speed, volume.
    return (
      <svg className="mini" viewBox="0 0 160 34" aria-hidden>
        <rect className="panel" width="160" height="34" rx="4" />
        <rect className="art" x="5" y="9" width="16" height="16" rx="2" />
        <rect className="ink" x="25" y="12" width="16" height="3" rx="1.5" />
        <rect className="faint" x="25" y="19" width="11" height="3" rx="1.5" />
        {[45, 52, 59].map((x, i) => <rect key={x} className={i === 1 ? 'accent' : 'ink'} x={x} y="14" width="5" height="6" rx="1" />)}
        <rect className="track" x="69" y="16" width="29" height="2" rx="1" />
        <rect className="accent" x="69" y="16" width="11" height="2" rx="1" />
        <circle className="handle" cx="80" cy="17" r="3" />
        {[103, 108.5, 114, 121, 126.5, 133.5, 139, 144.5, 150].map((x) => <rect key={x} className="faint" x={x} y="14" width="4" height="6" rx="1" />)}
      </svg>
    );
  }
  return (
    <svg className="mini" viewBox="0 0 160 34" aria-hidden>
      <rect className="panel" width="160" height="34" rx="4" />
      <rect className="art" x="5" y="7" width="20" height="20" rx="3" />
      <rect className="ink" x="29" y="11" width="22" height="3" rx="1.5" />
      <rect className="faint" x="29" y="18" width="16" height="3" rx="1.5" />
      <circle className="ink" cx="64" cy="13" r="2" />
      <circle className="text" cx="80" cy="12" r="5.5" />
      <circle className="ink" cx="96" cy="13" r="2" />
      <rect className="track" x="56" y="25" width="48" height="2" rx="1" />
      <rect className="accent" x="56" y="25" width="20" height="2" rx="1" />
      <rect className="track" x="124" y="16" width="26" height="2" rx="1" />
      <rect className="accent" x="124" y="16" width="18" height="2" rx="1" />
    </svg>
  );
}

export function LayoutPreview({ name }: { name: string }) {
  if (name === 'PLAYLIST') {
    return (
      <svg className="mini" viewBox="0 0 160 90" aria-hidden>
        <rect className="bg" width="160" height="90" rx="4" />
        <rect className="panel" x="4" y="4" width="40" height="44" rx="3" />
        <rect className="art" x="8" y="12" width="32" height="32" rx="2" />
        <rect className="panel" x="48" y="4" width="108" height="76" rx="3" />
        <rect className="accent" x="52" y="8" width="18" height="3" rx="1.5" />
        <rect className="faint" x="74" y="8" width="14" height="3" rx="1.5" />
        {[16, 22, 28, 34, 40, 46].map((y, i) => (
          <g key={y}>
            {i === 1 && <rect className="soft" x="49" y={y - 2} width="106" height="6" />}
            <rect className={i === 1 ? 'accent' : 'ink'} x="56" y={y} width="30" height="2" rx="1" />
            <rect className="faint" x="92" y={y} width="22" height="2" rx="1" />
            <rect className="faint" x="120" y={y} width="20" height="2" rx="1" />
            <rect className="faint" x="146" y={y} width="6" height="2" rx="1" />
          </g>
        ))}
        <rect className="art" x="52" y="58" width="16" height="16" rx="2" />
        <rect className="ink" x="72" y="60" width="34" height="5" rx="2" />
        <rect className="faint" x="72" y="69" width="24" height="3" rx="1.5" />
        {[0.5, 0.9, 0.7, 0.55, 0.4, 0.3].map((h, i) => <rect key={i} className="accent" x={124 + i * 5} y={74 - h * 14} width="4" height={h * 14} />)}
        <rect className="panel" x="0" y="83" width="160" height="7" />
        <rect className="faint" x="4" y="85.5" width="40" height="2" rx="1" />
        <rect className="faint" x="128" y="85.5" width="28" height="2" rx="1" />
      </svg>
    );
  }
  return (
    <svg className="mini" viewBox="0 0 160 90" aria-hidden>
      <rect className="bg" width="160" height="90" rx="4" />
      <rect className="art" x="22" y="8" width="44" height="44" rx="4" />
      <rect className="ink" x="26" y="57" width="36" height="4" rx="2" />
      <rect className="faint" x="31" y="64" width="26" height="3" rx="1.5" />
      <rect className="track" x="16" y="72" width="56" height="2" rx="1" />
      <rect className="accent" x="16" y="72" width="24" height="2" rx="1" />
      <circle className="text" cx="44" cy="81" r="4" />
      <rect className="panel" x="88" y="6" width="66" height="78" rx="5" />
      {[16, 26, 36, 46, 56, 66].map((y, i) => (
        <g key={y}>
          <rect className="art" x="93" y={y - 3} width="7" height="7" rx="1" />
          <rect className={i === 1 ? 'accent' : 'ink'} x="104" y={y - 2} width="30" height="2" rx="1" />
          <rect className="faint" x="104" y={y + 2} width="20" height="2" rx="1" />
        </g>
      ))}
    </svg>
  );
}
