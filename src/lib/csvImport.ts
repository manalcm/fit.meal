import Papa from 'papaparse'
import type { IngredientCategory, IngredientUnit } from '../types/database'
import type { IngredientInput } from './ingredients'

export const CSV_TEMPLATE_HEADERS = [
  'nombre',
  'categoria',
  'kcal_100g',
  'proteina_100g',
  'carbos_100g',
  'grasa_100g',
  'precio_kg',
  'unidad_por_defecto',
  'gramos_por_unidad',
] as const

const VALID_CATEGORIES: IngredientCategory[] = [
  'verdura',
  'fruta',
  'carne',
  'pescado',
  'lacteo',
  'huevo',
  'cereal_pan',
  'legumbre',
  'grasa_aceite',
  'fruto_seco',
  'bebida',
  'otros',
]

const VALID_UNITS: IngredientUnit[] = ['gramos', 'unidad', 'ml']

export interface RowIssue {
  row: number
  message: string
}

export interface ParsedRow {
  row: number
  input: IngredientInput
}

export interface ParseResult {
  headerIssues: string[]
  rows: ParsedRow[]
  issues: RowIssue[]
  duplicateNames: string[]
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const normalized = trimmed.replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export function parseIngredientsCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  const headerIssues: string[] = []
  const foundHeaders = new Set(parsed.meta.fields ?? [])
  const requiredHeaders = CSV_TEMPLATE_HEADERS.filter(
    (h) => !['precio_kg', 'unidad_por_defecto', 'gramos_por_unidad'].includes(h),
  )
  for (const h of requiredHeaders) {
    if (!foundHeaders.has(h)) headerIssues.push(`Falta la columna obligatoria "${h}".`)
  }

  if (headerIssues.length > 0) {
    return { headerIssues, rows: [], issues: [], duplicateNames: [] }
  }

  const rows: ParsedRow[] = []
  const issues: RowIssue[] = []
  const seenNames = new Map<string, number>()
  const duplicateNames: string[] = []

  parsed.data.forEach((record, index) => {
    const rowNumber = index + 2 // +1 por índice 0-based, +1 por la fila de cabecera
    const name = (record.nombre ?? '').trim()
    if (!name) {
      issues.push({ row: rowNumber, message: 'Falta el nombre del ingrediente.' })
      return
    }

    const key = name.toLowerCase()
    if (seenNames.has(key)) {
      duplicateNames.push(name)
      return
    }
    seenNames.set(key, rowNumber)

    const categoryRaw = (record.categoria ?? '').trim().toLowerCase()
    const category = VALID_CATEGORIES.includes(categoryRaw as IngredientCategory)
      ? (categoryRaw as IngredientCategory)
      : null
    if (!category) {
      issues.push({
        row: rowNumber,
        message: `Categoría "${record.categoria ?? ''}" no reconocida (${name}).`,
      })
      return
    }

    const kcal = toNumber(record.kcal_100g)
    const protein = toNumber(record.proteina_100g)
    const carbs = toNumber(record.carbos_100g)
    const fat = toNumber(record.grasa_100g)
    if (kcal === null || protein === null || carbs === null || fat === null) {
      issues.push({
        row: rowNumber,
        message: `Kcal, proteína, carbohidratos y grasa deben ser números (${name}).`,
      })
      return
    }

    const unitRaw = (record.unidad_por_defecto ?? '').trim().toLowerCase()
    const unit = unitRaw === '' ? 'gramos' : (unitRaw as IngredientUnit)
    if (!VALID_UNITS.includes(unit)) {
      issues.push({
        row: rowNumber,
        message: `Unidad "${record.unidad_por_defecto}" no reconocida (${name}).`,
      })
      return
    }

    const price = toNumber(record.precio_kg)
    const gramsPerUnit = toNumber(record.gramos_por_unidad)

    rows.push({
      row: rowNumber,
      input: {
        name,
        category,
        kcal_per_100g: kcal,
        protein_per_100g: protein,
        carbs_per_100g: carbs,
        fat_per_100g: fat,
        price_per_kg: price,
        default_unit: unit,
        grams_per_unit: gramsPerUnit,
        in_pantry: false,
      },
    })
  })

  return { headerIssues, rows, issues, duplicateNames }
}
