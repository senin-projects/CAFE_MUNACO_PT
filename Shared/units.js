export const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'pack', 'bottle', 'can', 'sachet']

const UNIT_DEFINITIONS = {
  kg: { dimension: 'mass', factor: 1_000_000 },
  g: { dimension: 'mass', factor: 1000 },
  mg: { dimension: 'mass', factor: 1 },
  L: { dimension: 'volume', factor: 1000 },
  ml: { dimension: 'volume', factor: 1 },
  mL: { dimension: 'volume', factor: 1 },
  cup: { dimension: 'volume', factor: 240 },
  tbsp: { dimension: 'volume', factor: 15 },
  tsp: { dimension: 'volume', factor: 5 },
  pcs: { dimension: 'count', factor: 1 },
  dozen: { dimension: 'count', factor: 12 },
  pack: { dimension: 'pack', factor: 1 },
  box: { dimension: 'box', factor: 1 },
  tray: { dimension: 'tray', factor: 1 },
  bottle: { dimension: 'bottle', factor: 1 },
  can: { dimension: 'can', factor: 1 },
  jar: { dimension: 'jar', factor: 1 },
  bag: { dimension: 'bag', factor: 1 },
  sack: { dimension: 'sack', factor: 1 },
  sachet: { dimension: 'sachet', factor: 1 },
}

export function areUnitsCompatible(firstUnit, secondUnit) {
  if (firstUnit === secondUnit) return true
  const first = UNIT_DEFINITIONS[firstUnit]
  const second = UNIT_DEFINITIONS[secondUnit]
  return Boolean(first && second && first.dimension === second.dimension)
}

export function getCompatibleUnits(inventoryUnit, selectedUnit) {
  const inventoryDefinition = UNIT_DEFINITIONS[inventoryUnit]
  const compatibleUnits = inventoryDefinition
    ? UNITS.filter((unit) => areUnitsCompatible(unit, inventoryUnit))
    : [inventoryUnit]
  return [...new Set([...compatibleUnits, inventoryUnit, selectedUnit].filter(
    (unit) => unit && areUnitsCompatible(unit, inventoryUnit),
  ))]
}

export function convertUnitQuantity(quantity, fromUnit, toUnit) {
  const amount = Number(quantity)
  if (!Number.isFinite(amount) || !areUnitsCompatible(fromUnit, toUnit)) return null
  const from = UNIT_DEFINITIONS[fromUnit]
  const to = UNIT_DEFINITIONS[toUnit]
  return from && to ? amount * from.factor / to.factor : amount
}

export function roundStockQuantity(quantity) {
  return Math.round((Number(quantity) + Number.EPSILON) * 1_000_000) / 1_000_000
}
