// Structural formulas described as data: atoms with a label are drawn as text,
// the rest are plain corners of the carbon skeleton. Bonds: [from, to, order].
const MOLECULES = {
  soap: {
    box: '0 0 520 210',
    atoms: [
      [20, 110], [58, 88], [96, 110], [134, 88], [172, 110], [210, 88], [248, 110], [286, 88], [324, 110], [362, 88],
      [400, 110], [400, 60, 'O'], [446, 136, 'O⁻'], [494, 136, 'Na⁺'],
    ],
    bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11, 2], [10, 12]],
    notes: [[130, 195, 'суды тебетін бөлігі'], [405, 195, 'суға тартылатын бөлігі']],
  },
  acetic: {
    box: '0 0 360 230',
    atoms: [[60, 130, 'CH₃'], [170, 130], [170, 40, 'O'], [280, 190, 'OH']],
    bonds: [[0, 1], [1, 2, 2], [1, 3]],
  },
  glycerol: {
    box: '0 0 440 220',
    atoms: [[50, 130, 'HO'], [125, 90], [220, 140], [315, 90], [390, 130, 'OH'], [220, 200, 'OH']],
    bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]],
  },
  aspirin: {
    box: '0 0 430 310',
    atoms: [
      [130, 110], [190, 75], [250, 110], [250, 180], [190, 215], [130, 180],
      [190, 20], [130, 14, 'O'], [262, 20, 'OH'],
      [310, 75, 'O'], [365, 110], [365, 175, 'O'], [410, 72, 'CH₃'],
    ],
    // ring (Kekulé form), carboxyl group on atom 1, acetoxy group on atom 2
    bonds: [[0, 1, 2], [1, 2], [2, 3, 2], [3, 4], [4, 5, 2], [5, 0], [1, 6], [6, 7, 2], [6, 8], [2, 9], [9, 10], [10, 11, 2], [10, 12]],
  },
};

function bondLines([ax, ay], [bx, by], order = 1) {
  const line = (dx, dy) => `<path class="bond" pathLength="1" d="M${ax + dx} ${ay + dy}L${bx + dx} ${by + dy}"/>`;
  if (order === 1) return line(0, 0);
  const length = Math.hypot(bx - ax, by - ay);
  const nx = (-(by - ay) / length) * 4;
  const ny = ((bx - ax) / length) * 4;
  return line(nx, ny) + line(-nx, -ny);
}

export function moleculeSvg(name, label) {
  const { box, atoms, bonds, notes = [] } = MOLECULES[name];
  const bondMarkup = bonds.map(([a, b, order]) => bondLines(atoms[a], atoms[b], order)).join('');
  const atomMarkup = atoms.filter((a) => a[2]).map(([x, y, text]) =>
    `<circle class="atom-bg" cx="${x}" cy="${y}" r="${text.length > 2 ? 25 : text.length > 1 ? 21 : 16}"/><text class="atom" x="${x}" y="${y}">${text}</text>`).join('');
  const noteMarkup = notes.map(([x, y, text]) => `<text class="mol-note" x="${x}" y="${y}">${text}</text>`).join('');
  return `<svg viewBox="${box}" role="img" aria-label="${label}">${bondMarkup}${atomMarkup}${noteMarkup}</svg>`;
}
